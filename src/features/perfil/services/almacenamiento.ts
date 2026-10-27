// Única implementación del acceso a Storage del módulo de perfil (CU 02, 12, 19).
// - Evidencias de verificación: bucket privado `evidencias-privadas`, ruta bajo el
//   identificador del titular. La lectura exige autorización; nunca se publica.
// - Fotografía del perfil: bucket privado `perfiles-publicos`. Su lectura la autoriza
//   RLS (publicación, actividad, verificación aprobada y consentimiento del campo) y el
//   cliente la pide con `download`, representándola con una URL local revocable. Por eso
//   `foto_publica` guarda la RUTA del objeto, no una URL: una URL pública no serviría y
//   una firmada seguiría dando acceso tras retirar el consentimiento.
// Los demás servicios del módulo delegan aquí para no duplicar estas reglas.

import { supabase } from '../../../lib/supabase'
import type { Tables } from '../../../types/supabase'
import { validarArchivoEvidencia } from '../../../utils/validaciones'

export const BUCKET_EVIDENCIAS = 'evidencias-privadas'
export const BUCKET_PERFILES_PUBLICOS = 'perfiles-publicos'

/** Tamaño máximo de la fotografía publicable, coherente con el bucket. */
export const MAXIMO_BYTES_FOTOGRAFIA = 5 * 1024 * 1024
export const TIPOS_FOTOGRAFIA = ['image/jpeg', 'image/png']

export type EvidenciaRegistrada = Tables<'evidencias_privadas'>
export type ArchivoEvidencia = { archivo: File; tipo: string }

/** Tipos que admite `registrar_evidencia_profesional`. */
export const TIPOS_EVIDENCIA_PROFESIONAL = [
  'identificacion',
  'tarjeta_profesional',
  'soporte',
  'documento_adjunto',
] as const

export type TipoEvidenciaProfesional = (typeof TIPOS_EVIDENCIA_PROFESIONAL)[number]

function normalizarTipoEvidencia(tipo: string): TipoEvidenciaProfesional {
  return TIPOS_EVIDENCIA_PROFESIONAL.includes(tipo as TipoEvidenciaProfesional)
    ? (tipo as TipoEvidenciaProfesional)
    : 'soporte'
}
/** Ruta del objeto dentro del bucket; es lo que se persiste en `foto_publica`. */
export type FotografiaSubida = { ruta: string }

/** Nombre de archivo seguro: sin separadores de ruta, sin tildes y con marca de tiempo. */
export function nombreArchivoSeguro(nombre: string): string {
  const limpiar = (valor: string) =>
    valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^[._-]+/, '')

  const punto = nombre.lastIndexOf('.')
  const base = limpiar(punto > 0 ? nombre.slice(0, punto) : nombre).slice(0, 140) || 'archivo'
  const extension = punto > 0 ? limpiar(nombre.slice(punto + 1)).slice(0, 10) : ''
  const marca = Date.now()
  return extension ? `${base}-${marca}.${extension}` : `${base}-${marca}`
}

/**
 * Nombre único por carga: base saneada + marca de tiempo + token aleatorio + extensión.
 * La marca de tiempo sola no basta (dos archivos iguales seleccionados en el mismo
 * milisegundo colisionarían) y nunca se resuelve sobrescribiendo.
 */
export function nombreArchivoUnico(nombre: string): string {
  const base = nombreArchivoSeguro(nombre)
  const punto = base.lastIndexOf('.')
  const token = crypto.randomUUID().slice(0, 8)
  return punto > 0 ? `${base.slice(0, punto)}-${token}${base.slice(punto)}` : `${base}-${token}`
}

/** Tipo de evidencia derivado del nombre del archivo, para etiquetar el soporte. */
export function tipoDeEvidencia(nombre: string): string {
  const base = nombre.toLowerCase()
  if (base.includes('identificacion') || base.includes('cedula') || base.includes('identidad')) return 'identificacion'
  if (base.includes('tarjeta')) return 'tarjeta_profesional'
  return 'soporte'
}

/** El titular de la cuenta es el único que escribe en sus carpetas. */
async function exigirTitular(cuentaId: string): Promise<void> {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Necesitas una sesión iniciada para aportar archivos.')
  if (data.user.id !== cuentaId) throw new Error('Solo el titular de la cuenta puede aportar sus archivos.')
}

/**
 * Sube un soporte nuevo al bucket privado bajo `cuenta/versión/nombre-único` y lo registra
 * con `registrar_evidencia_profesional`, que exige que la versión siga pendiente y sea del
 * titular. Si el registro falla, se retira el objeto para no dejar archivos sin fila.
 */
