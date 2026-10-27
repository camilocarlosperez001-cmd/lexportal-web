import { useContext } from 'react'
import { SesionContext, type ValorSesion } from '../sesionContext'

export function useSesion(): ValorSesion {
  const valor = useContext(SesionContext)
  if (!valor) throw new Error('useSesion debe usarse dentro de SesionProvider.')
  return valor
}
