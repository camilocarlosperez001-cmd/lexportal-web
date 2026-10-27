// Especialidades del perfil (CU 02): relaciones área jurídica – tipo de caso.
//
// El contrato guarda áreas y tipos en tablas separadas (`perfil_area` y `perfil_tipo_caso`),
// así que la lista de relaciones que edita la persona se descompone en esos dos conjuntos.

import type { AreaJuridica, RelacionAreaTipoCaso, TipoCaso } from '../catalogo/services/catalogo'

/** Relación declarada entre un área jurídica y un tipo de caso. */
export type Especialidad = {
  areaId: string
  /** `null` solo al reconstruir datos antiguos: un área guardada sin tipos declarados. */
  tipoCasoId: string | null
}

/** Opción mínima de catálogo: sirve tanto para las tablas como para los filtros. */
export type OpcionEspecialidad = { id: string; nombre: string }

export type CatalogoEspecialidades = {
  areas: OpcionEspecialidad[]
  tipos: OpcionEspecialidad[]
  relaciones: RelacionAreaTipoCaso[]
}

/** Adapta las tablas del catálogo a las opciones que consume el selector. */
export function catalogoDeEspecialidades(
  catalogo: { areas: AreaJuridica[]; tipos: TipoCaso[]; relaciones: RelacionAreaTipoCaso[] } | null,
): CatalogoEspecialidades | null {
  if (!catalogo) return null
  return {
    areas: catalogo.areas.map((area) => ({ id: area.id, nombre: area.nombre })),
    tipos: catalogo.tipos.map((tipo) => ({ id: tipo.id, nombre: tipo.nombre_cotidiano })),
    relaciones: catalogo.relaciones,
  }
}

/** Máximo de relaciones que admite la lista. */
export const MAX_ESPECIALIDADES = 8

/** Conjuntos que se persisten: áreas y tipos sin repeticiones. */
export function descomponerEspecialidades(especialidades: Especialidad[]): {
  areaIds: string[]
  tipoCasoIds: string[]
} {
  return {
    areaIds: [...new Set(especialidades.map((especialidad) => especialidad.areaId))],
    tipoCasoIds: [
      ...new Set(
        especialidades
          .map((especialidad) => especialidad.tipoCasoId)
          .filter((id): id is string => Boolean(id)),
      ),
    ],
  }
}

/**
 * Reconstruye la lista desde los conjuntos guardados. Cada tipo se empareja con la primera
 * área declarada que lo admite; un área declarada sin tipos se conserva como relación sin
 * tipo para no perderla al volver a guardar.
 */
export function especialidadesDesdeConjuntos(
  catalogo: CatalogoEspecialidades | null,
  areaIds: string[],
  tipoCasoIds: string[],
): Especialidad[] {
  const relaciones = catalogo?.relaciones ?? []
  const admite = (areaId: string, tipoCasoId: string) =>
    relaciones.some((relacion) => relacion.area_id === areaId && relacion.tipo_caso_id === tipoCasoId)

  const especialidades: Especialidad[] = []
  const areasUsadas = new Set<string>()

  for (const tipoCasoId of tipoCasoIds) {
    const area = areaIds.find((areaId) => admite(areaId, tipoCasoId))
    if (!area) continue
    especialidades.push({ areaId: area, tipoCasoId })
    areasUsadas.add(area)
  }
  for (const areaId of areaIds) {
    if (!areasUsadas.has(areaId)) especialidades.push({ areaId, tipoCasoId: null })
  }
  return especialidades
}
