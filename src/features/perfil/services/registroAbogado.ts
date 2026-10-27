// Escrituras del alta profesional (CU 02). Todas exigen una sesión iniciada: las
// políticas RLS conceden la inserción únicamente al titular de la cuenta.
//
// Un registro pendiente no es un perfil aprobado: aquí nunca se fija la versión
// aprobada, la fecha de verificación ni su alcance, y tampoco se crean filas en
// revisiones_profesionales (su inserción corresponde a la administración). La
// visibilidad refleja la autorización del titular y, aun siendo 'publico', no expone
// el perfil: la búsqueda exige además una verificación aprobada y el perfil activo.

import { supabase } from '../../../lib/supabase'
import type { Json } from '../../../types/supabase'
import { CAMPOS_OPCIONALES, leerCamposPublicos } from '../../../utils/contrato'
import type { VisibilidadPerfil } from '../../../utils/etiquetas'
import {
  validarEspecialidades,
  validarIdentificacion,
  validarPractica,
  type MediosContactoValidables,
} from '../../../utils/validaciones'
import { type PerfilAbogado, type VersionProfesional } from './perfil'

/** Sesión ausente: sin titular identificado no puede escribirse nada. */
export const MENSAJE_SIN_SESION = 'Necesitas una sesión iniciada para completar este registro.'

export type DatosPerfilProfesional = {
  nombreProfesional: string
  descripcion: string
  experienciaAnios: number
  ciudadAtencion: string
  formacionDeclarada?: string | null
  fotoPublica?: string | null
  modalidad?: string | null
  horarios?: string | null
  tarifasOrientativas?: string | null
  mediosContacto?: Json | null
  camposPublicos: Record<string, boolean>
  /**
   * Autorización de publicación elegida por el titular (CU 08 y 19). Por defecto el
   * perfil nace oculto: `publico` no lo expone hasta que exista verificación aprobada.
   */
  visibilidad?: VisibilidadPerfil
}

export type DatosVersionInicial = {
  identificacionPrivada: string
  tarjetaProfesional: string
}

/** Identificador del usuario autenticado o un error explícito si no hay sesión. */
async function exigirSesion(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error(MENSAJE_SIN_SESION)
  return data.user.id
}

function textoOpcional(valor: string | null | undefined): string | null {
  const texto = valor?.trim()
  return texto ? texto : null
}

/**
 * Claves autorizadas a publicación (nunca null). Solo se consideran las claves
 * declaradas en CAMPOS_OPCIONALES y se normalizan a booleanos con leerCamposPublicos.
 */
function camposPublicosJson(campos: Record<string, boolean>): NonNullable<Json> {
  const declaradas: Record<string, Json | undefined> = {}
  for (const campo of CAMPOS_OPCIONALES) {
    if (campos[campo.clave] === true) declaradas[campo.clave] = true
  }
  return leerCamposPublicos(declaradas)
}

/** Datos de contacto: solo se conservan valores textuales no vacíos. */
function mediosContactoJson(medios: Json | null | undefined): Json | null {
  if (medios === null || medios === undefined) return null
  if (typeof medios !== 'object' || Array.isArray(medios)) return null
  const resultado: Record<string, string> = {}
  for (const [clave, valor] of Object.entries(medios)) {
    if (typeof valor === 'string' && valor.trim()) resultado[clave] = valor.trim()
  }
  return Object.keys(resultado).length > 0 ? resultado : null
}

/** Extrae los medios de contacto textuales del jsonb para revalidarlos. */
function mediosContactoValidables(medios: Json | null | undefined): MediosContactoValidables {
  const resultado: MediosContactoValidables = {}
  if (medios === null || medios === undefined || typeof medios !== 'object' || Array.isArray(medios)) {
    return resultado
  }
  for (const clave of ['correo', 'telefono', 'whatsapp', 'sitio_web', 'direccion'] as const) {
    const valor = medios[clave]
    if (typeof valor === 'string') resultado[clave] = valor
  }
  return resultado
}

/** Revalida la práctica con la política común antes de insertar el perfil. */
function exigirPerfilValido(datos: DatosPerfilProfesional): void {
  const errores = validarPractica({
    nombreProfesional: datos.nombreProfesional,
    ciudadAtencion: datos.ciudadAtencion,
    experienciaAnios: datos.experienciaAnios,
    descripcion: datos.descripcion,
    formacionDeclarada: datos.formacionDeclarada,
    horarios: datos.horarios,
    tarifasOrientativas: datos.tarifasOrientativas,
    modalidad: datos.modalidad,
    mediosContacto: mediosContactoValidables(datos.mediosContacto),
  })
  const [primero] = Object.values(errores)
  if (primero) throw new Error(primero)
}