export async function adjuntarEvidenciaProfesional(
  versionId: string,
  cuentaId: string,
  archivo: File,
  tipo: TipoEvidenciaProfesional,
): Promise<EvidenciaRegistrada> {
  const problema = validarArchivoEvidencia(archivo)
  if (problema) throw new Error(`${archivo.name}: ${problema}`)
  await exigirTitular(cuentaId)

  const ruta = `${cuentaId}/${versionId}/${nombreArchivoSeguro(archivo.name)}`
  const { error: errorSubida } = await supabase.storage
    .from(BUCKET_EVIDENCIAS)
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false })
  if (errorSubida) throw errorSubida

  const { data: evidenciaId, error: errorRegistro } = await supabase.rpc('registrar_evidencia_profesional', {
    p_version_id: versionId,
    p_ruta: ruta,
    p_tipo: tipo,
  })
  if (errorRegistro || !evidenciaId) {
    // La fila no quedó registrada: se retira el objeto para no dejar rastros sin contrato.
    await supabase.storage.from(BUCKET_EVIDENCIAS).remove([ruta])
    throw errorRegistro ?? new Error('No se pudo registrar la evidencia.')
  }

  const { data, error } = await supabase
    .from('evidencias_privadas')
    .select('id, version_id, tipo, ruta_storage_privada, aportada_en, retener_hasta')
    .eq('id', evidenciaId)
    .single()
  if (error || !data) throw error ?? new Error('No se pudo leer la evidencia registrada.')
  return data
}

async function subirEvidenciaIndividual(
  versionId: string,
  cuentaId: string,
  archivo: File,
  tipo: string,
): Promise<EvidenciaRegistrada> {
  return adjuntarEvidenciaProfesional(versionId, cuentaId, archivo, normalizarTipoEvidencia(tipo))
}

/**
 * Sube evidencias al bucket privado y registra cada fila en `evidencias_privadas`.
 * El tipo se deriva del nombre del archivo. No se generan URLs públicas ni firmadas.
 */
export async function subirEvidencias(
  versionId: string,
  cuentaId: string,
  archivos: File[],
): Promise<EvidenciaRegistrada[]> {
  if (archivos.length === 0) return []
  await exigirTitular(cuentaId)
  for (const archivo of archivos) {
    const problema = validarArchivoEvidencia(archivo)
    if (problema) throw new Error(`${archivo.name}: ${problema}`)
  }

  const registradas: EvidenciaRegistrada[] = []
  for (const archivo of archivos) {
    registradas.push(await subirEvidenciaIndividual(versionId, cuentaId, archivo, tipoDeEvidencia(archivo.name)))
  }
  return registradas
}

/** Igual que `subirEvidencias`, con el tipo indicado por el llamador para cada archivo. */
export async function subirEvidenciasTipadas(
  versionId: string,
  cuentaId: string,
  archivos: ArchivoEvidencia[],
): Promise<EvidenciaRegistrada[]> {
  if (archivos.length === 0) return []
  await exigirTitular(cuentaId)
  for (const { archivo } of archivos) {
    const problema = validarArchivoEvidencia(archivo)
    if (problema) throw new Error(`«${archivo.name}»: ${problema}`)
  }

  const registradas: EvidenciaRegistrada[] = []
  for (const { archivo, tipo } of archivos) {
    registradas.push(await subirEvidenciaIndividual(versionId, cuentaId, archivo, tipo))
  }
  return registradas
}

/**
 * Sube la fotografía del perfil al bucket privado bajo `{cuentaId}/foto/{perfilId}/` y
 * devuelve su ruta (nunca una URL). Se valida el tipo y
 * el tamaño antes de subir cualquier byte. No se genera ninguna URL: la lectura la
 * resuelve `download` bajo RLS y la vista usa una URL local revocable.
 */
export async function subirFotoPublica(
  cuentaId: string,
  perfilId: string,
  archivo: File,
): Promise<FotografiaSubida> {
  await exigirTitular(cuentaId)
  if (!TIPOS_FOTOGRAFIA.includes(archivo.type)) {
    throw new Error('La fotografía debe ser una imagen JPEG o PNG.')
  }
  if (archivo.size > MAXIMO_BYTES_FOTOGRAFIA) {
    throw new Error('La fotografía no puede superar 5 MB.')
  }

  const ruta = `${cuentaId}/foto/${perfilId}/${nombreArchivoUnico(archivo.name)}`
  const { error } = await supabase.storage
    .from(BUCKET_PERFILES_PUBLICOS)
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false })
  if (error) throw new Error('No se pudo cargar la fotografía del perfil. Inténtalo de nuevo.')

  return { ruta }
}

/** Retira un archivo subido cuando la escritura posterior en la base de datos falla. */
export async function eliminarArchivo(bucket: string, rutas: string[]): Promise<void> {
  if (rutas.length === 0) return
  await supabase.storage.from(bucket).remove(rutas)
}
