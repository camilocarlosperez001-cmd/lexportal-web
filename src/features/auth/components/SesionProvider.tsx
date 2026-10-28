import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'
import { mensajeDeError } from '../../../utils/errores'
import { cerrarSesion as cerrarSesionAuth, obtenerCuenta, type Cuenta } from '../services/auth'
import { observeSession } from '../services/sessionObserver'
import { SesionContext, type EstadoSesion, type ValorSesion } from '../sesionContext'

/** Mantiene la sesión de Supabase y la fila de public.cuentas del usuario autenticado. */
export function SesionProvider({ children }: PropsWithChildren) {
  const [estado, setEstado] = useState<EstadoSesion>('cargando')
  const [usuario, setUsuario] = useState<User | null>(null)
  const [cuenta, setCuenta] = useState<Cuenta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    return observeSession({
      getSession: async () => {
        const { data, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        return data.session
      },
      subscribe: listener => {
        const { data } = supabase.auth.onAuthStateChange((event, session) => {
          if (event !== 'INITIAL_SESSION') listener(session)
        })
        return () => data.subscription.unsubscribe()
      },
      loadAccount: obtenerCuenta,
      publish: snapshot => {
        setEstado(snapshot.estado)
        setUsuario(snapshot.usuario)
        setCuenta(snapshot.cuenta)
        setError(snapshot.error)
      },
      errorMessage: error => mensajeDeError(error, 'No pudimos comprobar tu sesión o leer tu cuenta. Inténtalo de nuevo.'),
      defer: run => {
        const timer = setTimeout(run, 0)
        return () => clearTimeout(timer)
      },
    })
  }, [intento])

  const recargar = useCallback(async () => {
    setIntento((valor) => valor + 1)
  }, [])

  const cerrarSesion = useCallback(async () => {
    await cerrarSesionAuth()
    setUsuario(null)
    setCuenta(null)
    setError(null)
    setEstado('sin-sesion')
  }, [])

  const valor = useMemo<ValorSesion>(
    () => ({ estado, usuario, cuenta, error, recargar, cerrarSesion }),
    [estado, usuario, cuenta, error, recargar, cerrarSesion],
  )

  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>
}