/**
 * Crea el perfil profesional de la cuenta autenticada. La visibilidad refleja la
 * autorización del titular (oculta si no la dio) y el perfil nace sin referencias de
 * verificación: la publicación efectiva depende de la revisión administrativa.
 */
export async function crearPerfilAbogado(cuentaId: string, datos: DatosPerfilProfesional): Promise<PerfilAbogado> {
  const usuarioId = await exigirSesion()
  if (usuarioId !== cuentaId) throw new Error('Solo el titular de la cuenta puede registrar su perfil profesional.')
  exigirPerfilValido(datos)

  const { data, error } = await supabase
    .from('perfiles_abogados')
    .insert({
      cuenta_id: cuentaId,
      nombre_profesional: datos.nombreProfesional.trim(),
      descripcion: datos.descripcion.trim(),
      experiencia_anios: datos.experienciaAnios,
      ciudad_atencion: datos.ciudadAtencion.trim(),
      activo: true,
      visibilidad: datos.visibilidad ?? 'oculto',
      formacion_declarada: textoOpcional(datos.formacionDeclarada),
      foto_publica: textoOpcional(datos.fotoPublica),
      modalidad: textoOpcional(datos.modalidad),
      horarios: textoOpcional(datos.horarios),
      tarifas_orientativas: textoOpcional(datos.tarifasOrientativas),
      medios_contacto: mediosContactoJson(datos.mediosContacto),
      campos_opcionales_publicos: camposPublicosJson(datos.camposPublicos),
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

/** Declara áreas jurídicas y tipos de caso atendidos por el perfil. */
export async function declararAreasYTipos(perfilId: string, areaIds: string[], tipoCasoIds: string[]): Promise<void> {
  await exigirSesion()

  const problemaAreas = validarEspecialidades(new Set(areaIds).size)
  if (problemaAreas) throw new Error(problemaAreas)
  const problemaTipos = validarEspecialidades(new Set(tipoCasoIds).size)
  if (problemaTipos) throw new Error(problemaTipos)

  if (areaIds.length > 0) {
    const filas = areaIds.map((areaId) => ({ perfil_id: perfilId, area_id: areaId }))
    const { error } = await supabase.from('perfil_area').upsert(filas, { onConflict: 'perfil_id,area_id', ignoreDuplicates: true })
    if (error) throw error
  }

  if (tipoCasoIds.length > 0) {
    const filas = tipoCasoIds.map((tipoCasoId) => ({ perfil_id: perfilId, tipo_caso_id: tipoCasoId }))
    const { error } = await supabase
      .from('perfil_tipo_caso')
      .upsert(filas, { onConflict: 'perfil_id,tipo_caso_id', ignoreDuplicates: true })
    if (error) throw error
  }
}

/**
 * Presenta la primera versión profesional con los datos privados de identificación.
 * Queda en estado 'pendiente'; la decisión y el alcance los registra la administración.
 */
export async function presentarVersionInicial(
  perfilId: string,
  datos: DatosVersionInicial,
): Promise<VersionProfesional> {
  await exigirSesion()

  const problemaIdentificacion = validarIdentificacion(
    datos.identificacionPrivada,
    'tu número de identificación',
  )
  if (problemaIdentificacion) throw new Error(problemaIdentificacion)
  const problemaTarjeta = validarIdentificacion(datos.tarjetaProfesional, 'el número de tu tarjeta profesional')
  if (problemaTarjeta) throw new Error(problemaTarjeta)

  const { data, error } = await supabase
    .from('versiones_profesionales')
    .insert({
      perfil_id: perfilId,
      numero_version: 1,
      identificacion_privada: datos.identificacionPrivada.trim(),
      tarjeta_profesional: datos.tarjetaProfesional.trim(),
      estado_revision: 'pendiente',
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

// El nombre de archivo seguro y la carga de evidencias se implementan una sola vez
// en el servicio de almacenamiento del módulo; aquí sólo se reexportan para el
// asistente de registro.
export { nombreArchivoSeguro, subirEvidencias } from './almacenamiento'

