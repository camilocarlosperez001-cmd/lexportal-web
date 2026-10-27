// Lectura del catálogo jurídico (CU 05, 06, 07, 08 y 17). Las escrituras administrativas
// viven en el servicio de administración del mismo módulo.

import { supabase } from '../../../lib/supabase'
import type { Tables } from '../../../types/supabase'

export type AreaJuridica = Tables<'areas_juridicas'>
export type TipoCaso = Tables<'tipos_caso'>
export type TerminoBusqueda = Tables<'terminos_busqueda'>
export type RelacionAreaTipoCaso = Tables<'area_tipo_caso'>
export type RelacionTerminoArea = Tables<'termino_area'>
export type RelacionTerminoTipoCaso = Tables<'termino_tipo_caso'>

export async function listarAreas({ soloActivas = false }: { soloActivas?: boolean } = {}): Promise<AreaJuridica[]> {
  let consulta = supabase.from('areas_juridicas').select('id, nombre, activa').order('nombre')
  if (soloActivas) consulta = consulta.eq('activa', true)
  const { data, error } = await consulta
  if (error) throw error
  return data
}

export async function listarTiposCaso({ soloActivos = false }: { soloActivos?: boolean } = {}): Promise<TipoCaso[]> {
  let consulta = supabase.from('tipos_caso').select('id, nombre_cotidiano, activo').order('nombre_cotidiano')
  if (soloActivos) consulta = consulta.eq('activo', true)
  const { data, error } = await consulta
  if (error) throw error
  return data
}

export async function listarTerminos({ soloActivos = false }: { soloActivos?: boolean } = {}): Promise<TerminoBusqueda[]> {
  let consulta = supabase.from('terminos_busqueda').select('id, texto, activo').order('texto')
  if (soloActivos) consulta = consulta.eq('activo', true)
  const { data, error } = await consulta
  if (error) throw error
  return data
}

export async function listarRelacionesAreaTipoCaso(): Promise<RelacionAreaTipoCaso[]> {
  const { data, error } = await supabase.from('area_tipo_caso').select('area_id, tipo_caso_id')
  if (error) throw error
  return data
}

export async function listarRelacionesTerminoArea(): Promise<RelacionTerminoArea[]> {
  const { data, error } = await supabase.from('termino_area').select('termino_id, area_id')
  if (error) throw error
  return data
}

export async function listarRelacionesTerminoTipoCaso(): Promise<RelacionTerminoTipoCaso[]> {
  const { data, error } = await supabase.from('termino_tipo_caso').select('termino_id, tipo_caso_id')
  if (error) throw error
  return data
}

/** Tipos de caso asociados a las áreas seleccionadas según area_tipo_caso. */
export function tiposCasoDeAreas(
  relaciones: RelacionAreaTipoCaso[],
  tipos: TipoCaso[],
  areasSeleccionadas: string[],
): TipoCaso[] {
  if (areasSeleccionadas.length === 0) return tipos
  const permitidos = new Set(
    relaciones.filter((relacion) => areasSeleccionadas.includes(relacion.area_id)).map((relacion) => relacion.tipo_caso_id),
  )
  return tipos.filter((tipo) => permitidos.has(tipo.id))
}
