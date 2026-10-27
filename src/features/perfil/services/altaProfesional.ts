// Secuencia del alta profesional (CU 02) para una cuenta ya confirmada que todavía no
// tiene perfil. Este servicio sólo ORDENA los pasos y acumula avisos: las escrituras
// viven en `registroAbogado.ts` (perfil, declaraciones y primera versión) y en
// `almacenamiento.ts` (evidencias privadas). La fotografía se adjunta después, desde el
// panel de Información, cuando el perfil ya existe.
// Si un paso complementario falla, el alta sigue siendo utilizable y el aviso se
// comunica al usuario; nunca se declara un éxito total.

import type { Json } from '../../../types/supabase'
import type { VisibilidadPerfil } from '../../../utils/etiquetas'
import {
  validarArchivoEvidencia,
  validarEspecialidades,
  validarIdentificacion,
  validarPractica,
} from '../../../utils/validaciones'
import { crearPerfilAbogado, declararAreasYTipos, presentarVersionInicial, subirEvidencias } from './registroAbogado'

export type MediosContactoAlta = {
  correo?: string
  telefono?: string
  whatsapp?: string
  sitio_web?: string
  direccion?: string
}

export type DatosAltaProfesional = {
  nombreProfesional: string
  descripcion: string
  experienciaAnios: number
  ciudadAtencion: string
  formacionDeclarada?: string | null
  modalidad?: string | null
  horarios?: string | null
  tarifasOrientativas?: string | null
  mediosContacto?: MediosContactoAlta | null
  areaIds: string[]
  tipoCasoIds: string[]
  identificacionPrivada: string
  tarjetaProfesional: string
  archivos?: File[]
  /** Claves de CAMPOS_OPCIONALES que el abogado autoriza publicar. */
  camposPublicos?: Record<string, boolean>
  /** Autorización de publicación elegida por el titular. Por defecto, perfil oculto. */
  visibilidad?: VisibilidadPerfil
}

export type ResultadoAlta = {
  perfilId: string
  /** Pasos complementarios que fallaron después de crear el perfil; el alta sigue utilizable. */
  avisos: string[]
}

const CLAVES_MEDIOS = ['correo', 'telefono', 'whatsapp', 'sitio_web', 'direccion'] as const

/** Sólo se conservan medios de contacto con valor textual no vacío. */
function mediosAJson(medios: MediosContactoAlta | null | undefined): Json | null {
  if (!medios) return null
  const resultado: Record<string, string> = {}
  for (const clave of CLAVES_MEDIOS) {
    const valor = medios[clave]
    if (typeof valor === 'string' && valor.trim()) resultado[clave] = valor.trim()
  }
  return Object.keys(resultado).length > 0 ? resultado : null
}

/**
 * Completa el alta profesional de una cuenta autenticada: 1) perfil con visibilidad
 * oculta, 2) áreas y tipos de caso, 3) primera versión verificable pendiente y
 * 4) evidencias en el bucket privado. La fotografía no se carga aquí: sin perfil no
 * existe la ruta {cuentaId}/foto/{perfilId}/, así que se adjunta desde Información una
 * vez creado el perfil.
 */
export async function completarAltaProfesional(
  cuentaId: string,
  datos: DatosAltaProfesional,
): Promise<ResultadoAlta> {
  const archivos = datos.archivos ?? []

  // Se valida todo antes de crear cualquier fila, con la misma política del formulario.
  const erroresPractica = validarPractica({
    nombreProfesional: datos.nombreProfesional,
    ciudadAtencion: datos.ciudadAtencion,
    experienciaAnios: datos.experienciaAnios,
    descripcion: datos.descripcion,
    formacionDeclarada: datos.formacionDeclarada,
    horarios: datos.horarios,
    tarifasOrientativas: datos.tarifasOrientativas,
    modalidad: datos.modalidad,
    mediosContacto: datos.mediosContacto,
  })
  const [primero] = Object.values(erroresPractica)
  if (primero) throw new Error(primero)

  const problemaIdentificacion = validarIdentificacion(
    datos.identificacionPrivada,
    'tu número de identificación',
  )
  if (problemaIdentificacion) throw new Error(problemaIdentificacion)
  const problemaTarjeta = validarIdentificacion(datos.tarjetaProfesional, 'el número de tu tarjeta profesional')
  if (problemaTarjeta) throw new Error(problemaTarjeta)

  const problemaAreas = validarEspecialidades(new Set(datos.areaIds).size)
  if (problemaAreas) throw new Error(problemaAreas)
  const problemaTipos = validarEspecialidades(new Set(datos.tipoCasoIds).size)
  if (problemaTipos) throw new Error(problemaTipos)

  for (const archivo of archivos) {
    const problema = validarArchivoEvidencia(archivo)
    if (problema) throw new Error(`«${archivo.name}»: ${problema}`)
  }

  const perfil = await crearPerfilAbogado(cuentaId, {
    nombreProfesional: datos.nombreProfesional,
    descripcion: datos.descripcion,
    experienciaAnios: datos.experienciaAnios,
    ciudadAtencion: datos.ciudadAtencion,
    formacionDeclarada: datos.formacionDeclarada,
    modalidad: datos.modalidad,
    horarios: datos.horarios,
    tarifasOrientativas: datos.tarifasOrientativas,
    mediosContacto: mediosAJson(datos.mediosContacto),
    camposPublicos: datos.camposPublicos ?? {},
    visibilidad: datos.visibilidad,
  })

  const avisos: string[] = []

  try {
    await declararAreasYTipos(perfil.id, datos.areaIds, datos.tipoCasoIds)
  } catch {
    avisos.push('No se pudieron registrar las áreas y los tipos de caso declarados.')
  }

  let versionId: string | null = null
  try {
    const version = await presentarVersionInicial(perfil.id, {
      identificacionPrivada: datos.identificacionPrivada,
      tarjetaProfesional: datos.tarjetaProfesional,
    })
    versionId = version.id
  } catch {
    avisos.push('No se pudo presentar la versión con tu información verificable.')
  }

  if (versionId && archivos.length > 0) {
    try {
      await subirEvidencias(versionId, cuentaId, archivos)
    } catch {
      avisos.push('Una o más evidencias no pudieron registrarse en el almacén privado.')
    }
  }

  return { perfilId: perfil.id, avisos }
}
