// Documentos legales y aceptaciones (CU 01, 02, 19).
// Las aceptaciones quedan vinculadas a la versión del documento aceptada.

import { supabase } from '../../../lib/supabase'
import type { Tables } from '../../../types/supabase'
import type { TipoDocumentoLegal } from '../../../utils/etiquetas'

export type DocumentoLegal = Tables<'documentos_legales'>
export type AceptacionLegal = Tables<'aceptaciones_legales'>

/** Documentos cuya aceptación se exige al crear una cuenta. */
export const TIPOS_DOCUMENTO_REQUERIDOS: TipoDocumentoLegal[] = [
  'terminos_condiciones',
  'politica_privacidad',
  'tratamiento_datos',
]

export async function listarDocumentosLegales(): Promise<DocumentoLegal[]> {
  const { data, error } = await supabase
    .from('documentos_legales')
    .select('id, tipo, version, referencia_contenido, publicada_en')
    .order('publicada_en', { ascending: false })
  if (error) throw error
  return data
}

/** Última versión publicada por cada tipo de documento. */
export function documentosVigentes(documentos: DocumentoLegal[]): DocumentoLegal[] {
  const vigentes = new Map<TipoDocumentoLegal, DocumentoLegal>()
  for (const documento of documentos) {
    const actual = vigentes.get(documento.tipo)
    if (!actual || new Date(documento.publicada_en) > new Date(actual.publicada_en)) {
      vigentes.set(documento.tipo, documento)
    }
  }
  return [...vigentes.values()]
}

export async function listarAceptaciones(cuentaId: string): Promise<AceptacionLegal[]> {
  const { data, error } = await supabase
    .from('aceptaciones_legales')
    .select('cuenta_id, documento_id, aceptada_en')
    .eq('cuenta_id', cuentaId)
  if (error) throw error
  return data
}

export async function registrarAceptaciones(cuentaId: string, documentoIds: string[]): Promise<void> {
  if (documentoIds.length === 0) return
  const filas = documentoIds.map((documentoId) => ({ cuenta_id: cuentaId, documento_id: documentoId }))
  const { error } = await supabase
    .from('aceptaciones_legales')
    .upsert(filas, { onConflict: 'cuenta_id,documento_id', ignoreDuplicates: true })
  if (error) throw error
}

/** Documentos requeridos cuya versión vigente aún no tiene aceptación registrada. */
export function documentosSinAceptar(
  documentos: DocumentoLegal[],
  aceptaciones: AceptacionLegal[],
  requeridos: TipoDocumentoLegal[] = TIPOS_DOCUMENTO_REQUERIDOS,
): DocumentoLegal[] {
  const aceptados = new Set(aceptaciones.map((aceptacion) => aceptacion.documento_id))
  return documentosVigentes(documentos).filter(
    (documento) => requeridos.includes(documento.tipo) && !aceptados.has(documento.id),
  )
}
