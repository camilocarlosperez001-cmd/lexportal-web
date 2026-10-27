import { useEffect, useRef, useState } from 'react'
import { parseAuthLink, withoutAuthCredentials, type AuthLinkPurpose } from '../../../domain/authLinks'
import { supabase } from '../../../lib/supabase'

const ERROR_ENLACE = 'El enlace no es válido, ha caducado o ya se utilizó. Solicita uno nuevo.'

/** El intercambio ocurre una sola vez, también con los efectos dobles de StrictMode. */
export function useAuthEmailLink(purpose: AuthLinkPurpose) {
  const [payload] = useState(() => parseAuthLink(window.location.href, purpose))
  const handled = payload.kind === 'hash' || payload.kind === 'error'
  const pending = useRef<Promise<string | null> | null>(null)
  const [result, setResult] = useState<{ userId: string | null } | null>(null)

  useEffect(() => {
    if (!handled) return // El SDK conserva el procesamiento de fragmentos antiguos.
    let alive = true
    window.history.replaceState(null, '', withoutAuthCredentials(window.location.href))
    if (!pending.current) {
      pending.current = (async () => {
        if (payload.kind !== 'hash') return null
        try {
          const { data, error } = await supabase.auth.verifyOtp({ token_hash: payload.tokenHash, type: payload.type })
          return !error && data.session ? data.session.user.id : null
        } catch { return null }
      })()
    }
    void pending.current.then(userId => { if (alive) setResult({ userId }) })
    return () => { alive = false }
  }, [handled, payload])

  return {
    handled,
    checking: handled && result === null,
    valid: handled && Boolean(result?.userId),
    userId: result?.userId ?? null,
    error: handled && result !== null && !result.userId ? ERROR_ENLACE : null,
  }
}
