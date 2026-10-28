// Identidad y sesión (CU 01, 02, 04 y 16). Único punto de acceso a Supabase Auth
// para el alta de cuentas, el inicio y cierre de sesión y el restablecimiento de contraseña.

import { supabase } from '../../../lib/supabase'
import { AUTH_WEB_ORIGIN, AUTH_LINK_PATHS, type AuthLinkPurpose } from '../../../domain/authLinks'
import type { Json, Tables } from '../../../types/supabase'
import { validarContrasena } from '../../../utils/validaciones'
import { registrarAceptaciones } from '../../privacidad/services/legales'
import { listarAreas, listarRelacionesAreaTipoCaso, listarTiposCaso } from '../../catalogo/services/catalogo'
import {
  validarCredenciales,
  validarDeclaraciones,
  validarPerfilPublico,
  validarVerificacion,
  type CamposDeclaraciones,
  type CamposPerfilPublico,
  type CamposVerificacion,
} from '../types'

export type Cuenta = Tables<'cuentas'>

function authCallbackUrl(purpose: AuthLinkPurpose): string {
  const origin = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '') === 'https://kpksbvvzbjsugnxgphdw.supabase.co'
    ? AUTH_WEB_ORIGIN : window.location.origin
  return origin + AUTH_LINK_PATHS[purpose]
}

export async function obtenerCuenta(usuarioId: string): Promise<Cuenta> {
  const { data, error } = await supabase.from('cuentas').select('*').eq('id', usuarioId).maybeSingle()
  if (error) throw error
  if (!data) throw new Error('No encontramos una cuenta asociada a tu sesión.')
  return data
}

export async function iniciarSesion(correo: string, contrasena: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: correo.trim().toLowerCase(),
    password: contrasena,
  })
  if (error) throw error
}

