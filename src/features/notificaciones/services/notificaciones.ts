// Avisos internos y preferencia de correo (CU 15).
// El cliente solo consulta y marca como leídas sus propias notificaciones: no existe
// política de inserción para el cliente, porque las generan los triggers de la base de
// datos al registrar una solicitud, una decisión, un mensaje o una revisión.

import { supabase } from '../../../lib/supabase'
import type { Tables } from '../../../types/supabase'
import type { EventoNotificacion, RolCuenta } from '../../../utils/etiquetas'

export type Notificacion = Tables<'notificaciones'>

/** Columnas de la notificación que se consultan y se muestran. */
export const CAMPOS_NOTIFICACION =
  'id, evento, creada_en, leida_en, estado_aviso_correo, solicitud_contacto_id, revision_id, mensaje_id, solicitud_privacidad_id' as const

/** Limita la bandeja a los avisos más recientes para no cargar historiales completos. */
export const LIMITE_AVISOS = 200

export type AvisoNotificacion = {
  id: string
  evento: EventoNotificacion
  /** Identificador de la solicitud, revisión, mensaje o petición asociada. */
  recurso_id: string | null
}

/** Recurso asociado al evento; `null` si el evento no expone un recurso abrible. */
export function recursoDelAviso(notificacion: Notificacion): AvisoNotificacion {
  const recurso =
    notificacion.evento === 'nuevo_mensaje'
      ? notificacion.mensaje_id
      : notificacion.evento === 'revision_resuelta'
        ? notificacion.revision_id
        : notificacion.evento === 'privacidad_resuelta'
          ? notificacion.solicitud_privacidad_id
          : notificacion.solicitud_contacto_id
  return { id: notificacion.id, evento: notificacion.evento, recurso_id: recurso }
}

export async function listarNotificaciones(destinatarioId: string): Promise<Notificacion[]> {
  const { data, error } = await supabase
    .from('notificaciones')
    .select(CAMPOS_NOTIFICACION)
    .eq('destinatario_id', destinatarioId)
    .order('creada_en', { ascending: false })
    .limit(LIMITE_AVISOS)
    .overrideTypes<Notificacion[], { merge: false }>()
  if (error) throw error
  return data
}

/**
 * Carga un aviso concreto. Lo usa el anuncio en vivo: el evento de Realtime solo aporta
 * el identificador, así que la fila se relee tipada en lugar de confiar en el payload.
 */
export async function cargarNotificacion(notificacionId: string): Promise<Notificacion | null> {
  const { data, error } = await supabase
    .from('notificaciones')
    .select(CAMPOS_NOTIFICACION)
    .eq('id', notificacionId)
    .maybeSingle()
    .overrideTypes<Notificacion | null, { merge: false }>()
  if (error) throw error
  return data
}

/**
 * Escucha los avisos nuevos del destinatario (CU 15). Realtime aplica RLS también a
 * `postgres_changes`, de modo que el canal nunca recibe filas ajenas; el filtro por
 * `destinatario_id` evita además despertar al cliente por ellas.
 *
 * Devuelve la función que cancela la suscripción: debe llamarse al desmontar y al
 * cambiar de sesión para no dejar canales abiertos con datos del usuario anterior.
 */
