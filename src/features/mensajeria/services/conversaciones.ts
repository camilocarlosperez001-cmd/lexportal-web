// Conversaciones de la mensajería interna (CU 11).
// Una conversación existe por cada solicitud aceptada y agrupa mensajes de texto
// entre el ciudadano propietario y el abogado destinatario. La participación se
// vuelve a comprobar con los datos consultados: la política de lectura permite al
// administrador ver las filas, pero el acceso administrativo no es un acceso
// ordinario al contenido del chat.

import { supabase } from '../../../lib/supabase'
import type { Json, Tables } from '../../../types/supabase'
import type { EstadoSolicitud } from '../../../utils/etiquetas'
import { nombresAbogadosParticipantes } from '../../perfil/services/perfil'

export type Conversacion = Tables<'conversaciones'>

/** Resumen del abogado participante. `cuenta_id` decide la participación del abogado. */
export type PerfilParticipante = Pick<Tables<'perfiles_abogados'>, 'id' | 'cuenta_id' | 'nombre_profesional'>

/** Datos de la solicitud que habilitó la conversación. */
export type SolicitudConversacion = Pick<Tables<'solicitudes_contacto'>, 'id' | 'ciudadano_id' | 'estado'> & {
  perfiles_abogados: PerfilParticipante | null
}

/** Último mensaje disponible; su contenido se recorta antes de mostrarlo en listas. */
export type UltimoMensaje = Pick<Tables<'mensajes_texto'>, 'contenido' | 'enviado_en' | 'autor_id'>

export type ConversacionResumen = {
  id: string
  habilitada_en: string
  perfil: PerfilParticipante | null
  /**
   * Nombre del abogado para mostrar. La inclusión del perfil solo es legible por su
   * titular y por la administración, así que al ciudadano se le completa con la
   * proyección acotada a participantes.
   */
  nombre_abogado: string | null
  /** Nombre de la cuenta del ciudadano participante; no se expone en listados públicos. */
  nombre_ciudadano: string | null
  tipo_caso: string | null
  estado_solicitud: EstadoSolicitud
  ultimo_mensaje: UltimoMensaje | null
}

// Los mensajes se incluyen directamente desde la conversación: `mensajes_texto`
// apunta a `conversaciones` con una sola clave foránea y una conversación tiene muchos
// mensajes, así que PostgREST los devuelve como arreglo.
//
// NO se vuelve a incluir `conversaciones` a través de `solicitudes_contacto`: como
// `conversaciones.solicitud_id` es único (relación uno-a-uno `chat_sol_fk`), PostgREST
// devolvería un objeto y no un arreglo —es la misma conversación de la fila exterior—,
// lo que provocaba errores al tratarlo como lista.
const CAMPOS_CONVERSACION = `
  id,
  habilitada_en,
  solicitudes_contacto!inner (
    id,
    ciudadano_id,
    abogado_perfil_id,
    estado,
    perfiles_abogados ( id, cuenta_id, nombre_profesional ),
    tipos_caso ( nombre_cotidiano ),
    cuentas!sol_ciu_fk ( nombre_completo )
  ),
  mensajes_texto ( contenido, enviado_en, autor_id )
` as const

const CAMPOS_CONVERSACION_DIRECTA = `
  id,
  habilitada_en,
  solicitud_id,
  solicitudes_contacto!inner (
    id,
    ciudadano_id,
    abogado_perfil_id,
    estado,
    perfiles_abogados ( id, cuenta_id, nombre_profesional ),
    tipos_caso ( nombre_cotidiano ),
    cuentas!sol_ciu_fk ( nombre_completo )
  ),
  mensajes_texto ( contenido, enviado_en, autor_id )
` as const

type TipoCasoEmbebido = { nombre_cotidiano: string } | null
/**
 * Cuenta embebida del ciudadano. La política de lectura de public.cuentas sólo
 * permite ver la fila propia o todas si es administración, de modo que para el
 * abogado destinatario esta relación llega como null: la bandeja muestra una
 * etiqueta neutra y nunca la identidad del solicitante.
 */
type CuentaEmbebida = { nombre_completo: string } | null

