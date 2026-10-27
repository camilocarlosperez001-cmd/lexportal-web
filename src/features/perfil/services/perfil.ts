// Acceso al perfil propio del abogado y a su información de verificación (CU 02, 03, 12 y 18).
// La administración reutiliza estas consultas bajo rutas autorizadas.
//
// Separación de responsabilidades del contrato:
// - Datos ordinarios (nombre profesional, descripción, experiencia, ciudad, formación,
//   modalidad, horarios, tarifas y medios de contacto): el titular los edita aquí.
// - Datos verificables (identificación privada, tarjeta profesional y evidencias): se
//   presentan como una versión nueva y solo la revisión administrativa decide.
// - La versión aprobada vigente y la visibilidad no se tocan al presentar una versión nueva.

import { supabase } from '../../../lib/supabase'
import type { Json, Tables, TablesUpdate } from '../../../types/supabase'
import { CAMPOS_OPCIONALES, type ClaveCampoOpcional } from '../../../utils/contrato'
import type { VisibilidadPerfil } from '../../../utils/etiquetas'
import {
  validarArchivoEvidencia,
  validarEspecialidades,
  validarIdentificacion,
  validarPractica,
  type MediosContactoValidables,
} from '../../../utils/validaciones'
import {
  BUCKET_EVIDENCIAS,
  BUCKET_PERFILES_PUBLICOS,
  eliminarArchivo,
  nombreArchivoSeguro,
  subirEvidenciasTipadas,
  subirFotoPublica,
  type ArchivoEvidencia,
} from './almacenamiento'

export type PerfilAbogado = Tables<'perfiles_abogados'>
export type VersionProfesional = Tables<'versiones_profesionales'>
export type RevisionProfesional = Tables<'revisiones_profesionales'>
export type EvidenciaPrivada = Tables<'evidencias_privadas'>

// El bucket privado, el nombre seguro de archivo y el tipo de archivo de evidencia
// se definen una sola vez en el servicio de almacenamiento del módulo y se reexportan
// aquí para sus consumidores.
export { BUCKET_EVIDENCIAS, type ArchivoEvidencia }
export { nombreArchivoSeguro as nombreSeguro }

/** Tipo registrado en evidencias_privadas para las evidencias que aporta el abogado. */
export const TIPO_EVIDENCIA_DOCUMENTO = 'documento_adjunto'

/** Campos de public.cuentas que no se editan desde el perfil profesional. */
export const COLUMNAS_NO_EDITABLES_DESDE_PERFIL: (keyof PerfilAbogado)[] = [
  'id',
  'cuenta_id',
  'version_aprobada_id',
  'fecha_verificacion_vigente',
  'alcance_verificacion_vigente',
  'motivo_suspension',
  'suspendido_en',
  'activo',
  'visibilidad',
  'campos_opcionales_publicos',
]

