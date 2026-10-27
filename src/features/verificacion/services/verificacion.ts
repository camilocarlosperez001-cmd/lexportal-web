// Servicio administrativo de verificación profesional (CU 03) y revalidación (CU 18).
// Todo el acceso a Supabase de este módulo vive aquí. La autorización real la aplican
// las políticas RLS: la administración es la única cuenta que puede escribir en
// versiones_profesionales, revisiones_profesionales, politica_revalidacion y en la
// suspensión de perfiles. La aprobación de una versión NO se replica en el cliente:
// el trigger procesar_revision_profesional fija la versión aprobada, la fecha de
// verificación vigente y genera el aviso al abogado.

import { supabase } from '../../../lib/supabase'
import type { Tables } from '../../../types/supabase'

export type VersionProfesional = Tables<'versiones_profesionales'>
export type RevisionProfesional = Tables<'revisiones_profesionales'>
export type EvidenciaPrivada = Tables<'evidencias_privadas'>
export type PerfilAbogado = Tables<'perfiles_abogados'>
export type PoliticaRevalidacion = Tables<'politica_revalidacion'>
export type EstadoRevisionProf = Tables<'revisiones_profesionales'>['estado']
export type TipoRevisionProf = Tables<'revisiones_profesionales'>['tipo']

/** Bucket privado de evidencias. Solo se accede con enlaces firmados temporales. */
export const BUCKET_EVIDENCIAS = 'evidencias-privadas'

/** Vigencia del enlace firmado de una evidencia, en segundos. */
export const SEGUNDOS_ENLACE_EVIDENCIA = 60

/** Periodicidad máxima admisible al fijar la política de revalidación, en días. */
export const MAX_DIAS_REVALIDACION = 3650

/** Estados de revisión que la administración puede fijar como decisión. */
export const ESTADOS_DECISION: EstadoRevisionProf[] = [
  'aprobada',
  'requiere_correcciones',
  'rechazada',
  'en_revision',
  'pendiente',
]

/** Estados que exigen motivo escrito: la decisión debe quedar fundamentada. */
export const ESTADOS_CON_MOTIVO_OBLIGATORIO: EstadoRevisionProf[] = ['requiere_correcciones', 'rechazada']

export type ResumenCuenta = Pick<Tables<'cuentas'>, 'id' | 'nombre_completo' | 'correo' | 'estado' | 'rol'>

/** Perfil asociado a una versión en revisión, con los campos que decide la administración. */
export type PerfilEnRevision = Pick<
  PerfilAbogado,
  | 'id'
  | 'cuenta_id'
  | 'nombre_profesional'
  | 'ciudad_atencion'
  | 'visibilidad'
  | 'activo'
  | 'version_aprobada_id'
  | 'fecha_verificacion_vigente'
  | 'alcance_verificacion_vigente'
  | 'motivo_suspension'
  | 'suspendido_en'
>

export type VersionEnRevision = Pick<
  VersionProfesional,
  'id' | 'perfil_id' | 'numero_version' | 'estado_revision' | 'presentada_en'
>

export type FilaRevisionPendiente = {
  version: VersionEnRevision
  perfil: PerfilEnRevision
  cuenta: ResumenCuenta | null
}

export type DetalleVersion = {
  version: VersionProfesional
  perfil: PerfilEnRevision
  cuenta: ResumenCuenta | null
  evidencias: EvidenciaPrivada[]
  revisiones: RevisionProfesional[]
  /** Versión aprobada vigente del perfil, si existe y es distinta de la revisada. */
  versionAprobada: VersionEnRevision | null
}

export type ResultadoConsulta = {
  fuenteOficial: string
  resultadoConsulta: string
}

export type DecisionRevision = {
  estado: EstadoRevisionProf
  decision: string
  motivo?: string | null
  alcance?: string | null
  proximaRevision?: string | null
}

export type FilaRevalidacion = {
  revision: RevisionProfesional
  version: VersionEnRevision
  perfil: PerfilEnRevision
  /** Fecha prevista superada sin decisión registrada. */
  vencida: boolean
  /** Fecha prevista futura, todavía no atendida. */
  programada: boolean
}

