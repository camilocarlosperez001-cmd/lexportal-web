// Transformaciones puras para las vistas de solicitudes (CU 09, 10 y 20).
// Los filtros y los contadores se calculan en el cliente sobre las filas ya autorizadas
// por RLS; no sustituyen la autorización del servidor.

import { ETIQUETA_ESTADO_SOLICITUD, type EstadoSolicitud } from '../../utils/etiquetas'

export const SIN_CLASIFICAR_ETIQUETA = 'Sin clasificar'
export const PERFIL_NO_DISPONIBLE = 'Perfil ya no disponible'

export type FiltroEstadoSolicitud = 'todas' | EstadoSolicitud
export type ContadorEstados = Record<EstadoSolicitud, number>

export type OpcionFiltroSolicitud = { valor: FiltroEstadoSolicitud; etiqueta: string }

const ESTADOS_SOLICITUD: EstadoSolicitud[] = ['pendiente', 'aceptada', 'rechazada', 'cancelada']

export const OPCIONES_FILTRO_SOLICITUD: OpcionFiltroSolicitud[] = [
  { valor: 'todas', etiqueta: 'Todas' },
  ...ESTADOS_SOLICITUD.map((estado) => ({ valor: estado, etiqueta: ETIQUETA_ESTADO_SOLICITUD[estado] })),
]

/** Contador por estado calculado en el cliente; los cuatro estados siempre están presentes. */
export function contarPorEstado(solicitudes: { estado: EstadoSolicitud }[]): ContadorEstados {
  const contador: ContadorEstados = { pendiente: 0, aceptada: 0, rechazada: 0, cancelada: 0 }
  for (const solicitud of solicitudes) contador[solicitud.estado] += 1
  return contador
}

export function filtrarPorEstado<T extends { estado: EstadoSolicitud }>(
  solicitudes: T[],
  filtro: FiltroEstadoSolicitud,
): T[] {
  if (filtro === 'todas') return solicitudes
  return solicitudes.filter((solicitud) => solicitud.estado === filtro)
}

export function textoFiltroEstado(filtro: FiltroEstadoSolicitud): string {
  return filtro === 'todas' ? 'todas' : ETIQUETA_ESTADO_SOLICITUD[filtro].toLowerCase()
}

export function esSolicitudPendiente(estado: EstadoSolicitud): boolean {
  return estado === 'pendiente'
}

/**
 * Tipo de caso declarado al enviar la solicitud. La instantánea `clasificacion_al_enviar`
 * se lee con `leerClasificacion`; la relación con `tipos_caso` conserva el nombre del
 * catálogo y puede faltar si el registro dejó de estar disponible.
 */
export function etiquetaTipoCaso(
  nombreEnCatalogo: string | null | undefined,
  tipoCasoDeclarado: string | null,
): string {
  const nombre = nombreEnCatalogo?.trim()
  if (nombre) return nombre
  const declarado = tipoCasoDeclarado?.trim()
  if (declarado) return declarado
  return SIN_CLASIFICAR_ETIQUETA
}
