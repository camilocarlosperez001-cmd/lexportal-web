import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { FeedbackState } from '../../components/shared/FeedbackState'
import { useSesion } from '../../features/auth/hooks/useSesion'
import { useAltaProfesional } from '../../features/perfil/hooks/useAltaProfesional'

/**
 * Guardia de rutas del alta profesional (CU 02).
 *
 * Restringe el USO de la plataforma —solicitudes y mensajería— a los abogados con
 * verificación aprobada vigente o con la presentación completa (versión con evidencias).
 * Si el alta está a medias, redirige a «/completar-perfil».
 *
 * Alcance deliberado:
 *  - sólo actúa sobre cuentas profesionales; ciudadanos y administración pasan de largo;
 *  - nunca bloquea cuenta, privacidad, notificaciones ni las pantallas donde se completa
 *    el alta, para que el cierre tenga salida;
 *  - ante un error de consulta NO bloquea (deja pasar) y no muestra el aviso: la
 *    autorización efectiva vive en las políticas RLS y en las funciones de la base de
 *    datos, no en esta comprobación de navegación.
 */
export function RequireAltaProfesional({ children }: { children: ReactNode }) {
  const { cuenta } = useSesion()
  const alta = useAltaProfesional(cuenta?.rol === 'abogado' ? cuenta.id : null)

  if (!cuenta || cuenta.rol !== 'abogado') return <>{children}</>
  if (alta.error) return <>{children}</>

  if (alta.cargando) {
    return <FeedbackState kind="loading" title="Comprobando tu alta profesional" />
  }

  if (alta.requiereCompletar) {
    return <Navigate to="/completar-perfil" replace />
  }

  return <>{children}</>
}
