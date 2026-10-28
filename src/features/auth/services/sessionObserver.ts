import type { Session } from '@supabase/supabase-js'
import type { Cuenta } from './auth'
import type { EstadoSesion } from '../sesionContext'

type Snapshot = {
  estado: EstadoSesion
  usuario: Session['user'] | null
  cuenta: Cuenta | null
  error: string | null
}
type Dependencies = {
  getSession: () => Promise<Session | null>
  subscribe: (listener: (session: Session | null) => void) => () => void
  loadAccount: (id: string) => Promise<Cuenta>
  publish: (snapshot: Snapshot) => void
  errorMessage: (error: unknown) => string
  defer: (run: () => void) => () => void
}

/** Las lecturas de una sesión anterior no pueden publicar datos ni errores. */
export function observeSession(deps: Dependencies): () => void {
  let active = true
  let revision = 0
  let cancelPending: (() => void) | undefined
  let current: Session | null = null
  let account: Cuenta | null = null
  const publishError = (error: unknown) => {
    account = null
    deps.publish({ estado: 'error', usuario: current?.user ?? null, cuenta: null, error: deps.errorMessage(error) })
  }
  const accept = (session: Session | null) => {
    if (!active) return
    const request = ++revision
    cancelPending?.()
    const changed = current?.user.id !== session?.user.id
    current = session
    if (!session) {
      account = null
      deps.publish({ estado: 'sin-sesion', usuario: null, cuenta: null, error: null })
      return
    }
    if (changed || !account) {
      account = null
      deps.publish({ estado: 'cargando', usuario: session.user, cuenta: null, error: null })
    }
    // No consultar Auth dentro del callback del SDK: esperar a que libere su lock.
    cancelPending = deps.defer(() => {
      void (async () => {
        try {
          const latest = await deps.getSession()
          if (!active || request !== revision) return
          if (!latest || latest.user.id !== session.user.id || latest.access_token !== session.access_token) {
            accept(latest)
            return
          }
          const row = await deps.loadAccount(latest.user.id)
          if (!active || request !== revision) return
          account = row
          deps.publish({ estado: 'con-sesion', usuario: latest.user, cuenta: row, error: null })
        } catch (error) {
          if (active && request === revision) publishError(error)
        }
      })()
    })
  }
  const initialRevision = revision
  const unsubscribe = deps.subscribe(accept)
  void deps.getSession().then(session => {
    if (active && revision === initialRevision) accept(session)
  }).catch(error => {
    if (active && revision === initialRevision) publishError(error)
  })
  return () => {
    active = false
    revision++
    cancelPending?.()
    unsubscribe()
  }
}
