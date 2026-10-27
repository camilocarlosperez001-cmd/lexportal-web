import { createContext } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Cuenta } from './services/auth'

export type EstadoSesion = 'cargando' | 'sin-sesion' | 'con-sesion' | 'error'

export type ValorSesion = {
  estado: EstadoSesion
  usuario: User | null
  cuenta: Cuenta | null
  error: string | null
  recargar: () => Promise<void>
  cerrarSesion: () => Promise<void>
}

export const SesionContext = createContext<ValorSesion | null>(null)
