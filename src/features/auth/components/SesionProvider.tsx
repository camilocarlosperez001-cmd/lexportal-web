import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'
import { mensajeDeError } from '../../../utils/errores'
import { cerrarSesion as cerrarSesionAuth, obtenerCuenta, type Cuenta } from '../services/auth'
import { SesionContext, type EstadoSesion, type ValorSesion } from '../sesionContext'

/** Mantiene la sesión de Supabase y la fila de public.cuentas del usuario autenticado. */
export function SesionProvider({ children }: PropsWithChildren) {
  const [estado, setEstado] = useState<EstadoSesion>('cargando')
  const [usuario, setUsuario] = useState<User | null>(null)
  const [cuenta, setCuenta] = useState<Cuenta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)

  const cargarCuenta = useCallback(async (usuarioId: string) => {
    try {
      const fila = await obtenerCuenta(usuarioId)
      setCuenta(fila)
      setError(null)
      setEstado('con-sesion')
    } catch (fallo: unknown) {
      setCuenta(null)
      setError(mensajeDeError(fallo, 'No pudimos leer tu cuenta. Inténtalo de nuevo.'))
      setEstado('error')
    }
  }, [])

  useEffect(() => {
    let vigente = true

    void supabase.auth.getSession().then(({ data, error: errorSesion }) => {
      if (!vigente) return
      if (errorSesion) {
        setError(mensajeDeError(errorSesion, 'No pudimos comprobar tu sesión.'))
        setEstado('error')
        return
      }
      if (!data.session) {
        setUsuario(null)
        setCuenta(null)
        setEstado('sin-sesion')
        return
      }
      setUsuario(data.session.user)
      void cargarCuenta(data.session.user.id)
    })

    const { data } = supabase.auth.onAuthStateChange((evento, sesion) => {
      // La sesión inicial ya se resolvió con getSession; se evita una segunda carga.
      if (!vigente || evento === 'INITIAL_SESSION') return
      // Se difiere la consulta: dentro del callback no deben hacerse llamadas al cliente.
      setTimeout(() => {
        if (!vigente) return
        if (!sesion) {
          setUsuario(null)
          setCuenta(null)
          setError(null)
          setEstado('sin-sesion')
          return
        }
        setUsuario(sesion.user)
        void cargarCuenta(sesion.user.id)
      }, 0)
    })

    return () => {
      vigente = false
      data.subscription.unsubscribe()
    }
  }, [cargarCuenta, intento])

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
