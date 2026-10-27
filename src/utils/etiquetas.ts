// Etiquetas legibles para los valores del contrato. Una sola fuente por enum.

import type { Enums } from '../types/supabase'

export type RolCuenta = Enums<'rol_cuenta'>
export type EstadoCuenta = Enums<'estado_cuenta'>
export type EstadoSolicitud = Enums<'estado_solicitud'>
export type EstadoRevisionProf = Enums<'estado_revision_prof'>
export type TipoRevisionProf = Enums<'tipo_revision_prof'>
export type EstadoPeticionPriv = Enums<'estado_peticion_priv'>
export type TipoPeticionPriv = Enums<'tipo_peticion_priv'>
export type TipoDocumentoLegal = Enums<'tipo_doc_legal'>
export type VisibilidadPerfil = Enums<'visibilidad_perfil'>
export type EventoNotificacion = Enums<'evento_noti'>
export type EstadoEnvioCorreo = Enums<'estado_envio_correo'>

export const ETIQUETA_ROL: Record<RolCuenta, string> = {
  ciudadano: 'Ciudadano',
  abogado: 'Abogado',
  administrador: 'Administrador',
}

export const ETIQUETA_ESTADO_CUENTA: Record<EstadoCuenta, string> = {
  activa: 'Cuenta activa',
  suspendida: 'Cuenta suspendida',
  inactiva: 'Cuenta inactiva',
}

export const ETIQUETA_ESTADO_SOLICITUD: Record<EstadoSolicitud, string> = {
  pendiente: 'Pendiente',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
}

export const ETIQUETA_ESTADO_REVISION: Record<EstadoRevisionProf, string> = {
  pendiente: 'Pendiente de revisión',
  en_revision: 'En revisión',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  requiere_correcciones: 'Requiere correcciones',
}

export const ETIQUETA_TIPO_REVISION: Record<TipoRevisionProf, string> = {
  inicial: 'Verificación inicial',
  revalidacion: 'Revalidación',
  reporte: 'Reporte',
}

export const ETIQUETA_ESTADO_PETICION: Record<EstadoPeticionPriv, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  resuelta: 'Resuelta',
}

export const ETIQUETA_TIPO_PETICION: Record<TipoPeticionPriv, string> = {
  acceso: 'Acceso a los datos',
  rectificacion: 'Rectificación',
  cancelacion: 'Cancelación',
  oposicion: 'Oposición',
  desactivacion: 'Desactivación del perfil',
  supresion: 'Supresión',
}

export const ETIQUETA_TIPO_DOCUMENTO: Record<TipoDocumentoLegal, string> = {
  terminos_condiciones: 'Términos y condiciones',
  politica_privacidad: 'Política de privacidad',
  tratamiento_datos: 'Autorización de tratamiento de datos',
}

export const ETIQUETA_VISIBILIDAD: Record<VisibilidadPerfil, string> = {
  publico: 'Visible en el directorio',
  oculto: 'Oculto al público',
}

export const ETIQUETA_ESTADO_ENVIO: Record<EstadoEnvioCorreo, string> = {
  no_aplica: 'Sin aviso por correo',
  pendiente: 'Aviso por correo pendiente',
  enviado: 'Aviso por correo enviado',
  fallido: 'El aviso por correo no pudo enviarse',
}

export const ETIQUETA_EVENTO: Record<EventoNotificacion, string> = {
  nueva_solicitud: 'Nueva solicitud de contacto',
  nuevo_mensaje: 'Nuevo mensaje',
  revision_resuelta: 'Resultado de la revisión profesional',
  privacidad_resuelta: 'Respuesta a tu petición de privacidad',
  solicitud_aceptada: 'Solicitud aceptada',
  solicitud_rechazada: 'Solicitud rechazada',
  perfil_suspendido: 'Perfil suspendido',
  solicitud_cancelada: 'Solicitud cancelada',
}

export const DESCRIPCION_EVENTO: Record<EventoNotificacion, string> = {
  nueva_solicitud: 'Recibiste una solicitud de contacto por tu perfil profesional.',
  nuevo_mensaje: 'Tienes un mensaje nuevo en una conversación habilitada.',
  revision_resuelta: 'Se registró una decisión sobre tu información profesional.',
  privacidad_resuelta: 'El responsable registró una resolución sobre tu petición.',
  solicitud_aceptada: 'El abogado aceptó tu solicitud; la conversación quedó habilitada.',
  solicitud_rechazada: 'El abogado rechazó tu solicitud. Puedes consultar el motivo registrado.',
  perfil_suspendido: 'Tu perfil dejó de mostrarse en el directorio público.',
  solicitud_cancelada: 'La solicitud fue cancelada por su propietario.',
}

/** Tipo de soporte privado de una versión profesional (columna `evidencias_privadas.tipo`). */
export const ETIQUETA_TIPO_EVIDENCIA: Record<string, string> = {
  identificacion: 'Identificación',
  tarjeta_profesional: 'Tarjeta profesional',
  soporte: 'Soporte',
  documento_adjunto: 'Documento adjunto',
}

/** Etiqueta legible del tipo de soporte; el contrato admite texto libre. */
export function etiquetaTipoEvidencia(tipo: string): string {
  return ETIQUETA_TIPO_EVIDENCIA[tipo] ?? tipo
}
