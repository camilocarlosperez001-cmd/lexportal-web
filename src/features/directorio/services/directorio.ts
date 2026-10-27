// Acceso a datos del directorio público (CU 05, 06, 07 y 08).
//
// Toda la lectura pública pasa por la RPC `buscar_abogados`. El servidor comprueba cuenta
// activa, rol abogado, perfil activo y visible, versión aprobada y verificación vigente, y
// devuelve NULL en los campos opcionales que el titular no autorizó. La tabla
// `perfiles_abogados` ya no es legible de forma anónima, así que aquí no se consulta
// directamente ni se relajan esas condiciones.
//
// El generador de tipos declara como `string` los textos que la RPC puede devolver NULL
// (no expresa nulabilidad en los retornos de funciones): los valores se normalizan en
// `textoOpcional` antes de presentarlos y nunca se llama a `.trim()` sin comprobarlos.

import { supabase } from '../../../lib/supabase'
import type { Database } from '../../../types/supabase'
import { leerAreas, leerCamposPublicos, leerMediosContacto, leerTiposCaso } from '../../../utils/contrato'
import type { PerfilDirectorio, PerfilPublico } from '../types'

type FilaBusqueda = Database['public']['Functions']['buscar_abogados']['Returns'][number]

/** Criterios efectivos de búsqueda. La ciudad solo se envía si el contrato la admite. */
export type CriteriosBusqueda = {
  busqueda?: string
  areas?: string[]
  tiposCaso?: string[]
  ciudad?: string
}

/** Página de la proyección pública al recorrerla; no supera el límite de filas de la API. */
const TAMANO_PAGINA = 1000

/** Texto opcional: la RPC devuelve NULL en los campos no autorizados. */
function textoOpcional(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim().length > 0 ? valor.trim() : null
}

/** Campos presentes en los resultados de búsqueda; el recorte del servidor ya está aplicado. */
function perfilDesdeRpc(fila: FilaBusqueda): PerfilDirectorio {
  return {
    id: fila.perfil_id,
    nombreProfesional: fila.nombre_profesional,
    descripcion: fila.descripcion,
    experienciaAnios: fila.experiencia_anios,
    ciudadAtencion: fila.ciudad_atencion,
    areas: leerAreas(fila.areas),
    tiposCaso: leerTiposCaso(fila.tipos_caso),
    camposPublicos: leerCamposPublicos(fila.campos_opcionales_publicos),
    fechaVerificacionVigente: textoOpcional(fila.fecha_verificacion_vigente),
    alcanceVerificacionVigente: textoOpcional(fila.alcance_verificacion_vigente),
    // El servidor anula lo no autorizado: no se vuelve a filtrar, solo se normaliza.
    fotoPublica: textoOpcional(fila.foto_publica),
    modalidad: textoOpcional(fila.modalidad),
    tarifasOrientativas: textoOpcional(fila.tarifas_orientativas),
  }
}

/** Perfil público completo (CU 08), con las declaraciones que la RPC entrega ya filtradas. */
function perfilPublicoDesdeRpc(fila: FilaBusqueda): PerfilPublico {
  return {
    ...perfilDesdeRpc(fila),
    formacionDeclarada: textoOpcional(fila.formacion_declarada),
    horarios: textoOpcional(fila.horarios),
    mediosContacto: leerMediosContacto(fila.medios_contacto),
  }
}

/**
 * Búsqueda pública de abogados (CU 05, 06 y 07). Devuelve perfiles verificados, activos y
 * visibles con sus áreas y tipos de caso ya interpretados.
 */
export async function buscarAbogados(criterios: CriteriosBusqueda = {}): Promise<PerfilDirectorio[]> {
  const busqueda = criterios.busqueda?.trim() ?? ''
  const ciudad = criterios.ciudad?.trim() ?? ''
  const argumentos: Database['public']['Functions']['buscar_abogados']['Args'] = {
    p_busqueda: busqueda || undefined,
    p_areas: criterios.areas && criterios.areas.length > 0 ? criterios.areas : undefined,
    p_tipos_caso: criterios.tiposCaso && criterios.tiposCaso.length > 0 ? criterios.tiposCaso : undefined,
    p_ciudad: ciudad || undefined,
  }
  const { data, error } = await supabase.rpc('buscar_abogados', argumentos)
  if (error) throw error
  return (data ?? []).map(perfilDesdeRpc)
}

/**
 * Perfil público (CU 08) a partir de la misma proyección.
 *
 * La RPC solo devuelve filas elegibles: cuenta activa, perfil activo y visible, versión
 * aprobada y verificación vigente. Por eso ya no llegan `activo`, `visibilidad` ni
 * `version_aprobada_id`: el servidor las verifica.
 *
 * - Arreglo vacío → el perfil no está disponible públicamente (`null`).
 * - Error de la RPC → se propaga como error; nunca se devuelven datos locales ni se
 *   confunde con un perfil inexistente.
 */
export async function cargarPerfilPublico(perfilId: string): Promise<PerfilPublico | null> {
  const { data, error } = await supabase.rpc('buscar_abogados', { p_perfil_id: perfilId })
  if (error) throw error
  const fila = data?.[0]
  if (!fila) return null
  return perfilPublicoDesdeRpc(fila)
}

/**
 * Ciudades declaradas por perfiles públicos y activos, para sugerir en el filtro.
 * Usa la misma proyección (no la tabla) y pagina, de modo que una ciudad no quede fuera
 * por el límite de filas de la API. Es una ayuda de escritura: el filtro es texto libre.
 */
export async function listarCiudadesDisponibles(): Promise<string[]> {
  const ciudades = new Set<string>()
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error } = await supabase
      .rpc('buscar_abogados', {})
      .select('ciudad_atencion')
      .range(desde, desde + TAMANO_PAGINA - 1)
    if (error) throw error
    const filas = data ?? []
    for (const fila of filas) {
      // Obligatoria en la proyección, pero se comprueba antes de recortar.
      const ciudad = typeof fila.ciudad_atencion === 'string' ? fila.ciudad_atencion.trim() : ''
      if (ciudad) ciudades.add(ciudad)
    }
    if (filas.length < TAMANO_PAGINA) break
  }
  return [...ciudades].sort((a, b) => a.localeCompare(b, 'es'))
}
