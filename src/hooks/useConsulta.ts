// Carga asíncrona reutilizable con estados de carga, error y reintento.
// `clave` identifica la consulta: al cambiar, se vuelve a ejecutar.

import { useCallback, useEffect, useRef, useState } from 'react'
import { mensajeDeError } from '../utils/errores'

export type Consulta<T> = {
  datos: T | null
  cargando: boolean
  error: string | null
  recargar: () => void
}

export function useConsulta<T>(cargar: () => Promise<T>, clave: string): Consulta<T> {
  const cargador = useRef(cargar)
  const claveAnterior = useRef<string | null>(null)
  const [intento, setIntento] = useState(0)
  const [datos, setDatos] = useState<T | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    cargador.current = cargar
  }, [cargar])

  useEffect(() => {
    let vigente = true
    // Al cambiar de consulta se descarta el resultado anterior: no debe verse el perfil
    // (ni sus campos opcionales) de la consulta previa mientras llega la respuesta nueva.
    const cambioDeConsulta = claveAnterior.current !== clave
    claveAnterior.current = clave
    void Promise.resolve()
      .then(() => {
        if (!vigente) return null
        if (cambioDeConsulta) setDatos(null)
        setCargando(true)
        setError(null)
        return cargador.current()
      })
      .then((resultado) => {
        if (vigente && resultado !== null) setDatos(resultado as T)
      })
      .catch((fallo: unknown) => {
        if (!vigente) return
        setDatos(null)
        setError(mensajeDeError(fallo))
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })
    return () => {
      vigente = false
    }
  }, [clave, intento])

  const recargar = useCallback(() => {
    setIntento((valor) => valor + 1)
  }, [])

  return { datos, cargando, error, recargar }
}
