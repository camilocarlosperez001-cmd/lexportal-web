// Validaciones de formulario compartidas. Los mensajes se muestran junto al campo.
//
// Este módulo es la única política de registro y de perfil profesional: lo consumen
// los formularios y los servicios antes de llamar a Auth o de escribir en el contrato.
// No recorta valores: cuando un dato excede un límite se informa para que la persona
// lo corrija, de modo que un borrador o un perfil histórico nunca se truncan en silencio.

// Política de la aplicación, alineada con la aplicación móvil. Es más estricta que
// [auth].minimum_password_length de supabase/config.toml; no se modifica Auth.
export const LONGITUD_MINIMA_CONTRASENA = 8
export const LONGITUD_MAXIMA_RELATO = 1500

/** Límites compartidos con la aplicación móvil. */
export const LIMITES_REGISTRO = {
  nombre: 200,
  correo: 254,
  nombreProfesional: 200,
  ciudad: 200,
  descripcionMin: 50,
  descripcionMax: 500,
  formacion: 1000,
  horarios: 1000,
  tarifas: 500,
  sitioWeb: 2048,
  identificacionMin: 3,
  identificacionMax: 40,
  telefonoDigitosMin: 7,
  telefonoDigitosMax: 15,
  telefonoFormatoMax: 25,
  especialidadesMin: 1,
  especialidadesMax: 8,
} as const

/** Modalidades descriptivas admitidas por el contrato. */
export const MODALIDADES_ATENCION = ['Presencial', 'Virtual', 'Presencial y virtual'] as const

export const MENSAJE_CONTRASENA =
  'Usa al menos 8 caracteres, mayúscula, minúscula, número y símbolo. Los espacios no cuentan como símbolo.'

export type ReglaContrasena = {
  id: string
  label: string
  test: (valor: string) => boolean
}

/**
 * Reglas de contraseña compartidas por el registro, la recuperación de acceso y el
 * cambio de contraseña. Los espacios y las letras acentuadas no sustituyen al símbolo;
 * la contraseña no se recorta ni se normaliza.
 */
export const REGLAS_CONTRASENA: ReglaContrasena[] = [
  { id: 'length', label: '8+ caracteres', test: (valor) => valor.length >= LONGITUD_MINIMA_CONTRASENA },
  { id: 'case', label: 'Mayúscula y minúscula', test: (valor) => /[A-Z]/.test(valor) && /[a-z]/.test(valor) },
  { id: 'number', label: 'Al menos 1 número', test: (valor) => /[0-9]/.test(valor) },
  {
    id: 'special',
    label: 'Símbolo, por ejemplo @#$% (no espacios)',
    test: (valor) => /[\p{P}\p{S}]/u.test(valor),
  },
]

const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PATRON_IDENTIFICACION = new RegExp(
  `^[\\p{L}\\p{N} .-]{${LIMITES_REGISTRO.identificacionMin},${LIMITES_REGISTRO.identificacionMax}}$`,
  'u',
)

export function esContrasenaValida(valor: string): boolean {
  return REGLAS_CONTRASENA.every((regla) => regla.test(valor))
}

export function esCorreoValido(correo: string): boolean {
  const texto = correo.trim()
  return texto.length <= LIMITES_REGISTRO.correo && PATRON_CORREO.test(texto)
}

/** Nombre y apellido de la cuenta. Las longitudes se miden después de `trim`. */
export function validarNombreCompleto(valor: string): string | null {
  const nombre = valor.trim()
  if (!nombre) return 'Escribe nombre y apellido.'
  if (nombre.split(/\s+/).length < 2 || nombre.length > LIMITES_REGISTRO.nombre) {
    return `Escribe nombre y apellido, hasta ${LIMITES_REGISTRO.nombre} caracteres.`
  }
  return null
}

export function validarCorreo(valor: string): string | null {
  const correo = valor.trim()
  if (!correo) return 'Escribe tu correo electrónico.'
  if (!esCorreoValido(correo)) return `Escribe un correo válido de hasta ${LIMITES_REGISTRO.correo} caracteres.`
  return null
}

export function validarContrasena(valor: string): string | null {
  if (!valor) return 'Escribe una contraseña.'
  if (!esContrasenaValida(valor)) return MENSAJE_CONTRASENA
  return null
}

export function validarConfirmacion(contrasena: string, confirmacion: string): string | null {
  if (!confirmacion) return 'Confirma tu contraseña.'
  if (contrasena !== confirmacion) return 'Las contraseñas no coinciden.'
  return null
}