export type FilaHistorial = {
  revision: RevisionProfesional
  version: VersionEnRevision | null
  perfil: PerfilEnRevision | null
  responsable: ResumenCuenta | null
}

export type PerfilSuspendido = PerfilEnRevision & {
  cuenta: ResumenCuenta | null
}

const COLUMNAS_PERFIL =
  'id, cuenta_id, nombre_profesional, ciudad_atencion, visibilidad, activo, version_aprobada_id, fecha_verificacion_vigente, alcance_verificacion_vigente, motivo_suspension, suspendido_en'

const COLUMNAS_CUENTA = 'id, nombre_completo, correo, estado, rol'

const COLUMNAS_VERSION = 'id, perfil_id, numero_version, estado_revision, presentada_en'

const COLUMNAS_REVISION =
  'id, version_id, tipo, estado, programada_en, responsable_id, fuente_oficial, resultado_consulta, consultada_en, decision, motivo, alcance, decidida_en, proxima_revision'

/** Fila cruda de versiones_profesionales con su perfil y la cuenta profesional incrustados. */
type FilaVersionConPerfil = VersionEnRevision & {
  perfiles_abogados: (PerfilEnRevision & { cuentas: ResumenCuenta | null }) | null
}

type FilaRevalidacionCruda = RevisionProfesional & {
  versiones_profesionales: (VersionEnRevision & { perfiles_abogados: PerfilEnRevision | null }) | null
}

type FilaHistorialCruda = RevisionProfesional & {
  versiones_profesionales: (VersionEnRevision & { perfiles_abogados: PerfilEnRevision | null }) | null
}

function estaVencida(fecha: string | null): boolean {
  if (!fecha) return false
  const valor = new Date(fecha).getTime()
  return !Number.isNaN(valor) && valor < Date.now()
}

function claveFecha(valor: string | null): number {
  if (!valor) return 0
  const fecha = new Date(valor).getTime()
  return Number.isNaN(fecha) ? 0 : fecha
}

/**
 * Versiones presentadas pendientes de decisión (CU 03), con el perfil y la cuenta
 * profesional. La administración puede leer `cuentas`; el abogado solo las suyas.
 *
 * Entre `versiones_profesionales` y `perfiles_abogados` existen dos relaciones: la
 * directa `vers_prof_perfil_fk` y la compuesta inversa `perfil_version_aprobada_fk`
 * (creada por la referencia circular de la versión aprobada). PostgREST no puede
 * elegir sola y responde PGRST201, así que la inclusión se indica con el nombre de
 * la clave foránea.
 */
export async function listarVersionesEnRevision(): Promise<FilaRevisionPendiente[]> {
  const { data, error } = await supabase
    .from('versiones_profesionales')
    .select(`${COLUMNAS_VERSION}, perfiles_abogados!vers_prof_perfil_fk(${COLUMNAS_PERFIL}, cuentas(${COLUMNAS_CUENTA}))`)
    .in('estado_revision', ['pendiente', 'en_revision'])
    .order('presentada_en', { ascending: true })
    .returns<FilaVersionConPerfil[]>()
  if (error) throw error

  const filas: FilaRevisionPendiente[] = []
  for (const fila of data) {
    const perfil = fila.perfiles_abogados
    // Sin perfil legible no se puede revisar la versión: se omite en lugar de romper la cola.
    if (!perfil) continue
    const { cuentas, ...datosPerfil } = perfil
    filas.push({
      version: {
        id: fila.id,
        perfil_id: fila.perfil_id,
        numero_version: fila.numero_version,
        estado_revision: fila.estado_revision,
        presentada_en: fila.presentada_en,
      },
      perfil: datosPerfil,
      cuenta: cuentas,
    })
  }
  return filas
}

