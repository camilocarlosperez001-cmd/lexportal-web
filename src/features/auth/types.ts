// Tipos de formulario y validaciones puras del módulo de identidad
// (CU 01 registro de ciudadano, CU 02 registro de abogado, CU 04 acceso y CU 16 recuperación).

import type { Json } from '../../types/supabase'
import {
  LIMITES_REGISTRO,
  validarAniosExperiencia,
  validarCiudad,
  validarConfirmacion,
  validarContrasena,
  validarCorreo,
  validarDescripcionProfesional,
  validarIdentificacion,
  validarModalidadAtencion,
  validarNombreCompleto,
  validarNombreProfesional,
  validarSitioWeb,
  validarTelefono,
  validarTextoOpcional,
} from '../../utils/validaciones'

/** Destino interno de redirección: solo rutas del propio sitio. */
export function rutaInterna(valor: string | null | undefined): string | null {
  if (!valor) return null
  if (!valor.startsWith('/')) return null
  // '//host' y '/\host' apuntarían a otro origen.
  if (valor.startsWith('//') || valor.startsWith('/\\')) return null
  return valor
}

export type ErroresFormulario<Campo extends string> = Partial<Record<Campo, string>>

export type CamposCredenciales = {
  nombreCompleto: string
  correo: string
  contrasena: string
  confirmacion: string
  telefono: string
}

export type ErrorCredenciales = ErroresFormulario<keyof CamposCredenciales>

/** Validación común de los datos de cuenta (CU 01 y paso 1 de CU 02). */
export function validarCredenciales(campos: CamposCredenciales): ErrorCredenciales {
  const errores: ErrorCredenciales = {}
  const nombre = validarNombreCompleto(campos.nombreCompleto)
  if (nombre) errores.nombreCompleto = nombre
  const correo = validarCorreo(campos.correo)
  if (correo) errores.correo = correo
  const contrasena = validarContrasena(campos.contrasena)
  if (contrasena) errores.contrasena = contrasena
  const confirmacion = validarConfirmacion(campos.contrasena, campos.confirmacion)
  if (confirmacion) errores.confirmacion = confirmacion
  const telefono = validarTelefono(campos.telefono)
  if (telefono) errores.telefono = telefono
  return errores
}

export type CamposPerfilPublico = {
  nombreProfesional: string
  ciudadAtencion: string
  experienciaAnios: string
  descripcion: string
  areaIds: string[]
  tipoCasoIds: string[]
}

export type ErrorPerfilPublico = ErroresFormulario<Exclude<keyof CamposPerfilPublico, 'tipoCasoIds'>> & { tipoCasoIds?: string }

/** Paso 2 de CU 02: perfil público y clasificación declarada. */
export function validarPerfilPublico(campos: CamposPerfilPublico): ErrorPerfilPublico {
  const errores: ErrorPerfilPublico = {}
  const nombre = validarNombreProfesional(campos.nombreProfesional)
  if (nombre) errores.nombreProfesional = nombre
  const ciudad = validarCiudad(campos.ciudadAtencion)
  if (ciudad) errores.ciudadAtencion = ciudad
  const experiencia = validarAniosExperiencia(campos.experienciaAnios)
  if (experiencia) errores.experienciaAnios = experiencia
  const descripcion = validarDescripcionProfesional(campos.descripcion)
  if (descripcion) errores.descripcion = descripcion
  if (campos.areaIds.length === 0) errores.areaIds = 'Selecciona al menos un área jurídica.'
  if (campos.tipoCasoIds.length === 0) errores.tipoCasoIds = 'Selecciona al menos un tipo de caso.'
  if (
    campos.areaIds.length > LIMITES_REGISTRO.especialidadesMax ||
    campos.tipoCasoIds.length > LIMITES_REGISTRO.especialidadesMax
  ) {
    errores.tipoCasoIds = 'Selecciona entre una y ocho especialidades.'
  }
  return errores
}

export type CamposDeclaraciones = {
  formacionDeclarada: string
  modalidad: string
  horarios: string
  tarifasOrientativas: string
  mediosContacto: { correo: string; telefono: string; whatsapp: string; sitioWeb: string }
  camposPublicos: Record<string, boolean>
  /**
   * Autorización expresa para ofrecer el perfil en el directorio público (CU 08 y 19).
   * Se envía en los metadatos del alta y el trigger la aplica como `visibilidad`.
   * Marcarla NO publica nada por sí sola: la búsqueda exige además una verificación
   * aprobada y el perfil activo. El titular puede ocultarlo después desde Privacidad.
   */
  ofrecerEnDirectorio: boolean
}

export type ErrorDeclaraciones = ErroresFormulario<
  | 'formacionDeclarada'
  | 'horarios'
  | 'tarifasOrientativas'
  | 'correo'
  | 'telefono'
  | 'whatsapp'
  | 'sitioWeb'
  | 'modalidad'
> & { mediosContacto?: string }