/**
 * Teléfono o WhatsApp opcional. El formato admite `+` inicial, espacios, paréntesis,
 * puntos y guiones; debe contener entre 7 y 15 dígitos y no superar 25 caracteres.
 */
export function validarTelefono(valor: string): string | null {
  const telefono = valor.trim()
  if (!telefono) return null
  const digitos = telefono.replace(/\D/g, '')
  const formatoValido = new RegExp(
    `^\\+?[\\d\\s().-]{${LIMITES_REGISTRO.telefonoDigitosMin},${LIMITES_REGISTRO.telefonoFormatoMax}}$`,
  ).test(telefono)
  if (
    !formatoValido ||
    digitos.length < LIMITES_REGISTRO.telefonoDigitosMin ||
    digitos.length > LIMITES_REGISTRO.telefonoDigitosMax
  ) {
    return 'Escribe un teléfono válido o deja el campo vacío.'
  }
  return null
}

/** Sitio web opcional: HTTP/HTTPS, dominio con punto y hasta 2048 caracteres. */
export function validarSitioWeb(valor: string): string | null {
  const sitio = valor.trim()
  if (!sitio) return null
  if (sitio.length > LIMITES_REGISTRO.sitioWeb) return `Máximo ${LIMITES_REGISTRO.sitioWeb} caracteres.`
  try {
    const url = new URL(sitio)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) throw new Error('inválida')
  } catch {
    return 'Escribe una dirección completa, por ejemplo https://tu-sitio.com.'
  }
  return null
}

export function validarNombreProfesional(valor: string): string | null {
  const nombre = valor.trim()
  if (!nombre || nombre.length > LIMITES_REGISTRO.nombreProfesional) {
    return `Escribe un nombre profesional de hasta ${LIMITES_REGISTRO.nombreProfesional} caracteres.`
  }
  return null
}

export function validarCiudad(valor: string): string | null {
  const ciudad = valor.trim()
  if (!ciudad || ciudad.length > LIMITES_REGISTRO.ciudad) {
    return `Escribe una ciudad de hasta ${LIMITES_REGISTRO.ciudad} caracteres.`
  }
  return null
}

/** Años de experiencia: de 1 a 3 dígitos, incluido cero. */
export function validarAniosExperiencia(valor: string): string | null {
  if (!/^\d{1,3}$/.test(valor)) return 'Escribe los años exactos de experiencia, incluido cero.'
  return null
}

export function validarDescripcionProfesional(valor: string): string | null {
  const texto = valor.trim()
  if (texto.length < LIMITES_REGISTRO.descripcionMin || texto.length > LIMITES_REGISTRO.descripcionMax) {
    return `Escribe entre ${LIMITES_REGISTRO.descripcionMin} y ${LIMITES_REGISTRO.descripcionMax} caracteres.`
  }
  return null
}

/**
 * Texto opcional. Cuenta la longitud completa del valor, sin `trim`, igual que su
 * límite de formulario y la restricción del contrato.
 */
export function validarTextoOpcional(valor: string, maximo: number): string | null {
  return valor.length > maximo ? `Máximo ${maximo} caracteres.` : null
}

export function validarModalidadAtencion(valor: string): string | null {
  if (valor && !(MODALIDADES_ATENCION as readonly string[]).includes(valor)) {
    return 'Selecciona una modalidad válida.'
  }
  return null
}

/** Identificación o tarjeta: 3 a 40 letras/números Unicode, espacios, puntos o guiones. */
export function validarIdentificacion(valor: string, etiqueta = 'el número'): string | null {
  if (!PATRON_IDENTIFICACION.test(valor.trim())) {
    return `Escribe ${etiqueta} con entre ${LIMITES_REGISTRO.identificacionMin} y ${LIMITES_REGISTRO.identificacionMax} letras, números, espacios, puntos o guiones.`
  }
  return null
}

export function validarEspecialidades(cantidad: number): string | null {
  if (cantidad < LIMITES_REGISTRO.especialidadesMin || cantidad > LIMITES_REGISTRO.especialidadesMax) {
    return 'Selecciona entre una y ocho especialidades.'
  }
  return null
}

export type MediosContactoValidables = {
  correo?: string | null
  telefono?: string | null
  whatsapp?: string | null
  sitio_web?: string | null
  /** Alias usado por el formulario de declaraciones del alta profesional. */
  sitioWeb?: string | null
  direccion?: string | null
}

