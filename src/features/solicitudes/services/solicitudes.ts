// Solicitudes de contacto y orientación (CU 09, 10 y 20).
// Las transiciones de estado usan la RPC cambiar_estado_solicitud; la cancelación
// la realiza el propietario mediante una actualización condicionada al estado pendiente.

import { supabase } from '../../../lib/supabase'
import type { Database, Json, Tables } from '../../../types/supabase'
import type { MedioContacto } from '../../../utils/contrato'
import type { EstadoSolicitud } from '../../../utils/etiquetas'
import { cargarPerfilPublico } from '../../directorio/services/directorio'
import { nombresAbogadosParticipantes } from '../../perfil/services/perfil'

export type SolicitudContacto = Tables<'solicitudes_contacto'>
export type Orientacion = Tables<'orientaciones'>

const CAMPOS_SOLICITUD = `
  id, ciudadano_id, abogado_perfil_id, tipo_caso_id, sin_clasificar, clasificacion_al_enviar,
  descripcion_breve, ayuda_buscada, estado, enviada_en, decidida_en, cancelada_en, motivo_rechazo,
  perfiles_abogados ( id, nombre_profesional, ciudad_atencion ),
  tipos_caso ( id, nombre_cotidiano ),
  orientaciones ( solicitud_id, area_id, tipo_caso_id, comentario_general, creada_en ),
  conversaciones ( id, habilitada_en )
` as const

type PerfilResumen = Pick<Tables<'perfiles_abogados'>, 'id' | 'nombre_profesional' | 'ciudad_atencion'>
type TipoCasoResumen = Pick<Tables<'tipos_caso'>, 'id' | 'nombre_cotidiano'>
type ConversacionResumen = Pick<Tables<'conversaciones'>, 'id' | 'habilitada_en'>

/* Solicitud vista por el ciudadano que la envió. */
export type SolicitudPropia = Omit<SolicitudContacto, 'clasificacion_al_enviar'> & {
  clasificacion_al_enviar: Json
  perfiles_abogados: PerfilResumen | null
  tipos_caso: TipoCasoResumen | null
  orientaciones: Orientacion | null
  conversaciones: ConversacionResumen | null
  /**
   * Nombre del abogado para mostrar. La inclusión del perfil solo es legible por su
   * titular y por la administración; para el ciudadano se completa con la proyección
   * acotada a participantes (`nombres_abogados_participantes`).
   */
  nombre_abogado: string | null
}

/**
 * Solicitud vista por el abogado destinatario. No incluye los datos de la cuenta del
 * ciudadano: la política de lectura de public.cuentas los reserva al titular y a la
 * administración, de modo que la identidad no se expone en la bandeja.
 */
export type SolicitudRecibida = Omit<SolicitudContacto, 'clasificacion_al_enviar'> & {
  clasificacion_al_enviar: Json
  tipos_caso: TipoCasoResumen | null
  orientaciones: Orientacion | null
  conversaciones: ConversacionResumen | null
}

/** Proyección pública del abogado que el ciudadano necesita en el detalle de su solicitud. */
export type ContactoPublicoPerfil = {
  /** El perfil cumple las condiciones de publicación y la RPC lo devolvió. */
  disponible: boolean
  ciudadAtencion: string | null
  medios: MedioContacto[]
}

/**
 * Perfil público del abogado (CU 08) a partir de la proyección `buscar_abogados`.
 *
 * No se consulta `perfiles_abogados`: el ciudadano no puede leer esa fila y, además, la
 * proyección aplica las condiciones que importan aquí (perfil publicado, activo,
 * verificación vigente y consentimiento del campo). Si el titular retira la publicación,
 * `disponible` es falso y no se muestra ni el contacto ni la ciudad.
 */
export async function cargarContactoPublicoPerfil(perfilId: string | null): Promise<ContactoPublicoPerfil> {
  if (!perfilId) return { disponible: false, ciudadAtencion: null, medios: [] }
  const perfil = await cargarPerfilPublico(perfilId)
  if (!perfil) return { disponible: false, ciudadAtencion: null, medios: [] }
  return { disponible: true, ciudadAtencion: perfil.ciudadAtencion, medios: perfil.mediosContacto }
}

type SolicitudSinNombre = Omit<SolicitudPropia, 'nombre_abogado'>

/**
 * Completa el nombre del abogado cuando la inclusión del perfil no es legible (el
 * ciudadano no puede leer esa fila salvo que sea su titular). Una consulta por lote.
 */
async function completarNombreAbogado(filas: SolicitudSinNombre[]): Promise<SolicitudPropia[]> {
  const faltantes = filas
    .filter((fila) => !fila.perfiles_abogados?.nombre_profesional)
    .map((fila) => fila.abogado_perfil_id)
  const nombres = faltantes.length > 0 ? await nombresAbogadosParticipantes(faltantes) : new Map<string, string>()

  return filas.map((fila) => ({
    ...fila,
    nombre_abogado: fila.perfiles_abogados?.nombre_profesional ?? nombres.get(fila.abogado_perfil_id) ?? null,
  }))
}

