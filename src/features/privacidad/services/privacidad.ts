// Privacidad del titular (CU 19): peticiones propias, campos opcionales publicados y
// visibilidad del perfil. Las aceptaciones legales viven en ./legales.ts y el acceso al
// perfil profesional en ../../perfil/services/perfil.ts, que se reutiliza sin duplicarlo.

import { supabase } from '../../../lib/supabase'
import type { Tables } from '../../../types/supabase'
import type { TipoPeticionPriv } from '../../../utils/etiquetas'
import { actualizarCamposPublicos, actualizarVisibilidad } from '../../perfil/services/perfil'

export type SolicitudPrivacidad = Tables<'solicitudes_privacidad'>

/** Escrituras del titular sobre su perfil; se reexportan desde el módulo de perfil. */
export { actualizarCamposPublicos, actualizarVisibilidad }

/** Peticiones de privacidad registradas por el titular, de la más reciente a la más antigua. */
export async function listarPeticionesPropias(titularId: string): Promise<SolicitudPrivacidad[]> {
  const { data, error } = await supabase
    .from('solicitudes_privacidad')
    .select('id, titular_id, tipo, estado, solicitada_en, responsable_id, respuesta, resuelta_en, medidas_aplicadas')
    .eq('titular_id', titularId)
    .order('solicitada_en', { ascending: false })
  if (error) throw error
  return data
}

/**
 * Registra una petición del titular. La fila queda trazable con su estado pendiente y la
 * resolución la registra la administración: la supresión no es inmediata ni automática.
 */
export async function crearPeticion(titularId: string, tipo: TipoPeticionPriv): Promise<SolicitudPrivacidad> {
  const { data, error } = await supabase
    .from('solicitudes_privacidad')
    .insert({ titular_id: titularId, tipo })
    .select('id, titular_id, tipo, estado, solicitada_en, responsable_id, respuesta, resuelta_en, medidas_aplicadas')
    .single()
  if (error) throw error
  return data
}
