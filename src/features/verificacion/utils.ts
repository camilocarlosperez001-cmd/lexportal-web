// Utilidades de presentación del módulo de verificación (CU 03 y CU 18).
// Solo transforman datos del contrato para la interfaz; no inventan valores ausentes.

import { formatearFecha, formatearFechaHora } from '../../utils/fechas'
import type { FilaRevalidacion, PerfilEnRevision } from './services/verificacion'

/** Texto explícito cuando una fecha del contrato aún no tiene valor. */
export const SIN_REGISTRO = 'Sin registro'

export function textoFechaHora(valor: string | null | undefined): string {
  return formatearFechaHora(valor) ?? SIN_REGISTRO
}

export function textoFecha(valor: string | null | undefined): string {
  return formatearFecha(valor) ?? SIN_REGISTRO
}

/** Indica si el perfil conserva una versión aprobada previa a la que se revisa. */
export function tieneAprobadaPrevia(perfil: PerfilEnRevision, versionId: string): boolean {
  return Boolean(perfil.version_aprobada_id) && perfil.version_aprobada_id !== versionId
}

/** Agrupa las revalidaciones según su situación temporal o su decisión registrada. */
export function clasificarRevalidacion(fila: FilaRevalidacion): 'decidida' | 'vencida' | 'programada' {
  if (fila.revision.decidida_en) return 'decidida'
  if (fila.vencida) return 'vencida'
  return 'programada'
}
