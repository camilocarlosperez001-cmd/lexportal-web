// Escrituras administrativas del catálogo jurídico (CU 17).
//
// Regla del CU 17: un elemento con referencias históricas NO se borra. La fila y sus
// relaciones se conservan intactas y solo se marca activa/activo = false. Los elementos
// inactivos dejan de ofrecerse para nuevas selecciones (registro profesional, búsqueda y
// solicitudes), pero la clasificación ya registrada en perfiles y solicitudes permanece.
// Por eso este servicio no expone ninguna operación de borrado físico de áreas, tipos de
// caso ni términos.
//
// La autorización real vive en la base de datos: cada tabla del catálogo tiene una política
// RLS de administración ("Admins gestionan ...") basada en public.es_admin(). El cliente no
// decide privilegios; si la sesión no es administrativa, PostgREST rechaza la operación.

import { supabase } from '../../../lib/supabase'
import type { AreaJuridica, TipoCaso, TerminoBusqueda } from './catalogo'

type ErrorPostgrest = { code?: string; message?: string }

function esCodigo(error: unknown, codigos: string[]): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false
  const codigo = (error as ErrorPostgrest).code
  return typeof codigo === 'string' && codigos.includes(codigo)
}

/**
 * Traduce las violaciones de restricción previsibles del esquema a mensajes en español.
 * 23505 = unique_violation (nombre o texto repetido), 23503 = foreign_key_violation.
 */
function errorDeEscritura(error: unknown): Error {
  if (esCodigo(error, ['23505'])) {
    return new Error('Ya existe un elemento del catálogo con ese texto. Los nombres y términos no pueden repetirse.')
  }
  if (esCodigo(error, ['23503'])) {
    return new Error('La relación apunta a un elemento que ya no existe en el catálogo.')
  }
  return error instanceof Error ? error : new Error('No se pudo guardar el cambio en el catálogo.')
}

/** Evita interpretar un UPDATE bloqueado por RLS como una escritura exitosa (0 filas). */
function exigirUnaFila(afectadas: number, mensaje: string): void {
  if (afectadas === 0) throw new Error(mensaje)
}

// ---------------------------------------------------------------------------
// Áreas jurídicas
// ---------------------------------------------------------------------------

export async function crearArea(nombre: string): Promise<AreaJuridica> {
  const { data, error } = await supabase
    .from('areas_juridicas')
    .insert({ nombre: nombre.trim() })
    .select('id, nombre, activa')
    .single()
  if (error) throw errorDeEscritura(error)
  return data
}

/** Cambia el nombre y/o el estado activo. Desactivar conserva relaciones e historial. */
export async function actualizarArea(id: string, cambios: { nombre: string; activa: boolean }): Promise<void> {
  const { data, error } = await supabase
    .from('areas_juridicas')
    .update({ nombre: cambios.nombre.trim(), activa: cambios.activa })
    .eq('id', id)
    .select('id')
  if (error) throw errorDeEscritura(error)
  exigirUnaFila(
    data.length,
    'No se actualizó el área. Puede que tu cuenta no tenga permiso administrativo sobre el catálogo.',
  )
}

// ---------------------------------------------------------------------------
// Tipos de caso
// ---------------------------------------------------------------------------

export async function crearTipoCaso(nombreCotidiano: string): Promise<TipoCaso> {
  const { data, error } = await supabase
    .from('tipos_caso')
    .insert({ nombre_cotidiano: nombreCotidiano.trim() })
    .select('id, nombre_cotidiano, activo')
    .single()
  if (error) throw errorDeEscritura(error)
  return data
}

export async function actualizarTipoCaso(
  id: string,
  cambios: { nombreCotidiano: string; activo: boolean },
): Promise<void> {
  const { data, error } = await supabase
    .from('tipos_caso')
    .update({ nombre_cotidiano: cambios.nombreCotidiano.trim(), activo: cambios.activo })
    .eq('id', id)
    .select('id')
  if (error) throw errorDeEscritura(error)
  exigirUnaFila(
    data.length,
    'No se actualizó el tipo de caso. Puede que tu cuenta no tenga permiso administrativo sobre el catálogo.',
  )
}

// ---------------------------------------------------------------------------
// Términos de búsqueda
// ---------------------------------------------------------------------------

export async function crearTermino(texto: string): Promise<TerminoBusqueda> {
  const { data, error } = await supabase
    .from('terminos_busqueda')
    .insert({ texto: texto.trim() })
    .select('id, texto, activo')
    .single()
  if (error) throw errorDeEscritura(error)
  return data
}

export async function actualizarTermino(id: string, cambios: { texto: string; activo: boolean }): Promise<void> {
  const { data, error } = await supabase
    .from('terminos_busqueda')
    .update({ texto: cambios.texto.trim(), activo: cambios.activo })
    .eq('id', id)
    .select('id')
  if (error) throw errorDeEscritura(error)
  exigirUnaFila(
    data.length,
    'No se actualizó el término. Puede que tu cuenta no tenga permiso administrativo sobre el catálogo.',
  )
}

// ---------------------------------------------------------------------------
// Relaciones del catálogo
// ---------------------------------------------------------------------------

/** Relaciona un área con un tipo de caso (tabla area_tipo_caso). */
export async function crearRelacionAreaTipoCaso(areaId: string, tipoCasoId: string): Promise<void> {
  const { error } = await supabase.from('area_tipo_caso').insert({ area_id: areaId, tipo_caso_id: tipoCasoId })
  if (error) throw errorDeEscritura(error)
}