/** Versión completa para revisión: perfil, cuenta, evidencias privadas e historial. */
export async function cargarVersionParaRevision(versionId: string): Promise<DetalleVersion> {
  const { data, error } = await supabase
    .from('versiones_profesionales')
    .select(`*, perfiles_abogados!vers_prof_perfil_fk(${COLUMNAS_PERFIL}, cuentas(${COLUMNAS_CUENTA}))`)
    .eq('id', versionId)
    .maybeSingle<VersionProfesional & { perfiles_abogados: (PerfilEnRevision & { cuentas: ResumenCuenta | null }) | null }>()
  if (error) throw error
  if (!data) throw new Error('La versión solicitada no existe o no tienes acceso a ella.')

  const { perfiles_abogados: perfilConCuenta, ...version } = data
  if (!perfilConCuenta) throw new Error('La versión solicitada no tiene perfil asociado.')
  const { cuentas, ...perfil } = perfilConCuenta

  const [evidencias, revisiones, versionAprobada] = await Promise.all([
    cargarEvidenciasDeVersion(versionId),
    cargarRevisionesDeVersion(versionId),
    cargarVersionAprobada(perfil),
  ])

  return { version, perfil, cuenta: cuentas, evidencias, revisiones, versionAprobada }
}

async function cargarEvidenciasDeVersion(versionId: string): Promise<EvidenciaPrivada[]> {
  const { data, error } = await supabase
    .from('evidencias_privadas')
    .select('id, version_id, tipo, ruta_storage_privada, aportada_en, retener_hasta')
    .eq('version_id', versionId)
    .order('aportada_en', { ascending: true })
  if (error) throw error
  return data
}

/** Historial de revisiones de la versión, de la más reciente a la más antigua. */
export async function cargarRevisionesDeVersion(versionId: string): Promise<RevisionProfesional[]> {
  const { data, error } = await supabase
    .from('revisiones_profesionales')
    .select(COLUMNAS_REVISION)
    .eq('version_id', versionId)
    .order('decidida_en', { ascending: false })
  if (error) throw error
  return data
}

async function cargarVersionAprobada(perfil: PerfilEnRevision): Promise<VersionEnRevision | null> {
  if (!perfil.version_aprobada_id) return null
  const { data, error } = await supabase
    .from('versiones_profesionales')
    .select(COLUMNAS_VERSION)
    .eq('id', perfil.version_aprobada_id)
    .maybeSingle<VersionEnRevision>()
  if (error) throw error
  return data
}

/**
 * Abre la revisión administrativa de una versión (CU 03) y devuelve su identificador.
 *
 * La RPC `iniciar_revision_profesional` hace las dos escrituras en una sola transacción:
 * exige administración autenticada, marca la versión como 'en_revision' y crea la revisión
 * de tipo 'inicial'. Es idempotente: si ya existe una revisión abierta, la reutiliza. El
 * responsable lo deriva de la sesión, así que el cliente ya no lo envía.
 */
export async function iniciarRevision(versionId: string): Promise<string> {
  const { data, error } = await supabase.rpc('iniciar_revision_profesional', {
    p_version_id: versionId,
  })
  if (error || !data) throw error ?? new Error('No se confirmó el inicio de revisión.')
  return data
}

/** Registra la consulta a la fuente oficial con su fecha. Obligatorio antes de decidir. */
export async function registrarResultadoConsulta(
  revisionId: string,
  { fuenteOficial, resultadoConsulta }: ResultadoConsulta,
): Promise<void> {
  const { data, error } = await supabase
    .from('revisiones_profesionales')
    .update({
      fuente_oficial: fuenteOficial,
      resultado_consulta: resultadoConsulta,
      consultada_en: new Date().toISOString(),
    })
    .eq('id', revisionId)
    // Solo revisiones abiertas: una decisión ya registrada no admite nueva consulta.
    .is('decidida_en', null)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('La revisión ya fue decidida o no está abierta.')
}

/**
 * Registra la decisión administrativa. Al pasar a 'aprobada', el trigger
 * procesar_revision_profesional fija la versión aprobada, la fecha de verificación
 * vigente y crea el aviso al abogado; no se duplica esa lógica aquí.
 * La columna `alcance` del perfil queda sin actualizar por el trigger: la interfaz
 * informa al responsable de que debe registrarla en el motivo de la decisión.
 */