/** Fila de conversación con la solicitud, el perfil profesional y sus mensajes. */
type FilaConversacion = {
  id: string
  habilitada_en: string
  solicitud_id: string
  solicitudes_contacto: {
    id: string
    ciudadano_id: string
    abogado_perfil_id: string
    estado: EstadoSolicitud
    perfiles_abogados: PerfilParticipante | null
    tipos_caso: TipoCasoEmbebido
    cuentas: CuentaEmbebida
  } | null
  /** Una conversación tiene muchos mensajes: siempre llega como arreglo. */
  mensajes_texto: UltimoMensaje[]
}

type FilaConversacionListado = Omit<FilaConversacion, 'solicitud_id'>

const LONGITUD_RECORTE_ULTIMO_MENSAJE = 140

/** Recorta el último mensaje para la lista; el contenido íntegro solo se ve en la conversación. */
export function recortarUltimoMensaje(contenido: string, maximo = LONGITUD_RECORTE_ULTIMO_MENSAJE): string {
  const limpio = contenido.replace(/\s+/g, ' ').trim()
  return limpio.length > maximo ? `${limpio.slice(0, maximo).trimEnd()}…` : limpio
}

function ultimoMensaje(mensajes: UltimoMensaje[]): UltimoMensaje | null {
  let reciente: UltimoMensaje | null = null
  for (const mensaje of mensajes) {
    if (!reciente || new Date(mensaje.enviado_en).getTime() > new Date(reciente.enviado_en).getTime()) {
      reciente = mensaje
    }
  }
  return reciente
}

function resumir(
  fila: FilaConversacion | FilaConversacionListado,
  nombres: Map<string, string>,
): ConversacionResumen | null {
  const solicitud = fila.solicitudes_contacto
  if (!solicitud) return null
  const mensajes = fila.mensajes_texto ?? []
  return {
    id: fila.id,
    habilitada_en: fila.habilitada_en,
    perfil: solicitud.perfiles_abogados,
    // Al ciudadano la inclusión llega nula: se completa con la proyección de participantes.
    nombre_abogado:
      solicitud.perfiles_abogados?.nombre_profesional ?? nombres.get(solicitud.abogado_perfil_id) ?? null,
    nombre_ciudadano: solicitud.cuentas?.nombre_completo ?? null,
    tipo_caso: solicitud.tipos_caso?.nombre_cotidiano ?? null,
    estado_solicitud: solicitud.estado,
    ultimo_mensaje: ultimoMensaje(mensajes),
  }
}

/** Nombres de los perfiles cuya inclusión no llega legible, en una sola consulta. */
async function nombresDePerfiles(
  filas: (FilaConversacion | FilaConversacionListado)[],
): Promise<Map<string, string>> {
  const faltantes = filas
    .filter((fila) => !fila.solicitudes_contacto?.perfiles_abogados)
    .map((fila) => fila.solicitudes_contacto?.abogado_perfil_id ?? '')
    .filter(Boolean)
  return faltantes.length > 0 ? nombresAbogadosParticipantes(faltantes) : new Map<string, string>()
}

/** El usuario participa si es el ciudadano de la solicitud o la cuenta del perfil destinatario. */
function participa(solicitud: SolicitudConversacion | null, usuarioId: string): boolean {
  if (!solicitud) return false
  return solicitud.ciudadano_id === usuarioId || solicitud.perfiles_abogados?.cuenta_id === usuarioId
}

/** Perfiles profesionales del usuario; sus solicitudes son las que recibe como abogado. */
async function perfilesDeCuenta(usuarioId: string): Promise<string[]> {
  const { data, error } = await supabase.from('perfiles_abogados').select('id').eq('cuenta_id', usuarioId)
  if (error) throw error
  return data.map((perfil) => perfil.id)
}

/**
 * Conversaciones visibles para el usuario con su contexto de solicitud, perfil
 * profesional, tipo de caso, estado y último mensaje. La consulta se limita a las
 * solicitudes donde participa (ciudadano propietario o perfil del abogado
 * destinatario) y la participación se revalida con las filas recibidas, de modo que
 * el acceso administrativo a la lectura no muestra el chat en la interfaz ordinaria.
 */
