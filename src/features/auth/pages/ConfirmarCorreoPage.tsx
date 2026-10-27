// Confirmación del correo (CU 01 y CU 02). Ruta /auth/callback: Supabase procesa el
// enlace del correo y, si la confirmación es válida, abre la sesión del titular.

import { Box, Button, Card, Flex, Heading, Link as ChakraLink, List, Stack, Text } from '@chakra-ui/react'
import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, CheckCircle2, LogIn, MailCheck } from 'lucide-react'
import { FeedbackState } from '../../../components/shared/FeedbackState'
import { rutaInicialPorRol } from '../../../app/navigation'
import { useAltaProfesional } from '../../perfil/hooks/useAltaProfesional'
import { useSesion } from '../hooks/useSesion'
import { useAuthEmailLink } from '../hooks/useAuthEmailLink'

export function ConfirmarCorreoPage() {
  const { estado, usuario, cuenta, error } = useSesion()
  const enlace = useAuthEmailLink('signup')
  // Misma regla que el guardia de rutas: si el alta profesional está a medias, el botón
  // lleva directamente a completarla en lugar de a una sección que será redirigida.
  const alta = useAltaProfesional(cuenta?.rol === 'abogado' ? cuenta.id : null)
  const destino = cuenta
    ? cuenta.rol === 'abogado' && alta.requiereCompletar
      ? '/completar-perfil'
      : rutaInicialPorRol(cuenta.rol)
    : '/login'

  const esperandoCuentaConfirmada = enlace.valid && estado !== 'error' &&
    (usuario?.id !== enlace.userId || cuenta?.id !== enlace.userId)
  if (enlace.checking || estado === 'cargando' || esperandoCuentaConfirmada) {
    return (
      <FeedbackState
        kind="loading"
        title="Confirmando tu correo"
        description="Estamos comprobando el enlace y tu sesión."
      />
    )
  }

  if (enlace.error || estado === 'error') {
    return (
      <FeedbackState
        kind="error"
        title="No pudimos completar la confirmación"
        description={enlace.error ?? error ?? 'Vuelve a abrir el enlace del correo o solicita uno nuevo.'}
        action={
          <Stack direction="row" gap="3">
            <Button asChild>
              <Link to="/login">Ir a iniciar sesión</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/registro">Crear una cuenta</Link>
            </Button>
          </Stack>
        }
      />
    )
  }

  if (estado === 'con-sesion' && usuario) {
    return (
      <Stack gap="8" maxW="2xl" mx="auto">
        <Card.Root>
          <Card.Body gap="5">
            <Flex align="center" gap="3">
              <Box color="primary" bg="bg.subtle" p="3" borderRadius="full">
                {cuenta?.rol === 'abogado' ? <BadgeCheck aria-hidden size={26} /> : <CheckCircle2 aria-hidden size={26} />}
              </Box>
              <Stack gap="1">
                <Text textStyle="label-caps" color="secondary">CORREO CONFIRMADO</Text>
                <Heading as="h1" textStyle="headline-md" color="primary">
                  Tu cuenta está activa
                </Heading>
              </Stack>
            </Flex>
            <Text color="fg.muted">
              Confirmamos <Text as="span" fontWeight="600">{usuario.email}</Text> y tu sesión está iniciada
              {cuenta ? ` como ${cuenta.rol === 'abogado' ? 'cuenta profesional' : cuenta.rol === 'administrador' ? 'cuenta administrativa' : 'cuenta de ciudadano'}` : ''}.
            </Text>
            {cuenta?.rol === 'abogado' && (
              <List.Root gap="2" textStyle="body-sm" color="fg.muted">
                {alta.requiereCompletar ? (
                  <List.Item>
                    Tu alta profesional está a medias: pulsa «Completar mi perfil» para adjuntar tus soportes documentales
                    (identificación y acreditación). Quedan en el repositorio privado, junto a la versión que ya está
                    pendiente, y sólo los consulta la revisión administrativa.
                  </List.Item>
                ) : (
                  <List.Item>
                    Tu inscripción quedó registrada con su presentación verificable y pendiente de revisión administrativa.
                  </List.Item>
                )}
                <List.Item>
                  Mientras el alta no esté completa no podrás recibir solicitudes ni usar la mensajería; tu cuenta, tu
                  privacidad y tus notificaciones siguen disponibles.
                </List.Item>
                <List.Item>
                  El perfil permanece oculto y no aparece en el directorio hasta que exista una verificación aprobada.
                </List.Item>
              </List.Root>
            )}
            <Flex gap="3" wrap="wrap">
              <Button asChild>
                <Link to={destino}>
                  <ArrowRight aria-hidden size={18} />
                  {cuenta?.rol === 'abogado' && alta.requiereCompletar ? 'Completar mi perfil' : 'Continuar'}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/directorio">Ver el directorio público</Link>
              </Button>
            </Flex>
          </Card.Body>
        </Card.Root>
      </Stack>
    )
  }

  return (
    <Stack gap="8" maxW="2xl" mx="auto">
      <Card.Root>
        <Card.Body gap="5">
          <Flex align="center" gap="3">
            <Box color="primary" bg="bg.subtle" p="3" borderRadius="full">
              <MailCheck aria-hidden size={26} />
            </Box>
            <Stack gap="1">
              <Text textStyle="label-caps" color="secondary">CONFIRMACIÓN DE CORREO</Text>
              <Heading as="h1" textStyle="headline-md" color="primary">
                Confirma tu cuenta desde el correo
              </Heading>
            </Stack>
          </Flex>

          <Text color="fg.muted">
            Abriste la dirección de confirmación, pero no hay una sesión activa. El enlace pudo consumirse en otro
            dispositivo o caducar. Inicia sesión con tu correo y contraseña: si tu cuenta ya está confirmada, entrarás
            directamente a tus secciones.
          </Text>

          <List.Root gap="2" textStyle="body-sm" color="fg.muted">
            <List.Item>La confirmación es necesaria antes del primer inicio de sesión.</List.Item>
            <List.Item>Las cuentas profesionales quedan pendientes de revisión administrativa tras confirmarse.</List.Item>
            <List.Item>Las aceptaciones registradas conservan la fecha y la versión del documento aceptado.</List.Item>
          </List.Root>

          <Flex gap="3" wrap="wrap">
            <Button asChild>
              <Link to="/login">
                <LogIn aria-hidden size={18} />
                Iniciar sesión
              </Link>
            </Button>
            <ChakraLink asChild textStyle="body-sm" color="primary" alignSelf="center">
              <Link to="/registro">Crear una cuenta</Link>
            </ChakraLink>
          </Flex>
        </Card.Body>
      </Card.Root>
    </Stack>
  )
}