/** Perfil de la cuenta autenticada. Devuelve null si la cuenta aún no tiene perfil. */
export async function cargarMiPerfil(cuentaId: string): Promise<PerfilAbogado | null> {
  const { data, error } = await supabase
    .from('perfiles_abogados')
    .select('*')
    .eq('cuenta_id', cuentaId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function cargarVersionesProfesionales(perfilId: string): Promise<VersionProfesional[]> {
  const { data, error } = await supabase
    .from('versiones_profesionales')
    .select('id, perfil_id, numero_version, identificacion_privada, tarjeta_profesional, estado_revision, presentada_en')
    .eq('perfil_id', perfilId)
    .order('numero_version', { ascending: false })
  if (error) throw error
  return data
}

export async function cargarRevisionesDeVersiones(versionIds: string[]): Promise<RevisionProfesional[]> {
  if (versionIds.length === 0) return []
  const { data, error } = await supabase
    .from('revisiones_profesionales')
    .select('*')
    .in('version_id', versionIds)
    .order('decidida_en', { ascending: false })
  if (error) throw error
  return data
}

export async function cargarEvidenciasDeVersion(versionId: string): Promise<EvidenciaPrivada[]> {
  const { data, error } = await supabase
    .from('evidencias_privadas')
    .select('id, version_id, tipo, ruta_storage_privada, aportada_en, retener_hasta')
    .eq('version_id', versionId)
  if (error) throw error
  return data
}

/** Evidencias de todas las versiones del perfil en una sola consulta (historial). */
export async function cargarEvidenciasDeVersiones(versionIds: string[]): Promise<EvidenciaPrivada[]> {
  if (versionIds.length === 0) return []
  const { data, error } = await supabase
    .from('evidencias_privadas')
    .select('id, version_id, tipo, ruta_storage_privada, aportada_en, retener_hasta')
    .in('version_id', versionIds)
    .order('aportada_en', { ascending: false })
  if (error) throw error
  return data
}

export async function cargarAreasDePerfil(perfilId: string): Promise<string[]> {
  const { data, error } = await supabase.from('perfil_area').select('area_id').eq('perfil_id', perfilId)
  if (error) throw error
  return data.map((fila) => fila.area_id)
}

export async function cargarTiposCasoDePerfil(perfilId: string): Promise<string[]> {
  const { data, error } = await supabase.from('perfil_tipo_caso').select('tipo_caso_id').eq('perfil_id', perfilId)
  if (error) throw error
  return data.map((fila) => fila.tipo_caso_id)
}

// ---------------------------------------------------------------------------
// Escrituras del titular sobre su propio perfil
// ---------------------------------------------------------------------------

/** Datos ordinarios del perfil: no son verificables y no sustituyen la versión aprobada. */
export type DatosOrdinariosPerfil = {
  nombreProfesional: string
  descripcion: string
  experienciaAnios: number
  ciudadAtencion: string
  formacionDeclarada?: string | null
  modalidad?: string | null
  horarios?: string | null
  tarifasOrientativas?: string | null
  mediosContacto?: { correo?: string; telefono?: string; whatsapp?: string; sitio_web?: string; direccion?: string } | null
}

const CLAVES_MEDIOS_CONTACTO = ['correo', 'telefono', 'whatsapp', 'sitio_web', 'direccion'] as const

/** medios_contacto es jsonb sin estructura declarada: se construye solo con pares textuales. */
export function mediosContactoAJson(medios: DatosOrdinariosPerfil['mediosContacto']): Json | null {
  if (!medios) return null
  const resultado: Record<string, string> = {}
  for (const clave of CLAVES_MEDIOS_CONTACTO) {
    const valor = medios[clave]
    if (typeof valor === 'string' && valor.trim()) resultado[clave] = valor.trim()
  }
  return Object.keys(resultado).length > 0 ? resultado : null
}

function textoONulo(valor: string | null | undefined): string | null {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null
}

/**
 * Revalida los datos de la práctica con la misma política del formulario antes de
 * escribir. Un perfil histórico que exceda un límite se rechaza para que la persona lo
 * corrija; nunca se recorta aquí.
 */
function exigirPracticaValida(datos: DatosOrdinariosPerfil): void {
  const errores = validarPractica({
    nombreProfesional: datos.nombreProfesional,
    ciudadAtencion: datos.ciudadAtencion,
    experienciaAnios: datos.experienciaAnios,
    descripcion: datos.descripcion,
    formacionDeclarada: datos.formacionDeclarada,
    horarios: datos.horarios,
    tarifasOrientativas: datos.tarifasOrientativas,
    modalidad: datos.modalidad,
    mediosContacto: datos.mediosContacto,
  })
  const [primero] = Object.values(errores)
  if (primero) throw new Error(primero)
}

/**
 * Actualiza los campos no verificables del perfil (CU 12). No incluye version_aprobada_id,
 * fecha_verificacion_vigente, alcance_verificacion_vigente ni visibilidad: esos valores los
 * fija la revisión administrativa y permanecen intactos mientras se revisa una versión nueva.
 */
export async function actualizarDatosOrdinarios(
  perfilId: string,
  datos: DatosOrdinariosPerfil,
): Promise<PerfilAbogado> {
  exigirPracticaValida(datos)

  const cambios: TablesUpdate<'perfiles_abogados'> = {
    nombre_profesional: datos.nombreProfesional.trim(),
    descripcion: datos.descripcion.trim(),
    experiencia_anios: datos.experienciaAnios,
    ciudad_atencion: datos.ciudadAtencion.trim(),
    formacion_declarada: textoONulo(datos.formacionDeclarada),
    modalidad: textoONulo(datos.modalidad),
    horarios: textoONulo(datos.horarios),
    tarifas_orientativas: textoONulo(datos.tarifasOrientativas),
    medios_contacto: mediosContactoAJson(datos.mediosContacto),
  }
  const { data, error } = await supabase
    .from('perfiles_abogados')
    .update(cambios)
    .eq('id', perfilId)
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('No se pudieron guardar los datos del perfil: la operación fue rechazada.')
  return data
}

/** Áreas jurídicas declaradas y tipos de caso atendidos (CU 06, 07 y 12). */
export async function actualizarAreasYTipos(
  perfilId: string,
  areaIds: string[],
  tipoCasoIds: string[],
): Promise<void> {
  const problemaAreas = validarEspecialidades(new Set(areaIds).size)
  if (problemaAreas) throw new Error(problemaAreas)
  const problemaTipos = validarEspecialidades(new Set(tipoCasoIds).size)
  if (problemaTipos) throw new Error(problemaTipos)

  const insertarAreas = areaIds.map((areaId) => ({ perfil_id: perfilId, area_id: areaId }))
  const insertarTipos = tipoCasoIds.map((tipoCasoId) => ({ perfil_id: perfilId, tipo_caso_id: tipoCasoId }))

  // Se inserta primero (ignorando duplicados) y se elimina después lo que ya no aplica:
  // así las declaraciones vigentes nunca quedan vacías si una de las dos operaciones falla.
  if (insertarAreas.length > 0) {
    const { error } = await supabase
      .from('perfil_area')
      .upsert(insertarAreas, { onConflict: 'perfil_id,area_id', ignoreDuplicates: true })
    if (error) throw error
  }
  if (insertarTipos.length > 0) {
    const { error } = await supabase
      .from('perfil_tipo_caso')
      .upsert(insertarTipos, { onConflict: 'perfil_id,tipo_caso_id', ignoreDuplicates: true })
    if (error) throw error
  }

  const borrarAreas = supabase.from('perfil_area').delete().eq('perfil_id', perfilId)
  const { error: errorAreas } = areaIds.length > 0
    ? await borrarAreas.not('area_id', 'in', `(${areaIds.join(',')})`)
    : await borrarAreas
  if (errorAreas) throw errorAreas

  const borrarTipos = supabase.from('perfil_tipo_caso').delete().eq('perfil_id', perfilId)
  const { error: errorTipos } = tipoCasoIds.length > 0
    ? await borrarTipos.not('tipo_caso_id', 'in', `(${tipoCasoIds.join(',')})`)
    : await borrarTipos
  if (errorTipos) throw errorTipos
}

/**
 * Carga las evidencias en el bucket privado bajo {cuentaId}/{versionId}/ y registra
 * cada archivo con `registrar_evidencia_profesional`. La implementación vive en el
 * servicio de almacenamiento del módulo; aquí sólo se adapta el tipo de entrada.
 * No se generan enlaces públicos: la lectura requiere autorización.
 */
export async function subirEvidencias(
  versionId: string,
  cuentaId: string,
  archivos: ArchivoEvidencia[],
): Promise<EvidenciaPrivada[]> {
  return subirEvidenciasTipadas(versionId, cuentaId, archivos)
}

/**
 * Prepara la versión pendiente de una presentación y devuelve su UUID (CU 02 y 12).
 *
 * La RPC `preparar_version_profesional` valida tarjeta e identificación (3 a 40
 * caracteres) y reutiliza una versión pendiente solo si **ambos** números coinciden: la
 * clave de reutilización es el par de números, no solo la tarjeta. Nunca modifica la
 * versión aprobada ni la identificación de una versión anterior, así que la aprobación
 * vigente sigue refiriéndose a la versión revisada.
 *
 * Omitir `p_identificacion` conserva la de la última versión: mantiene operativos los
 * flujos anteriores, pero no permite proponer una corrección del número.
 */
export async function prepararVersionProfesional(datos: {
  perfilId: string
  tarjetaProfesional: string
  identificacionPrivada: string
}): Promise<string> {
  const problemaTarjeta = validarIdentificacion(datos.tarjetaProfesional, 'el número de tu tarjeta profesional')
  if (problemaTarjeta) throw new Error(problemaTarjeta)
  const problemaIdentificacion = validarIdentificacion(
    datos.identificacionPrivada,
    'tu número de identificación',
  )
  if (problemaIdentificacion) throw new Error(problemaIdentificacion)

  const { data, error } = await supabase.rpc('preparar_version_profesional', {
    p_perfil_id: datos.perfilId,
    p_tarjeta: datos.tarjetaProfesional.trim(),
    p_identificacion: datos.identificacionPrivada.trim(),
  })
  if (error) throw error
  if (typeof data !== 'string' || data.trim().length === 0) {
    throw new Error('No se pudo preparar la versión profesional.')
  }
  return data
}
/** Visibilidad del perfil en el directorio (CU 08 y 19). */
export async function actualizarVisibilidad(perfilId: string, visibilidad: VisibilidadPerfil): Promise<void> {
  const { data, error } = await supabase
    .from('perfiles_abogados')
    .update({ visibilidad })
    .eq('id', perfilId)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('No se pudo guardar la visibilidad del perfil: la operación fue rechazada.')
  }
}

/**
 * Claves de campos opcionales autorizadas para publicación (CU 08 y 19). Solo se guardan
 * claves conocidas con valor true; un campo no autorizado se excluye de la presentación
 * pública aunque su contenido exista en el perfil.
 */
export async function actualizarCamposPublicos(perfilId: string, claves: ClaveCampoOpcional[]): Promise<void> {
  const permitidas = new Set<string>(CAMPOS_OPCIONALES.map((campo) => campo.clave))
  const campos: Record<string, Json> = {}
  for (const clave of claves) {
    if (permitidas.has(clave)) campos[clave] = true
  }
  const { data, error } = await supabase
    .from('perfiles_abogados')
    .update({ campos_opcionales_publicos: campos })
    .eq('id', perfilId)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('No se pudieron guardar los campos publicables: la operación fue rechazada.')
  }
}