/** Paso 3 de CU 02: las declaraciones son informativas y opcionales. */
export function validarDeclaraciones(campos: CamposDeclaraciones): ErrorDeclaraciones {
  const errores: ErrorDeclaraciones = {}

  const formacion = validarTextoOpcional(campos.formacionDeclarada, LIMITES_REGISTRO.formacion)
  if (formacion) errores.formacionDeclarada = formacion
  const horarios = validarTextoOpcional(campos.horarios, LIMITES_REGISTRO.horarios)
  if (horarios) errores.horarios = horarios
  const tarifas = validarTextoOpcional(campos.tarifasOrientativas, LIMITES_REGISTRO.tarifas)
  if (tarifas) errores.tarifasOrientativas = tarifas

  const modalidad = validarModalidadAtencion(campos.modalidad)
  if (modalidad) errores.modalidad = modalidad

  if (campos.camposPublicos.medios_contacto === true) {
    const alguno = Object.values(campos.mediosContacto).some((valor) => valor.trim().length > 0)
    if (!alguno) {
      errores.mediosContacto =
        'Autorizaste publicar tus medios de contacto, pero no indicaste ninguno. Completa al menos uno o desmarca la publicación.'
    }
  }

  const correo = validarCorreoOpcional(campos.mediosContacto.correo)
  if (correo) errores.correo = correo
  const telefono = validarTelefono(campos.mediosContacto.telefono)
  if (telefono) errores.telefono = telefono
  const whatsapp = validarTelefono(campos.mediosContacto.whatsapp)
  if (whatsapp) errores.whatsapp = whatsapp
  const sitio = validarSitioWeb(campos.mediosContacto.sitioWeb)
  if (sitio) errores.sitioWeb = sitio

  return errores
}

/** Correo de contacto opcional: vacío es válido; con valor se valida y se limita. */
function validarCorreoOpcional(valor: string): string | null {
  return valor.trim() ? validarCorreo(valor) : null
}

/** Paso 4 de CU 02: datos privados de verificación (identificación y tarjeta). */
export type CamposVerificacion = {
  identificacionPrivada: string
  tarjetaProfesional: string
}

export type ErrorVerificacion = ErroresFormulario<keyof CamposVerificacion>

/**
 * Paso 4 de CU 02: datos privados de verificación que sí pueden persistirse en el
 * registro (identificación y tarjeta profesional, que viajan en los metadatos y el
 * trigger del alta guarda en la versión inicial).
 *
 * Los soportes documentales NO se exigen aquí: el bucket privado sólo admite
 * escritura con la sesión del titular, y con la confirmación por correo activa esa
 * sesión no existe todavía. Se adjuntan después de activar la cuenta, desde
 * «Mi perfil profesional», a la versión que ya quedó registrada.
 */
export function validarVerificacion(campos: CamposVerificacion): ErrorVerificacion {
  const errores: ErrorVerificacion = {}
  const identificacion = validarIdentificacion(campos.identificacionPrivada, 'tu número de identificación')
  if (identificacion) errores.identificacionPrivada = identificacion
  const tarjeta = validarIdentificacion(campos.tarjetaProfesional, 'el número de tu tarjeta profesional')
  if (tarjeta) errores.tarjetaProfesional = tarjeta
  return errores
}

/** Metadatos de contacto validados antes de escribir el jsonb medios_contacto. */
export function mediosContactoJson(campos: CamposDeclaraciones['mediosContacto']): Json | null {
  const resultado: Record<string, string> = {}
  const correo = campos.correo.trim()
  const telefono = campos.telefono.trim()
  const whatsapp = campos.whatsapp.trim()
  const sitioWeb = campos.sitioWeb.trim()
  if (correo) resultado.correo = correo
  if (telefono) resultado.telefono = telefono
  if (whatsapp) resultado.whatsapp = whatsapp
  if (sitioWeb) resultado.sitio_web = sitioWeb
  return Object.keys(resultado).length > 0 ? resultado : null
}

/** Mensaje de error de credenciales inválidas (CU 04) frente a un fallo de red. */
export function mensajeDeAcceso(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const estado = (error as { status: unknown }).status
    if (estado === 400 || estado === 401) {
      return 'El correo o la contraseña no son correctos. Verifica tus datos e inténtalo de nuevo.'
    }
  }
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const codigo = (error as { code: unknown }).code
    if (codigo === 'invalid_credentials') {
      return 'El correo o la contraseña no son correctos. Verifica tus datos e inténtalo de nuevo.'
    }
    if (codigo === 'email_not_confirmed') {
      return 'Tu cuenta aún no tiene el correo confirmado. Abre el enlace que enviamos a tu buzón y vuelve a intentarlo.'
    }
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const mensaje = String((error as { message: unknown }).message).toLowerCase()
    if (mensaje.includes('invalid login credentials') || mensaje.includes('invalid credentials')) {
      return 'El correo o la contraseña no son correctos. Verifica tus datos e inténtalo de nuevo.'
    }
    if (mensaje.includes('email not confirmed')) {
      return 'Tu cuenta aún no tiene el correo confirmado. Abre el enlace que enviamos a tu buzón y vuelve a intentarlo.'
    }
    if (mensaje.includes('failed to fetch') || mensaje.includes('network')) {
      return 'No pudimos conectar con el servicio de acceso. Revisa tu conexión e inténtalo de nuevo.'
    }
  }
  return 'No pudimos iniciar sesión. Inténtalo de nuevo en unos momentos.'
}

/** Distingue un fallo de red de unas credenciales rechazadas (CU 04). */
export function esFalloDeRed(error: unknown): boolean {
  if (typeof error === 'object' && error !== null && 'name' in error) {
    const nombre = String((error as { name: unknown }).name)
    if (nombre === 'AuthRetryableFetchError') return true
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const mensaje = String((error as { message: unknown }).message).toLowerCase()
    return mensaje.includes('failed to fetch') || mensaje.includes('network')
  }
  return false
}
