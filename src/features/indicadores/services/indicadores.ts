// Indicadores administrativos agregados (CU 14).
//
// Solo la administración puede leer las tablas base implicadas: las políticas RLS de
// `cuentas`, `solicitudes_contacto` y `perfiles_abogados` reservan la lectura completa a
// es_admin(). Si la sesión no es administrativa, las consultas fallan y la página muestra el
// error de permiso en lugar de contadores en cero.
//
// Todos los valores son conteos exactos (count: 'exact', head: true) sobre las tablas base:
// no se estiman, no se extrapolan y no se incluye ningún relato de caso ni contenido de
// conversaciones.
//
// BRECHA DEL ESQUEMA (documentada también en la interfaz): `perfiles_abogados` no tiene una
// columna de fecha de alta como `creada_en`. Por eso los totales de perfiles son una FOTO
// ACTUAL que no puede filtrarse por periodo; se calculan sin rango de fechas y se informan
// aparte de los totales del periodo.

import { supabase } from '../../../lib/supabase'
import type { Enums } from '../../../types/supabase'
import type {
  EstadoCuenta,
  EstadoSolicitud,
  RolCuenta,
  VisibilidadPerfil,
} from '../../../utils/etiquetas'

export type { RolCuenta, EstadoCuenta, EstadoSolicitud, VisibilidadPerfil }

export type PeriodoIndicadores = { desde: string; hasta: string }

export type ConteoPorClave<Clave extends string> = Record<Clave, number>

export type IndicadoresPeriodo = {
  /** Periodo realmente aplicado a las consultas, en ISO 8601. */
  periodo: PeriodoIndicadores
  /** Cuentas creadas en el periodo (`cuentas.creada_en`). */
  cuentasPorRol: ConteoPorClave<RolCuenta>
  cuentasPorEstado: ConteoPorClave<EstadoCuenta>
  /** Solicitudes de contacto enviadas en el periodo (`solicitudes_contacto.enviada_en`). */
  solicitudesPorEstado: ConteoPorClave<EstadoSolicitud>
  /** Subconjunto de las solicitudes del periodo registradas sin clasificación. */
  solicitudesSinClasificar: number
}

/**
 * Totales de perfiles profesionales: foto actual, sin filtro de periodo porque el esquema no
 * registra la fecha de alta del perfil.
 */
export type IndicadoresPerfiles = {
  porVisibilidad: ConteoPorClave<VisibilidadPerfil>
  activos: number
  inactivos: number
  /** Con versión profesional aprobada vigente (version_aprobada_id no nulo). */
  conVerificacionAprobada: number
  /** Sin versión aprobada: requiere decisión administrativa. */
  sinVerificacionAprobada: number
}

export type Indicadores = {
  delPeriodo: IndicadoresPeriodo
  perfiles: IndicadoresPerfiles
  /** Fecha de la consulta; contextualiza la foto actual de perfiles. */
  consultadoEn: string
}

type RangoFecha = { columna: string; desde: string; hasta: string }

/**
 * Conteo exacto de filas que cumplen una condición. El rango de fechas solo se aplica cuando la
 * tabla dispone de una columna de fecha real; los indicadores de perfiles se piden sin rango.
 */
async function contar(
  tabla: 'cuentas' | 'solicitudes_contacto' | 'perfiles_abogados',
  condiciones: Record<string, string | boolean>,
  rangoFecha?: RangoFecha,
): Promise<number> {
  let consulta = supabase.from(tabla).select('*', { count: 'exact', head: true })
  for (const [columna, valor] of Object.entries(condiciones)) {
    consulta = consulta.eq(columna, valor)
  }
  if (rangoFecha) {
    consulta = consulta.gte(rangoFecha.columna, rangoFecha.desde).lte(rangoFecha.columna, rangoFecha.hasta)
  }
  const { count, error } = await consulta
  if (error) throw error
  return count ?? 0
}

