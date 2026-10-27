import { useConsulta } from '../../../hooks/useConsulta'
import { documentosVigentes, listarDocumentosLegales } from '../services/legales'

/** Documentos legales vigentes (última versión publicada de cada tipo). */
export function useDocumentosLegales() {
  const consulta = useConsulta(() => listarDocumentosLegales(), 'documentos-legales')
  return {
    documentos: consulta.datos ? documentosVigentes(consulta.datos) : [],
    cargando: consulta.cargando,
    error: consulta.error,
    recargar: consulta.recargar,
  }
}
