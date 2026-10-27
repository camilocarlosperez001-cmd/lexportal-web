import { useConsulta } from '../../../hooks/useConsulta'
import { documentosSinAceptar, listarAceptaciones, listarDocumentosLegales } from '../services/legales'

/** Aceptaciones del titular y documentos requeridos que aún no tienen aceptación registrada. */
export function useAceptaciones(cuentaId: string | null | undefined) {
  const consulta = useConsulta(async () => {
    if (!cuentaId) return { documentos: [], aceptaciones: [] }
    const [documentos, aceptaciones] = await Promise.all([listarDocumentosLegales(), listarAceptaciones(cuentaId)])
    return { documentos, aceptaciones }
  }, `aceptaciones:${cuentaId ?? 'sin-cuenta'}`)

  const documentos = consulta.datos?.documentos ?? []
  const aceptaciones = consulta.datos?.aceptaciones ?? []

  return {
    documentos,
    aceptaciones,
    pendientes: documentosSinAceptar(documentos, aceptaciones),
    cargando: consulta.cargando,
    error: consulta.error,
    recargar: consulta.recargar,
  }
}
