import type { ReactNode } from 'react'
import { Button, Link as ChakraLink, Stack } from '@chakra-ui/react'
import { Navigate, useLocation, Link as RouterLink } from 'react-router-dom'
import { FeedbackState } from '../../components/shared/FeedbackState'
import { useSesion } from '../../features/auth/hooks/useSesion'
import type { RolCuenta } from '../../utils/etiquetas'

type RequireSesionProps = {
  children: ReactNode
  roles?: RolCuenta[]
}

/**
 * Control de navegación por sesión y rol. Mejora la experiencia, pero no sustituye
 * la autorización: las políticas RLS y las funciones de la base de datos siguen
 * siendo las que conceden o niegan cada operación.
 */
export function RequireSesion({ children, roles }: RequireSesionProps) {
  const { estado, cuenta, error, recargar, cerrarSesion } = useSesion()
  const ubicacion = useLocation()

  if (estado === 'cargando') {
    return <FeedbackState kind="loading" title="Comprobando tu sesión" />
  }

  if (estado === 'sin-sesion') {
    const destino = `${ubicacion.pathname}${ubicacion.search}`
    return <Navigate to={`/login?redirigir=${encodeURIComponent(destino)}`} replace />
  }

  if (estado === 'error') {
    return (
      <FeedbackState
        kind="error"
        title="No pudimos cargar tu cuenta"
        description={error ?? 'Vuelve a intentarlo. Si el problema continúa, cierra la sesión y entra de nuevo.'}
        action={
          <Stack direction="row" gap="3">
            <Button onClick={() => void recargar()}>Reintentar</Button>
            <Button variant="outline" onClick={() => void cerrarSesion()}>Cerrar sesión</Button>
          </Stack>
        }
      />
    )
  }

  if (!cuenta) {
    return (
      <FeedbackState
        kind="error"
        title="Tu sesión no tiene una cuenta asociada"
        description="La cuenta no está disponible para consulta. Cierra la sesión e inténtalo de nuevo."
        action={<Button onClick={() => void cerrarSesion()}>Cerrar sesión</Button>}
      />
    )
  }

  if (roles && !roles.includes(cuenta.rol)) {
    return (
      <FeedbackState
        kind="empty"
        title="No tienes permiso para ver esta sección"
        description="Tu cuenta no tiene el rol necesario para esta función. Puedes continuar en las secciones disponibles para tu rol."
        action={
          <ChakraLink asChild fontWeight="600" color="primary">
            <RouterLink to={cuenta.rol === 'administrador' ? '/admin/verificacion' : '/cuenta'}>
              Ir a mis secciones
            </RouterLink>
          </ChakraLink>
        }
      />
    )
  }

  return <>{children}</>
}
