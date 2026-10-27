// Transformaciones puras del directorio (CU 05, 06 y 07): lectura de los parámetros de
// búsqueda de la URL, serialización de los filtros y utilidades de presentación.

import type { AreaResumen } from '../../utils/contrato'
import type { AreaJuridica, TipoCaso } from '../catalogo/services/catalogo'
import type { FiltrosDirectorio } from './types'

/** Opción de filtro normalizada: el catálogo usa `nombre` y `nombre_cotidiano` según la tabla. */
export type OpcionFiltro = { id: string; nombre: string }

export function opcionesDeAreas(areas: AreaJuridica[]): OpcionFiltro[] {
  return areas.map((area) => ({ id: area.id, nombre: area.nombre }))
}

export function opcionesDeTiposCaso(tipos: TipoCaso[]): OpcionFiltro[] {
  return tipos.map((tipo) => ({ id: tipo.id, nombre: tipo.nombre_cotidiano }))
}

export const PARAM_BUSQUEDA = 'busqueda'
export const PARAM_AREAS = 'areas'
export const PARAM_TIPOS_CASO = 'tiposCaso'
export const PARAM_CIUDAD = 'ciudad'

export const FILTROS_VACIOS: FiltrosDirectorio = { busqueda: '', areas: [], tiposCaso: [], ciudad: '' }

/** Un parámetro puede venir repetido (?areas=a&areas=b) o separado por comas (?areas=a,b). */
function leerLista(params: URLSearchParams, clave: string): string[] {
  const valores = params.getAll(clave).flatMap((valor) => valor.split(','))
  const unicos: string[] = []
  for (const valor of valores) {
    const limpio = valor.trim()
    if (limpio && !unicos.includes(limpio)) unicos.push(limpio)
  }
  return unicos
}

function leerTexto(params: URLSearchParams, clave: string): string {
  const valor = params.get(clave)
  return valor ? valor.trim() : ''
}

export function leerFiltrosDeParams(params: URLSearchParams): FiltrosDirectorio {
  return {
    busqueda: leerTexto(params, PARAM_BUSQUEDA),
    areas: leerLista(params, PARAM_AREAS),
    tiposCaso: leerLista(params, PARAM_TIPOS_CASO),
    ciudad: leerTexto(params, PARAM_CIUDAD),
  }
}

/** Serializa los filtros en parámetros; omite los vacíos para que la URL siga siendo legible. */
export function serializarFiltros(filtros: FiltrosDirectorio): URLSearchParams {
  const params = new URLSearchParams()
  if (filtros.busqueda.trim()) params.set(PARAM_BUSQUEDA, filtros.busqueda.trim())
  if (filtros.areas.length > 0) params.set(PARAM_AREAS, filtros.areas.join(','))
  if (filtros.tiposCaso.length > 0) params.set(PARAM_TIPOS_CASO, filtros.tiposCaso.join(','))
  if (filtros.ciudad.trim()) params.set(PARAM_CIUDAD, filtros.ciudad.trim())
  return params
}

/** Clave estable para useConsulta: cambia solo cuando cambian los criterios efectivos. */
export function claveDeFiltros(filtros: FiltrosDirectorio): string {
  return serializarFiltros(filtros).toString()
}

export function hayFiltrosActivos(filtros: FiltrosDirectorio): boolean {
  return Boolean(filtros.busqueda || filtros.ciudad) || filtros.areas.length > 0 || filtros.tiposCaso.length > 0
}

export function contarFiltrosActivos(filtros: FiltrosDirectorio): number {
  return (filtros.busqueda ? 1 : 0) + filtros.areas.length + filtros.tiposCaso.length + (filtros.ciudad ? 1 : 0)
}

export function alternarEnLista(lista: string[], valor: string): string[] {
  return lista.includes(valor) ? lista.filter((elemento) => elemento !== valor) : [...lista, valor]
}

/** Resuelve los identificadores seleccionados contra el catálogo, descartando los desconocidos. */
export function resolverNombresSeleccionados(ids: string[], catalogo: OpcionFiltro[]): string[] {
  return catalogo.filter((elemento) => ids.includes(elemento.id)).map((elemento) => elemento.nombre)
}

/** Opciones de filtro que combinan el catálogo con lo que los resultados declaran. */
export function combinarOpciones(catalogo: OpcionFiltro[], declaradas: OpcionFiltro[]): OpcionFiltro[] {
  const combinadas = [...catalogo]
  for (const declarada of declaradas) {
    if (!combinadas.some((opcion) => opcion.id === declarada.id)) combinadas.push(declarada)
  }
  return combinadas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/** Etiqueta legible del tiempo de ejercicio declarado. */
export function etiquetaExperiencia(anios: number | null | undefined): string | null {
  if (typeof anios !== 'number' || !Number.isFinite(anios) || anios < 0) return null
  if (anios === 0) return 'Menos de 1 año de ejercicio'
  return anios === 1 ? '1 año de ejercicio' : `${anios} años de ejercicio`
}

/** Recorta la descripción para las tarjetas y conserva los cortes entre palabras. */
export function resumirDescripcion(texto: string, maximo = 220): string {
  const limpio = texto.trim().replace(/\s+/g, ' ')
  if (limpio.length <= maximo) return limpio
  const recorte = limpio.slice(0, maximo)
  const ultimoEspacio = recorte.lastIndexOf(' ')
  return `${(ultimoEspacio > 0 ? recorte.slice(0, ultimoEspacio) : recorte).trimEnd()}…`
}

const PREFIJOS_TRATAMIENTO = ['dr.', 'dra.', 'doctor', 'doctora', 'sr.', 'sra.', 'ab.', 'abg.']

/** Iniciales para el avatar cuando el perfil no autoriza publicar fotografía. */
export function inicialesDeNombre(nombre: string): string {
  const palabras = nombre
    .trim()
    .split(/\s+/)
    .filter((palabra) => palabra.length > 0 && !PREFIJOS_TRATAMIENTO.includes(palabra.toLowerCase()))
  const utiles = palabras.length > 0 ? palabras : nombre.trim().split(/\s+/)
  return utiles
    .slice(0, 2)
    .map((palabra) => palabra.charAt(0).toUpperCase())
    .join('')
}

export function listaAreasTexto(areas: AreaResumen[]): string[] {
  return areas.map((area) => area.nombre)
}