export async function listarSolicitudesPropias(ciudadanoId: string): Promise<SolicitudPropia[]> {
  const { data, error } = await supabase
    .from('solicitudes_contacto')
    .select(CAMPOS_SOLICITUD)
    .eq('ciudadano_id', ciudadanoId)
    .order('enviada_en', { ascending: false })
  if (error) throw error
  return completarNombreAbogado(data ?? [])
}

export async function cargarSolicitudPropia(solicitudId: string): Promise<SolicitudPropia> {
  const { data, error } = await supabase
    .from('solicitudes_contacto')
    .select(CAMPOS_SOLICITUD)
    .eq('id', solicitudId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('La solicitud no está disponible o no tienes acceso a ella.')
  // El nombre del abogado se completa aquí: su fila no es legible por el ciudadano.
  const [completa] = await completarNombreAbogado([data])
  return completa
}

export type DatosSolicitud = {
  ciudadanoId: string
  perfilId: string
  tipoCasoId: string | null
  tipoCasoNombre: string | null
  areasDelPerfil: string[]
  descripcionBreve: string
  ayudaBuscada: string
}

export async function crearSolicitud(datos: DatosSolicitud): Promise<SolicitudContacto> {
  const sinClasificar = datos.tipoCasoId === null
  const clasificacion: Json = {
    tipo_caso: datos.tipoCasoNombre,
    tipo_caso_id: datos.tipoCasoId,
    areas: datos.areasDelPerfil,
    sin_clasificar: sinClasificar,
    registrada_en: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from('solicitudes_contacto')
    .insert({
      ciudadano_id: datos.ciudadanoId,
      abogado_perfil_id: datos.perfilId,
      tipo_caso_id: datos.tipoCasoId,
      sin_clasificar: sinClasificar,
      clasificacion_al_enviar: clasificacion,
      descripcion_breve: datos.descripcionBreve.trim(),
      ayuda_buscada: datos.ayudaBuscada.trim(),
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

/** Cancelación del propietario: solo procede mientras el estado siga siendo pendiente. */
export async function cancelarSolicitud(solicitudId: string): Promise<void> {
  const { data, error } = await supabase
    .from('solicitudes_contacto')
    .update({ estado: 'cancelada', cancelada_en: new Date().toISOString() })
    .eq('id', solicitudId)
    .eq('estado', 'pendiente')
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('La solicitud ya no está pendiente: su estado vigente impide cancelarla.')
  }
}

export async function listarSolicitudesRecibidas(perfilId: string): Promise<SolicitudRecibida[]> {
  const { data, error } = await supabase
    .from('solicitudes_contacto')
    .select(CAMPOS_SOLICITUD)
    .eq('abogado_perfil_id', perfilId)
    .order('enviada_en', { ascending: false })
  if (error) throw error
  return data
}

export async function cargarSolicitudRecibida(solicitudId: string): Promise<SolicitudRecibida> {
  const { data, error } = await supabase
    .from('solicitudes_contacto')
    .select(CAMPOS_SOLICITUD)
    .eq('id', solicitudId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('La solicitud no está disponible o no tienes acceso a ella.')
  return data
}

export type DecisionSolicitud = 'aceptada' | 'rechazada'

/**
 * Decisión del abogado destinatario mediante la RPC cambiar_estado_solicitud.
 * La función verifica al actor en el servidor y, con la migración de transiciones,
 * exige que la solicitud siga pendiente para evitar dos estados finales.
 */
export async function decidirSolicitud(
  solicitudId: string,
  decision: DecisionSolicitud,
  motivoRechazo?: string,
): Promise<void> {
  const argumentos: Database['public']['Functions']['cambiar_estado_solicitud']['Args'] = {
    p_solicitud_id: solicitudId,
    p_nuevo_estado: decision satisfies EstadoSolicitud,
  }
  if (motivoRechazo?.trim()) argumentos.p_motivo_rechazo = motivoRechazo.trim()
  const { error } = await supabase.rpc('cambiar_estado_solicitud', argumentos)
  if (error) throw error
}

export type DatosOrientacion = {
  solicitudId: string
  areaId: string | null
  tipoCasoId: string | null
  comentarioGeneral: string | null
}

/** Orientación hacia otra clasificación (CU 20). No transfiere la solicitud ni datos personales. */
export async function guardarOrientacion(datos: DatosOrientacion): Promise<Orientacion> {
  const { data, error } = await supabase
    .from('orientaciones')
    .upsert(
      {
        solicitud_id: datos.solicitudId,
        area_id: datos.areaId,
        tipo_caso_id: datos.tipoCasoId,
        comentario_general: datos.comentarioGeneral?.trim() ? datos.comentarioGeneral.trim() : null,
      },
      { onConflict: 'solicitud_id' },
    )
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function cargarConversacionDeSolicitud(solicitudId: string): Promise<ConversacionResumen | null> {
  const { data, error } = await supabase
    .from('conversaciones')
    .select('id, habilitada_en')
    .eq('solicitud_id', solicitudId)
    .maybeSingle()
  if (error) throw error
  return data
}