export async function decidirRevision(revisionId: string, decision: DecisionRevision): Promise<void> {
  const motivo = decision.motivo?.trim() ?? ''
  if (ESTADOS_CON_MOTIVO_OBLIGATORIO.includes(decision.estado) && !motivo) {
    throw new Error('Debes registrar el motivo cuando la decisión es requerir correcciones o rechazar.')
  }

  const { data, error } = await supabase
    .from('revisiones_profesionales')
    .update({
      estado: decision.estado,
      decision: decision.decision,
      decidida_en: new Date().toISOString(),
      motivo: motivo || null,
      alcance: decision.alcance?.trim() || null,
      proxima_revision: decision.proximaRevision || null,
    })
    .eq('id', revisionId)
    // Filtro de revisión abierta + comprobación de filas: sin esto una decisión repetida
    // no cambiaría nada y la interfaz informaría de un éxito que no ocurrió.
    .is('decidida_en', null)
    .in('estado', ['pendiente', 'en_revision'])
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('La revisión ya fue decidida o no está abierta.')
}

/** Suspensión administrativa trazable del perfil: deja de mostrarse públicamente (CU 18). */
export async function suspenderPerfil(perfilId: string, motivo: string): Promise<void> {
  const texto = motivo.trim()
  if (!texto) throw new Error('Registra el motivo de la suspensión.')

  const { error } = await supabase
    .from('perfiles_abogados')
    .update({
      visibilidad: 'oculto',
      motivo_suspension: texto,
      suspendido_en: new Date().toISOString(),
    })
    .eq('id', perfilId)
  if (error) throw error
}

/**
 * Reactivación del perfil. Vuelve a 'publico' y limpia la suspensión; la aparición
 * real en el directorio depende además de la verificación vigente y de `activo`.
 */
export async function reactivarPerfil(perfilId: string): Promise<void> {
  const { error } = await supabase
    .from('perfiles_abogados')
    .update({
      visibilidad: 'publico',
      motivo_suspension: null,
      suspendido_en: null,
    })
    .eq('id', perfilId)
  if (error) throw error
}

/** Política de revalidación vigente: la última fila por `vigente_desde`. */
export async function cargarPoliticaRevalidacion(): Promise<PoliticaRevalidacion | null> {
  const { data, error } = await supabase
    .from('politica_revalidacion')
    .select('id, periodicidad_dias, vigente_desde, configurada_por')
    .order('vigente_desde', { ascending: false })
    .limit(1)
    .maybeSingle<PoliticaRevalidacion>()
  if (error) throw error
  return data
}

/**
 * Fija una nueva periodicidad. Se inserta una fila nueva para conservar el historial
 * de políticas aplicadas; no se reescribe la anterior.
 */
export async function guardarPoliticaRevalidacion(periodicidadDias: number, configuradaPor: string): Promise<void> {
  if (!Number.isInteger(periodicidadDias) || periodicidadDias <= 0) {
    throw new Error('La periodicidad debe ser un número entero de días mayor que cero.')
  }
  const { error } = await supabase.from('politica_revalidacion').insert({
    periodicidad_dias: periodicidadDias,
    configurada_por: configuradaPor,
    vigente_desde: new Date().toISOString(),
  })
  if (error) throw error
}

/** Programa una revalidación sobre una versión aprobada (nueva fila de tipo 'revalidacion'). */
export async function programarRevalidacion(
  versionId: string,
  fechaProgramada: string,
  responsableId: string,
): Promise<void> {
  const { error } = await supabase.from('revisiones_profesionales').insert({
    version_id: versionId,
    tipo: 'revalidacion',
    estado: 'pendiente',
    programada_en: fechaProgramada,
    proxima_revision: fechaProgramada,
    responsable_id: responsableId,
  })
  if (error) throw error
}

/**
 * Ejecuta la revalidación periódica en la base de datos (CU 18). La RPC existe y está
 * verificada en local; desde 20261025100000 exige administración autenticada (o
 * service_role) y programa las revisiones que correspondan. El cliente no decide qué
 * perfiles se revalidan.
 */
export async function ejecutarRevalidacionPeriodica(): Promise<void> {
  const { error } = await supabase.rpc('ejecutar_revalidacion_periodica')
  if (error) throw error
}

/**
 * Revisiones de revalidación con el perfil y la versión: programadas, vencidas y
 * decididas. El filtro por periodo se calcula sobre `proxima_revision` porque el
 * esquema no ofrece una vista agregada para ello.
 */