export async function listarConversaciones(usuarioId: string): Promise<ConversacionResumen[]> {
  const perfiles = await perfilesDeCuenta(usuarioId)

  const comoCiudadano = supabase
    .from('conversaciones')
    .select(CAMPOS_CONVERSACION)
    .eq('solicitudes_contacto.ciudadano_id', usuarioId)
    .overrideTypes<FilaConversacionListado[], { merge: false }>()
  const comoAbogado =
    perfiles.length > 0
      ? supabase
          .from('conversaciones')
          .select(CAMPOS_CONVERSACION)
          .in('solicitudes_contacto.abogado_perfil_id', perfiles)
          .overrideTypes<FilaConversacionListado[], { merge: false }>()
      : null

  const [propias, recibidas] = await Promise.all([comoCiudadano, comoAbogado])
  if (propias.error) throw propias.error
  if (recibidas?.error) throw recibidas.error

  const filas = new Map<string, FilaConversacionListado>()
  for (const fila of [...propias.data, ...(recibidas?.data ?? [])]) filas.set(fila.id, fila)

  const filasVisibles = [...filas.values()].filter((fila) => participa(fila.solicitudes_contacto, usuarioId))
  const nombres = await nombresDePerfiles(filasVisibles)
  const visibles = filasVisibles
    .map((fila) => resumir(fila, nombres))
    .filter((conversacion): conversacion is ConversacionResumen => conversacion !== null)

  visibles.sort((a, b) => {
    const fechaA = a.ultimo_mensaje?.enviado_en ?? a.habilitada_en
    const fechaB = b.ultimo_mensaje?.enviado_en ?? b.habilitada_en
    return new Date(fechaB).getTime() - new Date(fechaA).getTime()
  })
  return visibles
}

/**
 * Conversación con su contexto o `null` si no existe o si el usuario no es
 * participante. La comprobación usa los datos consultados, nunca la URL.
 */
export async function cargarConversacion(
  conversacionId: string,
  usuarioId: string,
): Promise<ConversacionResumen | null> {
  const { data, error } = await supabase
    .from('conversaciones')
    .select(CAMPOS_CONVERSACION_DIRECTA)
    .eq('id', conversacionId)
    .maybeSingle()
    .overrideTypes<FilaConversacion | null, { merge: false }>()
  if (error) throw error
  if (!data || !participa(data.solicitudes_contacto, usuarioId)) return null
  const nombres = await nombresDePerfiles([data])
  return resumir(data, nombres)
}

/** Relato y ayuda de la solicitud, para el contexto visible de la conversación. */
export type ContextoSolicitud = {
  descripcion_breve: string
  ayuda_buscada: string
  enviada_en: string
  clasificacion_al_enviar: Json
}

/** Datos de la solicitud que se muestran como contexto dentro de la conversación. */
export async function cargarContextoSolicitud(
  conversacionId: string,
  usuarioId: string,
): Promise<ContextoSolicitud | null> {
  const { data, error } = await supabase
    .from('conversaciones')
    .select(`
      solicitud_id,
      solicitudes_contacto!inner (
        descripcion_breve,
        ayuda_buscada,
        enviada_en,
        clasificacion_al_enviar,
        ciudadano_id,
        perfiles_abogados ( cuenta_id )
      )
    `)
    .eq('id', conversacionId)
    .maybeSingle()
    .overrideTypes<{
      solicitud_id: string
      solicitudes_contacto: ContextoSolicitud & {
        ciudadano_id: string
        perfiles_abogados: { cuenta_id: string } | null
      } | null
    } | null, { merge: false }>()
  if (error) throw error
  const solicitud = data?.solicitudes_contacto
  if (!solicitud) return null
  const esParticipante =
    solicitud.ciudadano_id === usuarioId || solicitud.perfiles_abogados?.cuenta_id === usuarioId
  if (!esParticipante) return null
  return {
    descripcion_breve: solicitud.descripcion_breve,
    ayuda_buscada: solicitud.ayuda_buscada,
    enviada_en: solicitud.enviada_en,
    clasificacion_al_enviar: solicitud.clasificacion_al_enviar,
  }
}
