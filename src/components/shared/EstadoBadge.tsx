import type { ReactNode } from 'react'
import { Badge, type BadgeProps } from '@chakra-ui/react'
import {
  ETIQUETA_ESTADO_CUENTA,
  ETIQUETA_ESTADO_PETICION,
  ETIQUETA_ESTADO_REVISION,
  ETIQUETA_ESTADO_SOLICITUD,
  ETIQUETA_VISIBILIDAD,
  type EstadoCuenta,
  type EstadoPeticionPriv,
  type EstadoRevisionProf,
  type EstadoSolicitud,
  type VisibilidadPerfil,
} from '../../utils/etiquetas'

type Tono = NonNullable<BadgeProps['colorPalette']>

function Etiqueta({ children, tono }: { children: ReactNode; tono: Tono }) {
  return (
    <Badge colorPalette={tono} variant="subtle" size="sm">
      {children}
    </Badge>
  )
}

export function EstadoSolicitudBadge({ estado }: { estado: EstadoSolicitud }) {
  const tonos: Record<EstadoSolicitud, Tono> = {
    pendiente: 'orange',
    aceptada: 'green',
    rechazada: 'red',
    cancelada: 'gray',
  }
  return <Etiqueta tono={tonos[estado]}>{ETIQUETA_ESTADO_SOLICITUD[estado]}</Etiqueta>
}

export function EstadoRevisionBadge({ estado }: { estado: EstadoRevisionProf }) {
  const tonos: Record<EstadoRevisionProf, Tono> = {
    pendiente: 'blue',
    en_revision: 'orange',
    aprobada: 'green',
    rechazada: 'red',
    requiere_correcciones: 'orange',
  }
  return <Etiqueta tono={tonos[estado]}>{ETIQUETA_ESTADO_REVISION[estado]}</Etiqueta>
}

export function EstadoPeticionBadge({ estado }: { estado: EstadoPeticionPriv }) {
  const tonos: Record<EstadoPeticionPriv, Tono> = {
    pendiente: 'orange',
    en_proceso: 'blue',
    resuelta: 'green',
  }
  return <Etiqueta tono={tonos[estado]}>{ETIQUETA_ESTADO_PETICION[estado]}</Etiqueta>
}

export function EstadoCuentaBadge({ estado }: { estado: EstadoCuenta }) {
  const tonos: Record<EstadoCuenta, Tono> = { activa: 'green', suspendida: 'red', inactiva: 'gray' }
  return <Etiqueta tono={tonos[estado]}>{ETIQUETA_ESTADO_CUENTA[estado]}</Etiqueta>
}

export function VisibilidadBadge({ visibilidad }: { visibilidad: VisibilidadPerfil }) {
  return (
    <Etiqueta tono={visibilidad === 'publico' ? 'green' : 'gray'}>{ETIQUETA_VISIBILIDAD[visibilidad]}</Etiqueta>
  )
}

/** Una aprobación vigente es la única condición de verificación que se muestra públicamente. */
export function VerificacionBadge({ fechaVerificacion }: { fechaVerificacion: string | null | undefined }) {
  return fechaVerificacion ? (
    <Etiqueta tono="green">Verificación aprobada</Etiqueta>
  ) : (
    <Etiqueta tono="orange">Sin verificación aprobada</Etiqueta>
  )
}