export type DatosPracticaValidables = {
  nombreProfesional: string
  ciudadAtencion: string
  experienciaAnios: string | number
  descripcion: string
  formacionDeclarada?: string | null
  horarios?: string | null
  tarifasOrientativas?: string | null
  modalidad?: string | null
  mediosContacto?: MediosContactoValidables | null
}

export type ErroresPractica = {
  nombre?: string
  ciudad?: string
  experiencia?: string
  descripcion?: string
  formacion?: string
  horarios?: string
  tarifas?: string
  modalidad?: string
  correo?: string
  telefono?: string
  whatsapp?: string
  sitioWeb?: string
}

/**
 * Validación de los datos ordinarios y declarativos del perfil profesional. La usan
 * los formularios del perfil y los servicios antes de escribir en el contrato.
 */
export function validarPractica(datos: DatosPracticaValidables): ErroresPractica {
  const errores: ErroresPractica = {}

  const nombre = validarNombreProfesional(datos.nombreProfesional)
  if (nombre) errores.nombre = nombre

  const ciudad = validarCiudad(datos.ciudadAtencion)
  if (ciudad) errores.ciudad = ciudad

  const experiencia = validarAniosExperiencia(String(datos.experienciaAnios))
  if (experiencia) errores.experiencia = experiencia

  const descripcion = validarDescripcionProfesional(datos.descripcion)
  if (descripcion) errores.descripcion = descripcion

  const formacion = validarTextoOpcional(datos.formacionDeclarada ?? '', LIMITES_REGISTRO.formacion)
  if (formacion) errores.formacion = formacion

  const horarios = validarTextoOpcional(datos.horarios ?? '', LIMITES_REGISTRO.horarios)
  if (horarios) errores.horarios = horarios

  const tarifas = validarTextoOpcional(datos.tarifasOrientativas ?? '', LIMITES_REGISTRO.tarifas)
  if (tarifas) errores.tarifas = tarifas

  const modalidad = validarModalidadAtencion(datos.modalidad ?? '')
  if (modalidad) errores.modalidad = modalidad

  const correo = datos.mediosContacto?.correo?.trim() ?? ''
  if (correo) {
    const problema = validarCorreo(correo)
    if (problema) errores.correo = problema
  }

  const telefono = validarTelefono(datos.mediosContacto?.telefono ?? '')
  if (telefono) errores.telefono = telefono

  const whatsapp = validarTelefono(datos.mediosContacto?.whatsapp ?? '')
  if (whatsapp) errores.whatsapp = whatsapp

  const sitioWeb = datos.mediosContacto?.sitio_web ?? datos.mediosContacto?.sitioWeb ?? ''
  const problemaSitio = validarSitioWeb(sitioWeb)
  if (problemaSitio) errores.sitioWeb = problemaSitio

  return errores
}

export function validarTextoRequerido(valor: string, etiqueta: string, maximo = LONGITUD_MAXIMA_RELATO): string | null {
  const texto = valor.trim()
  if (!texto) return `Completa ${etiqueta}.`
  if (texto.length < 10) return `${etiqueta} debe tener al menos 10 caracteres.`
  if (texto.length > maximo) return `${etiqueta} no puede superar ${maximo} caracteres.`
  return null
}

export function validarEnteroNoNegativo(valor: string, etiqueta: string, maximo = 80): string | null {
  const texto = valor.trim()
  if (!texto) return `Ingresa ${etiqueta}.`
  if (!/^\d+$/.test(texto)) return `${etiqueta} debe ser un número entero.`
  const numero = Number(texto)
  if (numero < 0) return `${etiqueta} no puede ser negativo.`
  if (numero > maximo) return `${etiqueta} no puede superar ${maximo}.`
  return null
}

export function validarSeleccion(valor: string | null | undefined, etiqueta: string): string | null {
  if (!valor) return `Selecciona ${etiqueta}.`
  return null
}

export function validarArchivoEvidencia(archivo: File): string | null {
  const tiposPermitidos = ['application/pdf', 'image/jpeg', 'image/png']
  const limite = 10 * 1024 * 1024
  if (!tiposPermitidos.includes(archivo.type)) return 'Solo se admiten archivos PDF, JPEG o PNG.'
  if (archivo.size > limite) return 'El archivo no puede superar 10 MB.'
  return null
}
