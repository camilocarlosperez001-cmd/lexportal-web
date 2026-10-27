// Administración de privacidad (CU 19, parte administrativa).
//
// El administrador evalúa la política aplicable, registra las medidas adoptadas y la
// resolución de cada petición del titular. La resolución se guarda en solicitudes_privacidad;
// el aviso interno al titular lo genera un trigger de la base de datos
// (evento privacidad_resuelta sobre notificaciones), por lo que este servicio nunca inserta
// notificaciones desde el cliente.
//
// La autorización real vive en RLS: "Admins actualizan solicitudes privacidad" (es_admin())
// para el UPDATE y "Ver solicitudes privacidad propias o admin" para la lectura.

import { supabase } from '../../../lib/supabase'
import type { Tables, TablesUpdate } from '../../../types/supabase'
import type { EstadoPeticionPriv, TipoPeticionPriv } from '../../../utils/etiquetas'

export type SolicitudPrivacidad = Tables<'solicitudes_privacidad'>

/** Titular de una petición: nombre y correo de la cuenta que la registró. */
export type TitularPeticion = {
  nombreCompleto: string
  correo: string
}

export type PeticionConTitular = {
  solicitud: SolicitudPrivacidad
  titular: TitularPeticion | null
}

type ResumenCuenta = { id: string; nombre_completo: string; correo: string }

/** Columnas del listado administrativo; no incluye datos internos de otros módulos. */
const COLUMNAS_SOLICITUD = 'id, titular_id, tipo, estado, solicitada_en, responsable_id, respuesta, resuelta_en, medidas_aplicadas'

/**
 * Listado completo de peticiones con los datos identificativos del titular.
 * RLS devuelve todas las filas solo a la administración; un titular únicamente vería las suyas,
 * por lo que la página comprueba además el rol de la sesión antes de ofrecer la resolución.
 */
export async function listarPeticiones(): Promise<PeticionConTitular[]> {
  const { data: solicitudes, error } = await supabase
    .from('solicitudes_privacidad')
    .select(COLUMNAS_SOLICITUD)
    .order('solicitada_en', { ascending: false })
  if (error) throw error
  if (solicitudes.length === 0) return []

  const titulares = [...new Set(solicitudes.map((solicitud) => solicitud.titular_id))]
  const { data: cuentas, error: errorCuentas } = await supabase
    .from('cuentas')
    .select('id, nombre_completo, correo')
    .in('id', titulares)
  if (errorCuentas) throw errorCuentas

  const porId = new Map<string, ResumenCuenta>(cuentas.map((cuenta) => [cuenta.id, cuenta]))
  return solicitudes.map((solicitud) => {
    const cuenta = porId.get(solicitud.titular_id)
    return {
      solicitud,
      titular: cuenta ? { nombreCompleto: cuenta.nombre_completo, correo: cuenta.correo } : null,
    }
  })
}

export type ResolucionPeticion = {
  estado: EstadoPeticionPriv
  respuesta: string
  medidasAplicadas: string
  /** Cuenta del administrador que resuelve. */
  responsableId: string
}

/**
 * Registra la resolución de una petición. `resuelta_en` se fija en este momento y el
 * responsable queda vinculado a la cuenta administrativa autenticada.
 * Las transiciones fuera de 'pendiente' y 'en_proceso' no se ofrecen: una petición ya
 * resuelta solo se consulta en el historial.
 */
export async function resolverPeticion(id: string, resolucion: ResolucionPeticion): Promise<void> {
  const cambios: TablesUpdate<'solicitudes_privacidad'> = {
    estado: resolucion.estado,
    respuesta: resolucion.respuesta.trim(),
    medidas_aplicadas: resolucion.medidasAplicadas.trim(),
    responsable_id: resolucion.responsableId,
    resuelta_en: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from('solicitudes_privacidad')
    .update(cambios)
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (data.length === 0) {
    throw new Error(
      'No se registró la resolución: la petición no existe o tu cuenta no tiene permiso administrativo.',
    )
  }
}

/** Tipos de petición admitidos por el contrato, para el filtro del listado. */
export const TIPOS_PETICION: TipoPeticionPriv[] = [
  'acceso',
  'rectificacion',
  'cancelacion',
  'oposicion',
  'desactivacion',
  'supresion',
]

/** Estados admitidos por el contrato, para el filtro del listado. */
export const ESTADOS_PETICION: EstadoPeticionPriv[] = ['pendiente', 'en_proceso', 'resuelta']

/** Una petición sigue abierta mientras no tenga resolución registrada. */
export function esPeticionAbierta(solicitud: SolicitudPrivacidad): boolean {
  return solicitud.estado !== 'resuelta'
}