export async function cerrarSesion(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function solicitarRecuperacion(correo: string): Promise<void> {
  // Ruta incluidas en additional_redirect_urls de supabase/config.toml.
  const { error } = await supabase.auth.resetPasswordForEmail(correo.trim().toLowerCase(), {
    redirectTo: authCallbackUrl('recovery'),
  })
  if (error) throw error
}

export async function actualizarContrasena(contrasena: string): Promise<void> {
  const problema = validarContrasena(contrasena)
  if (problema) throw new Error(problema)
  const { error } = await supabase.auth.updateUser({ password: contrasena })
  if (error) throw error
}

/**
 * Datos profesionales que se envían en los metadatos del alta (CU 02). Con la
 * confirmación por correo activa no hay sesión al registrarse, así que el perfil,
 * las declaraciones y la presentación verificable los crea el trigger
 * `handle_new_user` a partir de estos metadatos. Las evidencias en archivo se
 * adjuntan después de confirmar el correo, desde «Mi perfil profesional».
 *
 * Las claves son los nombres del esquema: es el contrato que lee
 * `crear_perfil_profesional_desde_metadatos`. Cualquier cambio aquí debe
 * acompañarse del cambio correspondiente en esa función.
 */
export type PerfilProfesionalRegistro = {
  nombre_profesional: string
  descripcion: string
  experiencia_anios: number
  ciudad_atencion: string
  formacion_declarada?: string | null
  foto_publica?: string | null
  modalidad?: string | null
  horarios?: string | null
  tarifas_orientativas?: string | null
  medios_contacto?: Json | null
  campos_opcionales_publicos?: Record<string, boolean>
  /**
   * Autorización expresa de publicación elegida en el registro. `publico` no expone el
   * perfil por sí solo: la búsqueda pública exige además verificación aprobada y perfil
   * activo. Sin el campo, el alta deja el perfil oculto.
   */
  visibilidad?: 'publico' | 'oculto'
  areas: string[]
  tipos_caso: string[]
  identificacion_privada: string
  tarjeta_profesional: string
}

export type DatosRegistro = {
  rol: 'ciudadano' | 'abogado'
  nombreCompleto: string
  correo: string
  contrasena: string
  telefono?: string
  documentoIds: string[]
  /** Presente sólo en el registro profesional. */
  perfilProfesional?: PerfilProfesionalRegistro
}

export type ResultadoRegistro = {
  usuarioId: string | null
  requiereConfirmacion: boolean
  /**
   * Confirma que el servidor guardó los datos profesionales en los metadatos. Si es
   * falso, el trigger del alta no puede crear el perfil y el alta debe completarse
   * después desde «Mi perfil profesional».
   */
  perfilRecibido: boolean
}

/** El servidor devuelve en `user_metadata` lo que realmente quedó almacenado. */
function metadatosConPerfil(usuario: { user_metadata?: Record<string, unknown> } | null | undefined): boolean {
  const perfil = usuario?.user_metadata?.perfil_profesional
  return typeof perfil === 'object' && perfil !== null
}

const CLAVES_MEDIOS_CONTACTO = ['correo', 'telefono', 'whatsapp', 'sitio_web'] as const

/** Medios de contacto del metadato jsonb, sólo con valores textuales. */
function mediosContactoDeJson(valor: Json | null | undefined): CamposDeclaraciones['mediosContacto'] {
  const medios = { correo: '', telefono: '', whatsapp: '', sitioWeb: '' }
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return medios
  for (const clave of CLAVES_MEDIOS_CONTACTO) {
    const contenido = valor[clave]
    if (typeof contenido !== 'string') continue
    if (clave === 'sitio_web') medios.sitioWeb = contenido
    else medios[clave] = contenido
  }
  return medios
}

/** Revalidación de la cuenta ciudadana con las mismas reglas del formulario. */
function validarCredencialesRegistro(datos: DatosRegistro) {
  return validarCredenciales({
    nombreCompleto: datos.nombreCompleto,
    correo: datos.correo,
    contrasena: datos.contrasena,
    confirmacion: datos.contrasena,
    telefono: datos.telefono ?? '',
  })
}

/** Adapta el metadato del alta profesional a las estructuras de los validadores. */
function validarPasoProfesional(perfil: PerfilProfesionalRegistro) {
  const perfilPublico: CamposPerfilPublico = {
    nombreProfesional: perfil.nombre_profesional,
    ciudadAtencion: perfil.ciudad_atencion,
    experienciaAnios: String(perfil.experiencia_anios),
    descripcion: perfil.descripcion,
    areaIds: perfil.areas,
    tipoCasoIds: perfil.tipos_caso,
  }
  const declaraciones: CamposDeclaraciones = {
    formacionDeclarada: perfil.formacion_declarada ?? '',
    modalidad: perfil.modalidad ?? '',
    horarios: perfil.horarios ?? '',
    tarifasOrientativas: perfil.tarifas_orientativas ?? '',
    mediosContacto: mediosContactoDeJson(perfil.medios_contacto),
    camposPublicos: perfil.campos_opcionales_publicos ?? {},
    ofrecerEnDirectorio: perfil.visibilidad === 'publico',
  }
  const verificacion: CamposVerificacion = {
    identificacionPrivada: perfil.identificacion_privada,
    tarjetaProfesional: perfil.tarjeta_profesional,
  }
  return { perfilPublico, declaraciones, verificacion }
}

/**
 * Revalida las credenciales y los cuatro pasos antes de llamar a Auth. Las reglas
 * puras se aplican primero; después se comprueba que las especialidades sigan en el
 * catálogo activo, igual que el formulario y la RPC de recuperación.
 */
async function revalidarRegistroProfesional(datos: DatosRegistro): Promise<void> {
  const perfil = datos.perfilProfesional
  if (!perfil) throw new Error('Revisa los campos del registro antes de enviarlo.')

  const { perfilPublico, declaraciones, verificacion } = validarPasoProfesional(perfil)
  const errores = {
    ...validarCredencialesRegistro(datos),
    ...validarPerfilPublico(perfilPublico),
    ...validarDeclaraciones(declaraciones),
    ...validarVerificacion(verificacion),
  }
  if (Object.keys(errores).length > 0) throw new Error('Revisa los campos del registro antes de enviarlo.')

  const [areas, tipos, relaciones] = await Promise.all([
    listarAreas({ soloActivas: true }),
    listarTiposCaso({ soloActivos: true }),
    listarRelacionesAreaTipoCaso(),
  ])
  const idsAreas = new Set(areas.map((area) => area.id))
  const idsTipos = new Set(tipos.map((tipo) => tipo.id))
  const areasSolicitadas = [...new Set(perfilPublico.areaIds)]
  const tiposSolicitados = [...new Set(perfilPublico.tipoCasoIds)]
  const especialidadInvalida =
    areasSolicitadas.some((id) => !idsAreas.has(id)) ||
    tiposSolicitados.some((id) => !idsTipos.has(id)) ||
    tiposSolicitados.some(
      (id) =>
        !relaciones.some(
          (relacion) => relacion.tipo_caso_id === id && areasSolicitadas.includes(relacion.area_id),
        ),
    )
  if (especialidadInvalida) {
    throw new Error('Alguna especialidad dejó de estar disponible. Revisa el perfil profesional e inténtalo de nuevo.')
  }
}

/**
 * Crea la cuenta de Auth. El trigger `handle_new_user` crea la fila en public.cuentas
 * con los metadatos (rol, nombre_completo, telefono), registra las aceptaciones
 * indicadas en `documentos_aceptados` y, en el registro profesional, crea el perfil
 * con sus declaraciones y la versión inicial pendiente a partir de
 * `perfil_profesional`. Con la confirmación por correo activa no hay sesión: por eso
 * esas escrituras no pueden hacerse desde el cliente y quedan a cargo del trigger.
 */
export async function registrarCuenta(datos: DatosRegistro): Promise<ResultadoRegistro> {
  if (datos.rol === 'abogado') {
    await revalidarRegistroProfesional(datos)
  } else {
    const errores = validarCredencialesRegistro(datos)
    if (Object.keys(errores).length > 0) throw new Error('Revisa los campos del registro antes de enviarlo.')
  }

  const { data, error } = await supabase.auth.signUp({
    email: datos.correo.trim().toLowerCase(),
    password: datos.contrasena,
    options: {
      emailRedirectTo: authCallbackUrl('signup'),
      data: {
        rol: datos.rol,
        nombre_completo: datos.nombreCompleto.trim(),
        telefono: datos.telefono?.trim() ? datos.telefono.trim() : null,
        documentos_aceptados: datos.documentoIds,
        perfil_profesional: datos.perfilProfesional ?? null,
      },
    },
  })
  if (error) throw error

  const usuarioId = data.user?.id ?? null
  if (data.session && usuarioId) {
    await registrarAceptaciones(usuarioId, datos.documentoIds)
  }
  return {
    usuarioId,
    requiereConfirmacion: data.session === null,
    perfilRecibido: metadatosConPerfil(data.user),
  }
}