/**
 * Nombres para mostrar de los perfiles profesionales con los que la cuenta participa
 * (CU 09 y CU 11).
 *
 * La lectura directa de `perfiles_abogados` está limitada al titular y a la
 * administración, así que la inclusión del perfil llega nula al ciudadano. La función del
 * servidor devuelve solo el nombre y solo de los abogados a los que esa cuenta envió una
 * solicitud (o de su propio perfil): no amplía la política RLS ni expone otras columnas.
 */
export async function nombresAbogadosParticipantes(perfilIds: string[]): Promise<Map<string, string>> {
  const unicos = [...new Set(perfilIds.filter((id) => Boolean(id)))]
  if (unicos.length === 0) return new Map()

  const { data, error } = await supabase.rpc('nombres_abogados_participantes', { p_perfiles: unicos })
  if (error) throw error

  const nombres = new Map<string, string>()
  for (const fila of data ?? []) {
    const nombre = typeof fila.nombre_profesional === 'string' ? fila.nombre_profesional.trim() : ''
    if (nombre) nombres.set(fila.perfil_id, nombre)
  }
  return nombres
}

/**
 * Fotografía del perfil (foto_publica). Se sube al bucket privado `perfiles-publicos` y
 * la columna conserva la RUTA del objeto: la lectura la autoriza RLS según publicación,
 * actividad, verificación y consentimiento, y el cliente la obtiene con `download` y una
 * URL local revocable. Sólo se publica si el titular autorizó el campo 'foto_publica' en
 * campos_opcionales_publicos.
 */
