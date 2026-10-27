// Opciones de menú por rol. La administración reutiliza los módulos de dominio
// bajo un layout y rutas autorizadas; no duplica catálogo, privacidad ni verificación.

import type { LucideIcon } from 'lucide-react'
import {
  BadgeCheck,
  Bell,
  ChartColumn,
  CircleUserRound,
  ClipboardList,
  History,
  Inbox,
  Lock,
  MessageSquare,
  Search,
  ShieldCheck,
  Tags,
} from 'lucide-react'
import type { RolCuenta } from '../utils/etiquetas'

export type EnlaceMenu = {
  etiqueta: string
  ruta: string
  icono: LucideIcon
  descripcion?: string
}

export const ENLACES_PUBLICOS: EnlaceMenu[] = [
  { etiqueta: 'Directorio', ruta: '/directorio', icono: Search, descripcion: 'Búsqueda pública de abogados' },
]

const ENLACES_COMUNES: EnlaceMenu[] = [
  { etiqueta: 'Notificaciones', ruta: '/notificaciones', icono: Bell },
  { etiqueta: 'Mi cuenta', ruta: '/cuenta', icono: CircleUserRound },
]

export const ENLACES_CIUDADANO: EnlaceMenu[] = [
  { etiqueta: 'Mis solicitudes', ruta: '/solicitudes', icono: ClipboardList },
  { etiqueta: 'Mensajes', ruta: '/mensajes', icono: MessageSquare },
  ...ENLACES_COMUNES,
]

export const ENLACES_ABOGADO: EnlaceMenu[] = [
  { etiqueta: 'Solicitudes recibidas', ruta: '/solicitudes-recibidas', icono: Inbox },
  { etiqueta: 'Mi perfil profesional', ruta: '/mi-perfil', icono: BadgeCheck },
  { etiqueta: 'Mensajes', ruta: '/mensajes', icono: MessageSquare },
  ...ENLACES_COMUNES,
]

export const ENLACES_ADMIN: EnlaceMenu[] = [
  { etiqueta: 'Verificación', ruta: '/admin/verificacion', icono: ShieldCheck },
  { etiqueta: 'Revalidación', ruta: '/admin/revalidacion', icono: History },
  { etiqueta: 'Catálogo', ruta: '/admin/catalogo', icono: Tags },
  { etiqueta: 'Privacidad', ruta: '/admin/privacidad', icono: Lock },
  { etiqueta: 'Indicadores', ruta: '/admin/indicadores', icono: ChartColumn },
]

/** Administración y, además, las secciones ordinarias de la propia cuenta. */
export const ENLACES_ADMIN_PANEL: EnlaceMenu[] = [...ENLACES_ADMIN, ...ENLACES_COMUNES]

export function enlacesDePanel(rol: RolCuenta): EnlaceMenu[] {
  if (rol === 'abogado') return ENLACES_ABOGADO
  if (rol === 'administrador') {
    return [
      ...ENLACES_COMUNES,
      { etiqueta: 'Administración', ruta: '/admin/verificacion', icono: ShieldCheck },
    ]
  }
  return ENLACES_CIUDADANO
}

/** Ruta inicial sugerida después de iniciar sesión. */
export function rutaInicialPorRol(rol: RolCuenta): string {
  if (rol === 'abogado') return '/solicitudes-recibidas'
  if (rol === 'administrador') return '/admin/verificacion'
  return '/solicitudes'
}
