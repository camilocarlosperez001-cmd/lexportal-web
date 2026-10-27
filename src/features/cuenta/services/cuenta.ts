// Datos ordinarios de la cuenta (CU 04 y 12). Solo el titular puede actualizar su fila
// de public.cuentas: la política de actualización de RLS lo exige y la administración
// conserva su propio acceso. El correo y el rol no se modifican desde el cliente.

import { supabase } from '../../../lib/supabase'
import type { Tables } from '../../../types/supabase'
import { validarNombreCompleto, validarTelefono } from '../../../utils/validaciones'

export type Cuenta = Tables<'cuentas'>

export type DatosCuenta = {
  nombreCompleto: string
  telefono: string | null
  avisosCorreo?: boolean
}

/**
 * Campos que el titular puede modificar. Se enumeran explícitamente para no enviar
 * `correo`, `rol` ni `estado`, que quedan fuera de la edición ordinaria de la cuenta.
 */
type ActualizacionCuentaPermitida = {
  nombre_completo: string
  telefono: string | null
  avisos_correo?: boolean
}

/**
 * Actualiza los datos ordinarios de la cuenta del titular. Si la actualización no
 * devuelve fila, la política de RLS impidió la escritura y se informa del fallo en
 * lugar de afirmar un éxito que no se produjo.
 */
export async function actualizarDatosCuenta(cuentaId: string, datos: DatosCuenta): Promise<Cuenta> {
  const problemaNombre = validarNombreCompleto(datos.nombreCompleto)
  if (problemaNombre) throw new Error(problemaNombre)
  const problemaTelefono = validarTelefono(datos.telefono ?? '')
  if (problemaTelefono) throw new Error(problemaTelefono)

  const cambios: ActualizacionCuentaPermitida = {
    nombre_completo: datos.nombreCompleto.trim(),
    telefono: datos.telefono?.trim() ? datos.telefono.trim() : null,
  }
  if (typeof datos.avisosCorreo === 'boolean') cambios.avisos_correo = datos.avisosCorreo

  const { data, error } = await supabase
    .from('cuentas')
    .update(cambios)
    .eq('id', cuentaId)
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('No se pudieron guardar los datos de tu cuenta: la operación fue rechazada.')
  return data
}

/** Preferencia de avisos por correo (CU 15); el aviso interno se conserva siempre. */
export async function actualizarAvisosCorreo(cuentaId: string, valor: boolean): Promise<Cuenta> {
  const { data, error } = await supabase
    .from('cuentas')
    .update({ avisos_correo: valor })
    .eq('id', cuentaId)
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('No se pudo guardar tu preferencia de avisos por correo.')
  return data
}
