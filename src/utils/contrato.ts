// Lectura defensiva de los campos jsonb del contrato y de los campos opcionales publicables.
// Las columnas jsonb no tienen estructura declarada: se validan antes de usarlas como presentación.

import type { Json } from '../types/supabase'

export type AreaResumen = { id: string; nombre: string }
export type TipoCasoResumen = { id: string; nombre: string }
export type MedioContacto = { etiqueta: string; valor: string }

/** Columnas opcionales de perfiles_abogados que el abogado decide publicar (CU 08 y CU 19). */
export const CAMPOS_OPCIONALES = [
  { clave: 'foto_publica', etiqueta: 'Fotografía', ayuda: 'Imagen pública del perfil.' },
  { clave: 'formacion_declarada', etiqueta: 'Formación declarada', ayuda: 'Formación que declaras. No acredita un título de especialización.' },
  { clave: 'modalidad', etiqueta: 'Modalidad de atención', ayuda: 'Información descriptiva, no habilita videollamadas ni agenda.' },
  { clave: 'horarios', etiqueta: 'Horarios de atención', ayuda: 'Franjas en las que sueles atender.' },
  { clave: 'tarifas_orientativas', etiqueta: 'Tarifas orientativas', ayuda: 'Información descriptiva; no es una funcionalidad de cobro.' },
  { clave: 'medios_contacto', etiqueta: 'Medios de contacto', ayuda: 'Datos de contacto que autorizas mostrar en tu perfil público.' },
] as const

export type ClaveCampoOpcional = (typeof CAMPOS_OPCIONALES)[number]['clave']

const ETIQUETAS_MEDIOS: Record<string, string> = {
  correo: 'Correo',
  telefono: 'Teléfono',
  whatsapp: 'WhatsApp',
  sitio_web: 'Sitio web',
  direccion: 'Dirección',
}

function esObjeto(valor: Json | null | undefined): valor is { [clave: string]: Json | undefined } {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function esTextoNoVacio(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.trim().length > 0
}

/** Áreas devueltas por la RPC buscar_abogados en formato jsonb. */
export function leerAreas(valor: Json | null | undefined): AreaResumen[] {
  if (!Array.isArray(valor)) return []
  const areas: AreaResumen[] = []
  for (const elemento of valor) {
    if (!esObjeto(elemento)) continue
    const { id, nombre } = elemento
    if (esTextoNoVacio(id) && esTextoNoVacio(nombre)) areas.push({ id, nombre: nombre.trim() })
  }
  return areas
}

/** Tipos de caso devueltos por la RPC buscar_abogados en formato jsonb. */
export function leerTiposCaso(valor: Json | null | undefined): TipoCasoResumen[] {
  if (!Array.isArray(valor)) return []
  const tipos: TipoCasoResumen[] = []
  for (const elemento of valor) {
    if (!esObjeto(elemento)) continue
    const { id, nombre } = elemento
    if (esTextoNoVacio(id) && esTextoNoVacio(nombre)) tipos.push({ id, nombre: nombre.trim() })
  }
  return tipos
}

/**
 * Autorización explícita leída del jsonb `campos_opcionales_publicos`.
 *
 * Lo normal es el booleano `true`. Se toleran además las formas textuales `"true"` y
 * `"t"` —por ejemplo si el valor se escribió a mano por SQL—, pero NUNCA se considera
 * autorizado un `"false"` textual: mostrar un campo que el titular no autorizó sería
 * peor que ocultar uno que sí autorizó.
 */
function esAutorizacionExplicita(contenido: Json | undefined): boolean {
  if (contenido === true) return true
  if (typeof contenido === 'string') {
    const texto = contenido.trim().toLowerCase()
    return texto === 'true' || texto === 't'
  }
  return false
}

/** campos_opcionales_publicos: solo se consideran autorizadas las claves con valor true. */
export function leerCamposPublicos(valor: Json | null | undefined): Record<string, boolean> {
  if (!esObjeto(valor)) return {}
  const resultado: Record<string, boolean> = {}
  for (const [clave, contenido] of Object.entries(valor)) {
    if (esAutorizacionExplicita(contenido)) resultado[clave] = true
  }
  return resultado
}

export function campoPublicoAutorizado(campos: Record<string, boolean>, clave: ClaveCampoOpcional): boolean {
  return campos[clave] === true
}

/** medios_contacto: pares clave/valor textuales; se descarta cualquier otra forma. */
export function leerMediosContacto(valor: Json | null | undefined): MedioContacto[] {
  if (!esObjeto(valor)) return []
  const medios: MedioContacto[] = []
  for (const [clave, contenido] of Object.entries(valor)) {
    if (!esTextoNoVacio(contenido)) continue
    medios.push({ etiqueta: ETIQUETAS_MEDIOS[clave] ?? clave, valor: contenido.trim() })
  }
  return medios
}

export type ClasificacionEnviada = { tipoCaso: string | null; areas: string[]; sinClasificar: boolean }

/** clasificacion_al_enviar: instantánea de la clasificación declarada al enviar la solicitud. */
export function leerClasificacion(valor: Json | null | undefined): ClasificacionEnviada {
  if (!esObjeto(valor)) return { tipoCaso: null, areas: [], sinClasificar: false }
  const areas: string[] = []
  if (Array.isArray(valor.areas)) {
    for (const area of valor.areas) {
      if (esTextoNoVacio(area)) areas.push(area.trim())
    }
  }
  return {
    tipoCaso: esTextoNoVacio(valor.tipo_caso) ? valor.tipo_caso.trim() : null,
    areas,
    sinClasificar: valor.sin_clasificar === true,
  }
}

export const SIN_CLASIFICAR = 'sin_clasificar' as const