/** Conteo de perfiles según la presencia de la versión profesional aprobada vigente. */
async function contarPerfilesPorVerificacion(aprobada: boolean): Promise<number> {
  const consulta =
    supabase.from('perfiles_abogados').select('*', { count: 'exact', head: true })
  const { count, error } = aprobada
    ? await consulta.not('version_aprobada_id', 'is', null)
    : await consulta.is('version_aprobada_id', null)
  if (error) throw error
  return count ?? 0
}

/** Estados de cuenta admitidos por el contrato (Enums<'estado_cuenta'>). */
const ESTADOS_CUENTA: Enums<'estado_cuenta'>[] = ['activa', 'suspendida', 'inactiva']
const ROLES_CUENTA: Enums<'rol_cuenta'>[] = ['ciudadano', 'abogado', 'administrador']
const ESTADOS_SOLICITUD: Enums<'estado_solicitud'>[] = ['pendiente', 'aceptada', 'rechazada', 'cancelada']

export async function listarIndicadores(
  desde: string,
  hasta: string,
): Promise<Indicadores> {
  const rango = { columna: 'creada_en', desde, hasta }

  // 1) Cuentas creadas en el periodo, por rol y por estado (cuentas.creada_en).
  const [ciudadanos, abogados, administradores] = await Promise.all(
    ROLES_CUENTA.map((rol) => contar('cuentas', { rol }, rango)),
  )
  const [activas, suspendidas, inactivas] = await Promise.all(
    ESTADOS_CUENTA.map((estado) => contar('cuentas', { estado }, rango)),
  )

  // 2) Solicitudes de contacto enviadas en el periodo, por estado y sin clasificar
  //    (solicitudes_contacto.enviada_en).
  const rangoSolicitudes = { columna: 'enviada_en', desde, hasta }
  const [pendientes, aceptadas, rechazadas, canceladas, sinClasificar] = await Promise.all([
    ...ESTADOS_SOLICITUD.map((estado) => contar('solicitudes_contacto', { estado }, rangoSolicitudes)),
    contar('solicitudes_contacto', { sin_clasificar: true }, rangoSolicitudes),
  ])

  // 3) Perfiles: foto actual sin filtro de periodo (el esquema no registra fecha de alta).
  const [publicos, ocultos, activos, inactivos, conVerificacion, sinVerificacion] = await Promise.all([
    contar('perfiles_abogados', { visibilidad: 'publico' }),
    contar('perfiles_abogados', { visibilidad: 'oculto' }),
    contar('perfiles_abogados', { activo: true }),
    contar('perfiles_abogados', { activo: false }),
    contarPerfilesPorVerificacion(true),
    contarPerfilesPorVerificacion(false),
  ])

  return {
    delPeriodo: {
      periodo: { desde, hasta },
      cuentasPorRol: {
        ciudadano: ciudadanos,
        abogado: abogados,
        administrador: administradores,
      },
      cuentasPorEstado: {
        activa: activas,
        suspendida: suspendidas,
        inactiva: inactivas,
      },
      solicitudesPorEstado: {
        pendiente: pendientes,
        aceptada: aceptadas,
        rechazada: rechazadas,
        cancelada: canceladas,
      },
      solicitudesSinClasificar: sinClasificar,
    },
    perfiles: {
      porVisibilidad: { publico: publicos, oculto: ocultos },
      activos,
      inactivos,
      conVerificacionAprobada: conVerificacion,
      sinVerificacionAprobada: sinVerificacion,
    },
    consultadoEn: new Date().toISOString(),
  }
}

/** Suma de los conteos del periodo: sirve para distinguir «sin registros» de un cero aislado. */
export function totalDelPeriodo(delPeriodo: IndicadoresPeriodo): number {
  const cuentas = Object.values(delPeriodo.cuentasPorRol).reduce((total, valor) => total + valor, 0)
  const solicitudes = Object.values(delPeriodo.solicitudesPorEstado).reduce((total, valor) => total + valor, 0)
  return cuentas + solicitudes
}