export async function actualizarFotoPublica(
  perfilId: string,
  cuentaId: string,
  archivo: File,
): Promise<PerfilAbogado> {
  const errorArchivo = validarArchivoEvidencia(archivo)
  if (errorArchivo) throw new Error(`Fotografía: ${errorArchivo}`)

  const { ruta } = await subirFotoPublica(cuentaId, perfilId, archivo)

  const { data, error } = await supabase
    .from('perfiles_abogados')
    .update({ foto_publica: ruta })
    .eq('id', perfilId)
    .select('*')
    .maybeSingle()
  if (error || !data) {
    // Resultado ambiguo: la escritura pudo aplicarse y fallar la lectura. Se relee la
    // referencia antes de decidir; nunca se borra el objeto nuevo si la columna ya lo
    // referencia. La compensación se limita al objeto recién creado, nunca a la anterior.
    const { data: confirmacion, error: errorConfirmacion } = await supabase
      .from('perfiles_abogados')
      .select('*')
      .eq('id', perfilId)
      .maybeSingle()
    if (confirmacion?.foto_publica === ruta) return confirmacion
    if (errorConfirmacion || !confirmacion) {
      // Ni siquiera la relectura permite saber qué ocurrió. Se conserva el objeto nuevo
      // (huérfano como máximo) antes que arriesgar una referencia vigente rota.
      throw new Error(
        'No se pudo confirmar si la fotografía quedó registrada. Actualiza el perfil antes de reintentar.',
      )
    }
    await eliminarArchivo(BUCKET_PERFILES_PUBLICOS, [ruta])
    throw error ?? new Error('No se pudo registrar la fotografía del perfil.')
  }

  return data
}