/** Retira la correspondencia del catálogo. No borra el área ni el tipo de caso. */
export async function eliminarRelacionAreaTipoCaso(areaId: string, tipoCasoId: string): Promise<void> {
  const { error } = await supabase
    .from('area_tipo_caso')
    .delete()
    .eq('area_id', areaId)
    .eq('tipo_caso_id', tipoCasoId)
  if (error) throw errorDeEscritura(error)
}

/** Asocia un término de búsqueda a un área jurídica (tabla termino_area). */
export async function crearRelacionTerminoArea(terminoId: string, areaId: string): Promise<void> {
  const { error } = await supabase.from('termino_area').insert({ termino_id: terminoId, area_id: areaId })
  if (error) throw errorDeEscritura(error)
}

export async function eliminarRelacionTerminoArea(terminoId: string, areaId: string): Promise<void> {
  const { error } = await supabase.from('termino_area').delete().eq('termino_id', terminoId).eq('area_id', areaId)
  if (error) throw errorDeEscritura(error)
}

/** Asocia un término de búsqueda a un tipo de caso (tabla termino_tipo_caso). */
export async function crearRelacionTerminoTipoCaso(terminoId: string, tipoCasoId: string): Promise<void> {
  const { error } = await supabase.from('termino_tipo_caso').insert({ termino_id: terminoId, tipo_caso_id: tipoCasoId })
  if (error) throw errorDeEscritura(error)
}

export async function eliminarRelacionTerminoTipoCaso(terminoId: string, tipoCasoId: string): Promise<void> {
  const { error } = await supabase
    .from('termino_tipo_caso')
    .delete()
    .eq('termino_id', terminoId)
    .eq('tipo_caso_id', tipoCasoId)
  if (error) throw errorDeEscritura(error)
}

// ---------------------------------------------------------------------------
// Uso real de cada elemento del catálogo
// ---------------------------------------------------------------------------

/** Conteo exacto de filas que cumplen una condición; nunca estima ni inventa cifras. */
async function contar(
  tabla: 'perfil_area' | 'perfil_tipo_caso' | 'orientaciones' | 'solicitudes_contacto' | 'termino_area' | 'termino_tipo_caso' | 'area_tipo_caso',
  columnaFiltro: string,
  valor: string,
): Promise<number> {
  const { count, error } = await supabase
    .from(tabla)
    .select('*', { count: 'exact', head: true })
    .eq(columnaFiltro, valor)
  if (error) throw error
  return count ?? 0
}

/**
 * Uso real consultado con conteos sobre las tablas base (no se inventan cifras):
 * perfiles que declaran el área o el tipo de caso, orientaciones registradas sobre ellos,
 * solicitudes clasificadas con ese tipo de caso y relaciones internas del catálogo.
 *
 * Las tablas de perfiles y solicitudes no son legibles por el público: si la consulta no
 * devuelve datos por permisos, la página lo informa en lugar de mostrar ceros.
 */
export type UsoCatalogo = {
  areas: Record<string, { perfiles: number; orientaciones: number; tiposDeCaso: number; terminos: number }>
  tipos: Record<string, { perfiles: number; solicitudes: number; areas: number; terminos: number }>
  terminos: Record<string, { areas: number; tiposDeCaso: number }>
}

export async function obtenerUsoCatalogo(ids: {
  areas: string[]
  tipos: string[]
  terminos: string[]
}): Promise<UsoCatalogo> {
  const uso: UsoCatalogo = { areas: {}, tipos: {}, terminos: {} }

  const [perfilesPorArea, orientacionesPorArea, tiposPorArea, terminosPorArea] = await Promise.all([
    Promise.all(ids.areas.map((id) => contar('perfil_area', 'area_id', id))),
    Promise.all(ids.areas.map((id) => contar('orientaciones', 'area_id', id))),
    Promise.all(ids.areas.map((id) => contar('area_tipo_caso', 'area_id', id))),
    Promise.all(ids.areas.map((id) => contar('termino_area', 'area_id', id))),
  ])

  ids.areas.forEach((id, indice) => {
    uso.areas[id] = {
      perfiles: perfilesPorArea[indice],
      orientaciones: orientacionesPorArea[indice],
      tiposDeCaso: tiposPorArea[indice],
      terminos: terminosPorArea[indice],
    }
  })

  const [perfilesPorTipo, solicitudesPorTipo, areasPorTipo, terminosPorTipo] = await Promise.all([
    Promise.all(ids.tipos.map((id) => contar('perfil_tipo_caso', 'tipo_caso_id', id))),
    Promise.all(ids.tipos.map((id) => contar('solicitudes_contacto', 'tipo_caso_id', id))),
    Promise.all(ids.tipos.map((id) => contar('area_tipo_caso', 'tipo_caso_id', id))),
    Promise.all(ids.tipos.map((id) => contar('termino_tipo_caso', 'tipo_caso_id', id))),
  ])

  ids.tipos.forEach((id, indice) => {
    uso.tipos[id] = {
      perfiles: perfilesPorTipo[indice],
      solicitudes: solicitudesPorTipo[indice],
      areas: areasPorTipo[indice],
      terminos: terminosPorTipo[indice],
    }
  })

  const [areasPorTermino, tiposPorTermino] = await Promise.all([
    Promise.all(ids.terminos.map((id) => contar('termino_area', 'termino_id', id))),
    Promise.all(ids.terminos.map((id) => contar('termino_tipo_caso', 'termino_id', id))),
  ])

  ids.terminos.forEach((id, indice) => {
    uso.terminos[id] = { areas: areasPorTermino[indice], tiposDeCaso: tiposPorTermino[indice] }
  })

  return uso
}
