// Estado de publicación del perfil profesional (CU 08 y CU 19).
//
// La búsqueda pública exige tres condiciones simultáneas: `visibilidad = 'publico'`,
// `activo = true` y `version_aprobada_id` no nulo. La aprobación administrativa solo
// escribe la versión aprobada y las fechas de verificación: no activa la publicación,
// porque esa decisión es del titular. Este hook detecta el caso frecuente de perfil
// aprobado que aún no aparece en el directorio.

import { useConsulta } from '../../../hooks/useConsulta'
import { cargarMiPerfil } from '../services/perfil'

export type EstadoPublicacion = {
  cargando: boolean
  error: string | null
  /** Verificación aprobada, pero el perfil no se ofrece en el directorio. */
  aprobadoSinPublicar: boolean
  /** Condición adicional de la búsqueda: un perfil inactivo tampoco se ofrece. */
  activo: boolean
  recargar: () => void
}

export function usePublicacionPerfil(cuentaId: string | null | undefined): EstadoPublicacion {
  const consulta = useConsulta(async () => {
    if (!cuentaId) return null
    const perfil = await cargarMiPerfil(cuentaId)
    if (!perfil) return null
    return {
      aprobado: Boolean(perfil.version_aprobada_id),
      publico: perfil.visibilidad === 'publico',
      activo: perfil.activo,
    }
  }, `publicacion-perfil:${cuentaId ?? 'sin-cuenta'}`)

  const datos = consulta.datos

  return {
    cargando: consulta.cargando,
    error: consulta.error,
    aprobadoSinPublicar: Boolean(datos?.aprobado && !datos?.publico),
    activo: datos?.activo ?? true,
    recargar: consulta.recargar,
  }
}
