// Tipos de presentación del directorio (CU 05, 06, 07 y 08). Se derivan del contrato
// generado y de la RPC buscar_abogados; nunca exponen columnas de verificación privada.

import type { AreaResumen, TipoCasoResumen, MedioContacto } from '../../utils/contrato'

/** Claves de campos opcionales que el abogado autorizó publicar (campos_opcionales_publicos). */
export type CamposPublicos = Record<string, boolean>

/** Perfil tal como se presenta en los resultados de búsqueda del directorio. */
export type PerfilDirectorio = {
  id: string
  nombreProfesional: string
  descripcion: string
  experienciaAnios: number
  ciudadAtencion: string
  fotoPublica: string | null
  modalidad: string | null
  tarifasOrientativas: string | null
  areas: AreaResumen[]
  tiposCaso: TipoCasoResumen[]
  camposPublicos: CamposPublicos
  fechaVerificacionVigente: string | null
  alcanceVerificacionVigente: string | null
}

/** Perfil público completo (CU 08). Los campos opcionales llegan recortados según lo autorizado. */
export type PerfilPublico = PerfilDirectorio & {
  formacionDeclarada: string | null
  horarios: string | null
  mediosContacto: MedioContacto[]
}

/** Filtros activos del directorio, enlazables mediante los parámetros de la URL. */
export type FiltrosDirectorio = {
  busqueda: string
  areas: string[]
  tiposCaso: string[]
  ciudad: string
}