/** Resultado de intentar reconstruir el perfil profesional de la cuenta autenticada. */
export type RecuperacionPerfil =
  | { tipo: 'recuperado'; perfilId: string }
  | { tipo: 'requiere-formulario' }

function textoJson(valor: Json | undefined): string {
  return typeof valor === 'string' ? valor : ''
}

function mediosDeJson(valor: Json | undefined): MediosContactoValidables {
  const medios: MediosContactoValidables = {}
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return medios
  for (const clave of ['correo', 'telefono', 'whatsapp', 'sitio_web', 'direccion'] as const) {
    const contenido = valor[clave]
    if (typeof contenido === 'string') medios[clave] = contenido
  }
  return medios
}

/**
 * Revalida el cuerpo de la recuperación con las mismas reglas del formulario. Se aplica
 * solo cuando el cliente envía datos: el intento desde metadatos lo decide el servidor.
 */
function exigirPerfilRecuperacionValido(perfil: Json): void {
  if (typeof perfil !== 'object' || perfil === null || Array.isArray(perfil)) {
    throw new Error('Revisa los datos del perfil antes de recuperarlo.')
  }
  const datos = perfil as Record<string, Json | undefined>
  const experiencia = datos.experiencia_anios
  const errores = validarPractica({
    nombreProfesional: textoJson(datos.nombre_profesional),
    ciudadAtencion: textoJson(datos.ciudad_atencion),
    experienciaAnios: typeof experiencia === 'number' ? experiencia : textoJson(experiencia),
    descripcion: textoJson(datos.descripcion),
    formacionDeclarada: textoJson(datos.formacion_declarada),
    horarios: textoJson(datos.horarios),
    tarifasOrientativas: textoJson(datos.tarifas_orientativas),
    modalidad: textoJson(datos.modalidad),
    mediosContacto: mediosDeJson(datos.medios_contacto),
  })
  const [primero] = Object.values(errores)
  if (primero) throw new Error(primero)

  const problemaIdentificacion = validarIdentificacion(
    textoJson(datos.identificacion_privada),
    'tu número de identificación',
  )
  if (problemaIdentificacion) throw new Error(problemaIdentificacion)
  const problemaTarjeta = validarIdentificacion(
    textoJson(datos.tarjeta_profesional),
    'el número de tu tarjeta profesional',
  )
  if (problemaTarjeta) throw new Error(problemaTarjeta)

  const idsDe = (valor: Json | undefined): string[] =>
    Array.isArray(valor) ? valor.filter((elemento): elemento is string => typeof elemento === 'string') : []
  const problemaAreas = validarEspecialidades(new Set(idsDe(datos.areas)).size)
  if (problemaAreas) throw new Error(problemaAreas)
  const problemaTipos = validarEspecialidades(new Set(idsDe(datos.tipos_caso)).size)
  if (problemaTipos) throw new Error(problemaTipos)
}

/**
 * Recupera el perfil profesional propio con `recuperar_perfil_profesional` (SECURITY
 * DEFINER). Sirve para las altas que quedaron a medias porque el perfil se creaba con la
 * sesión aún sin confirmar.
 *
 * - Sin argumentos intenta reconstruirlo desde los metadatos del registro. Devuelve
 *   `requiere-formulario` (sin error) cuando faltan datos válidos o cuando el titular no
 *   ha aceptado las tres versiones legales vigentes: en ese caso el cliente debe pedirlos.
 * - Con datos envía solo `p_perfil` y los documentos aceptados. La cuenta destino y el rol
 *   los fija el servidor con `auth.uid()`; el cliente no puede cambiarlos.
 * - Si ya existe perfil, el servidor devuelve su identificador sin sobrescribirlo.
 */
export async function recuperarPerfilProfesional(datos?: {
  perfil: Json
  documentos: string[]
}): Promise<RecuperacionPerfil> {
  if (datos) exigirPerfilRecuperacionValido(datos.perfil)

  const { data, error } = await supabase.rpc(
    'recuperar_perfil_profesional',
    datos ? { p_perfil: datos.perfil, p_documentos: datos.documentos } : {},
  )
  if (error) throw error
  return typeof data === 'string' && data.trim().length > 0
    ? { tipo: 'recuperado', perfilId: data }
    : { tipo: 'requiere-formulario' }
}