export function observarAvisos(
  destinatarioId: string,
  alRecibir: (notificacionId: string) => void,
  alFallar?: () => void,
): () => void {
  const canal = supabase
    .channel(`avisos_${destinatarioId}_${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notificaciones',
        filter: `destinatario_id=eq.${destinatarioId}`,
      },
      (evento) => {
        const fila: unknown = evento.new
        const id = fila && typeof fila === 'object' ? (fila as { id?: unknown }).id : null
        if (typeof id === 'string') alRecibir(id)
      },
    )
    .subscribe((estado) => {
      if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') alFallar?.()
    })

  return () => {
    void supabase.removeChannel(canal)
  }
}

/** Marca un aviso como leído. La política de actualización limita el cambio al destinatario. */
export async function marcarComoLeida(notificacionId: string): Promise<void> {
  const { error } = await supabase
    .from('notificaciones')
    .update({ leida_en: new Date().toISOString() })
    .eq('id', notificacionId)
  if (error) throw error
}

/** Marca como leídos los avisos pendientes del destinatario. */
export async function marcarTodasComoLeidas(destinatarioId: string): Promise<void> {
  const { error } = await supabase
    .from('notificaciones')
    .update({ leida_en: new Date().toISOString() })
    .eq('destinatario_id', destinatarioId)
    .is('leida_en', null)
  if (error) throw error
}

/** Preferencia de avisos por correo del titular de la cuenta. */
export async function actualizarAvisosCorreo(cuentaId: string, avisosCorreo: boolean): Promise<void> {
  const { error } = await supabase.from('cuentas').update({ avisos_correo: avisosCorreo }).eq('id', cuentaId)
  if (error) throw error
}

/**
 * Conversaciones en las que el usuario participa, a partir de los mensajes citados en
 * sus avisos. El acceso al contenido del chat exige ser participante de la solicitud:
 * recibir el aviso no habilita la conversación.
 */
export async function conversacionesDeAvisos(
  usuarioId: string,
  mensajeIds: string[],
): Promise<Set<string>> {
  if (mensajeIds.length === 0) return new Set()
  const { data, error } = await supabase
    .from('mensajes_texto')
    .select(`
      conversacion_id,
      conversaciones!inner (
        solicitudes_contacto!inner (
          ciudadano_id,
          perfiles_abogados ( cuenta_id )
        )
      )
    `)
    .in('id', mensajeIds)
    .overrideTypes<
      {
        conversacion_id: string
        conversaciones: {
          solicitudes_contacto: {
            ciudadano_id: string
            perfiles_abogados: { cuenta_id: string } | null
          } | null
        } | null
      }[],
      { merge: false }
    >()
  if (error) throw error
  return new Set(
    data
      .filter((fila) => {
        const solicitud = fila.conversaciones?.solicitudes_contacto
        return solicitud?.ciudadano_id === usuarioId || solicitud?.perfiles_abogados?.cuenta_id === usuarioId
      })
      .map((fila) => fila.conversacion_id),
  )
}

export type AvisoConEnlace = AvisoNotificacion & {
  /** Ruta del recurso cuando el evento lo permite y el recurso es del propio usuario. */
  url: string | null
  /** Aviso de mensaje nuevo: el enlace al chat exige ser participante. */
  exigeParticipacion: boolean
  /** Conversación citada por el aviso de mensaje, si el destinatario puede abrirla. */
  conversacion_id: string | null
}

/**
 * Resuelve el enlace del aviso. Los eventos de solicitud apuntan a la vista del
 * ciudadano o del abogado según el rol del destinatario; el aviso de mensaje nuevo
 * solo enlaza cuando el destinatario participa en la conversación, y la revisión y la
 * privacidad apuntan al recurso del propio usuario.
 */
export function avisosConEnlace(
  notificaciones: Notificacion[],
  rol: RolCuenta,
  conversacionesAbribles: Set<string>,
): AvisoConEnlace[] {
  return notificaciones.map((notificacion) => {
    const aviso = recursoDelAviso(notificacion)
    const id = aviso.recurso_id
    const esMensaje = aviso.evento === 'nuevo_mensaje'
    let url: string | null = null
    let conversacionId: string | null = null
    if (esMensaje) {
      conversacionId = id && conversacionesAbribles.has(id) ? id : null
      url = conversacionId ? `/mensajes/${conversacionId}` : '/mensajes'
    } else if (id) {
      if (aviso.evento === 'revision_resuelta') url = '/mi-perfil'
      else if (aviso.evento === 'privacidad_resuelta') url = '/privacidad'
      else url = rol === 'abogado' ? `/solicitudes-recibidas/${id}` : `/solicitudes/${id}`
    }
    return { ...aviso, url, exigeParticipacion: esMensaje, conversacion_id: conversacionId }
  })
}
