// Estado del alta profesional (CU 02) en una sola regla, reutilizada por el guardia de
// rutas, el aviso del panel y la pantalla de confirmación.
//
// Criterio: el abogado puede usar la plataforma cuando tiene una verificación aprobada
// vigente o una presentación completa (versión pendiente o en revisión, con al menos una
// evidencia adjunta). Así no queda encerrado mientras la administración revisa, y sólo se
// le pide completar lo que de verdad falta.

import { useConsulta } from '../../../hooks/useConsulta'
import type { EstadoRevisionProf } from '../../../utils/etiquetas'
import { cargarEvidenciasDeVersiones, cargarMiPerfil, cargarVersionesProfesionales } from '../services/perfil'

/** Estados que representan una presentación en curso, pendiente de decisión. */
const ESTADOS_EN_PRESENTACION: EstadoRevisionProf[] = ['pendiente', 'en_revision']

export type MotivoAltaIncompleta = 'sin-perfil' | 'sin-version' | 'sin-evidencias'

export type EstadoAltaProfesional = {
  cargando: boolean
  error: string | null
  /** El abogado debe pasar por «Completar perfil» antes de usar la plataforma. */
  requiereCompletar: boolean
  motivo: MotivoAltaIncompleta | null
  recargar: () => void
}

export function useAltaProfesional(cuentaId: string | null | undefined): EstadoAltaProfesional {
  const consulta = useConsulta(async () => {
    if (!cuentaId) return { motivo: null as MotivoAltaIncompleta | null }

    const perfil = await cargarMiPerfil(cuentaId)
    if (!perfil) return { motivo: 'sin-perfil' as MotivoAltaIncompleta }

    // Con verificación aprobada vigente no se bloquea: puede estar actualizando datos.
    if (perfil.version_aprobada_id) return { motivo: null }

    const versiones = await cargarVersionesProfesionales(perfil.id)
    const enPresentacion = versiones.filter((version) => ESTADOS_EN_PRESENTACION.includes(version.estado_revision))
    if (enPresentacion.length === 0) return { motivo: 'sin-version' as MotivoAltaIncompleta }

    const evidencias = await cargarEvidenciasDeVersiones(enPresentacion.map((version) => version.id))
    const versionesConEvidencia = new Set(evidencias.map((evidencia) => evidencia.version_id))
    const completa = enPresentacion.some((version) => versionesConEvidencia.has(version.id))

    return { motivo: completa ? null : ('sin-evidencias' as MotivoAltaIncompleta) }
  }, `alta-profesional:${cuentaId ?? 'sin-cuenta'}`)

  const motivo = consulta.datos?.motivo ?? null

  return {
    cargando: consulta.cargando,
    error: consulta.error,
    requiereCompletar: motivo !== null,
    motivo,
    recargar: consulta.recargar,
  }
}