export async function listarRevalidaciones(): Promise<FilaRevalidacion[]> {
  const { data, error } = await supabase
    .from('revisiones_profesionales')
    .select(
      `${COLUMNAS_REVISION}, versiones_profesionales!inner(${COLUMNAS_VERSION}, perfiles_abogados!vers_prof_perfil_fk(${COLUMNAS_PERFIL}))`,
    )
    .eq('tipo', 'revalidacion')
    .returns<FilaRevalidacionCruda[]>()
  if (error) throw error

  const filas: FilaRevalidacion[] = []
  for (const fila of data) {
    const { versiones_profesionales: version, ...revision } = fila
    if (!version) continue
    const { perfiles_abogados: perfil, ...datosVersion } = version
    if (!perfil) continue
    const pendiente = revision.decidida_en === null
    filas.push({
      revision,
      version: datosVersion,
      perfil,
      vencida: pendiente && estaVencida(revision.proxima_revision),
      programada: pendiente && claveFecha(revision.proxima_revision ?? revision.programada_en) > Date.now(),
    })
  }

  return filas.sort((a, b) => {
    const fechaA = claveFecha(a.revision.proxima_revision ?? a.revision.programada_en)
    const fechaB = claveFecha(b.revision.proxima_revision ?? b.revision.programada_en)
    return fechaB - fechaA
  })
}

/**
 * Historial trazable de decisiones de revalidación: responsable, resultado y motivo.
 * El nombre del responsable se resuelve con una consulta aparte porque la relación
 * hacia `cuentas` puede ser nula (ON DELETE SET NULL).
 */
export async function listarHistorialRevalidacion(): Promise<FilaHistorial[]> {
  const { data, error } = await supabase
    .from('revisiones_profesionales')
    .select(
      `${COLUMNAS_REVISION}, versiones_profesionales(${COLUMNAS_VERSION}, perfiles_abogados!vers_prof_perfil_fk(${COLUMNAS_PERFIL}))`,
    )
    .eq('tipo', 'revalidacion')
    .not('decidida_en', 'is', null)
    .order('decidida_en', { ascending: false })
    .returns<FilaHistorialCruda[]>()
  if (error) throw error

  const responsables = await cargarCuentas(
    data.map((fila) => fila.responsable_id).filter((id): id is string => Boolean(id)),
  )

  return data.map((fila) => {
    const { versiones_profesionales: version, ...revision } = fila
    const perfil = version?.perfiles_abogados ?? null
    const datosVersion = version
      ? {
          id: version.id,
          perfil_id: version.perfil_id,
          numero_version: version.numero_version,
          estado_revision: version.estado_revision,
          presentada_en: version.presentada_en,
        }
      : null
    return {
      revision,
      version: datosVersion,
      perfil,
      responsable: revision.responsable_id ? responsables.get(revision.responsable_id) ?? null : null,
    }
  })
}

/** Perfiles suspendidos con su motivo y fecha, para la reactivación administrativa (CU 18). */
export async function listarPerfilesSuspendidos(): Promise<PerfilSuspendido[]> {
  const { data, error } = await supabase
    .from('perfiles_abogados')
    .select(`${COLUMNAS_PERFIL}, cuentas(${COLUMNAS_CUENTA})`)
    .not('suspendido_en', 'is', null)
    .order('suspendido_en', { ascending: false })
    .returns<(PerfilEnRevision & { cuentas: ResumenCuenta | null })[]>()
  if (error) throw error

  return data.map(({ cuentas, ...perfil }) => ({ ...perfil, cuenta: cuentas }))
}

async function cargarCuentas(ids: string[]): Promise<Map<string, ResumenCuenta>> {
  const unicos = [...new Set(ids)]
  if (unicos.length === 0) return new Map()
  const { data, error } = await supabase.from('cuentas').select(COLUMNAS_CUENTA).in('id', unicos)
  if (error) throw error
  return new Map(data.map((cuenta) => [cuenta.id, cuenta]))
}

/**
 * Enlace firmado temporal para una evidencia privada. Nunca es permanente y solo
 * se genera bajo demanda en el ámbito administrativo de revisión.
 */
export async function crearEnlaceEvidencia(ruta: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_EVIDENCIAS)
    .createSignedUrl(ruta, SEGUNDOS_ENLACE_EVIDENCIA)
  if (error) throw error
  return data.signedUrl
}
