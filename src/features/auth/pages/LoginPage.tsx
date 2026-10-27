// CU 04: autenticación y acceso por rol. Acceso real con Supabase Auth, validaciones
// asociadas a cada campo y distinción entre credenciales inválidas y fallo de red.

import { useState, type FormEvent } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  Field,
  Flex,
  Heading,
  Input,
  Link as ChakraLink,
  List,
  Stack,
  Text,
} from '@chakra-ui/react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, BadgeCheck, Info, LogIn, Search, ShieldCheck, UserRoundPlus } from 'lucide-react'
import { FeedbackState } from '../../../components/shared/FeedbackState'
import { rutaInicialPorRol } from '../../../app/navigation'
import { mensajeDeError } from '../../../utils/errores'
import { useSesion } from '../hooks/useSesion'
import { iniciarSesion } from '../services/auth'
import { esFalloDeRed, mensajeDeAcceso, rutaInterna, type ErroresFormulario } from '../types'

type CamposAcceso = { correo: string; contrasena: string }
type ErrorAcceso = ErroresFormulario<keyof CamposAcceso>

export function LoginPage() {
  const { estado, cuenta } = useSesion()
  const [parametros] = useSearchParams()
  const destino = rutaInterna(parametros.get('redirigir'))

  const [campos, setCampos] = useState<CamposAcceso>({ correo: '', contrasena: '' })
  const [errores, setErrores] = useState<ErrorAcceso>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (estado === 'cargando') {
    return <FeedbackState kind="loading" title="Comprobando tu sesión" description="Verificamos si ya tienes un acceso activo." />
  }

  if (estado === 'con-sesion' && cuenta) {
    return <Navigate to={destino ?? rutaInicialPorRol(cuenta.rol)} replace />
  }

  function actualizar(campo: keyof CamposAcceso, valor: string) {
    setCampos((actuales) => ({ ...actuales, [campo]: valor }))
    setErrores((actuales) => ({ ...actuales, [campo]: undefined }))
    setErrorGeneral(null)
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (enviando) return

    const nuevos: ErrorAcceso = {}
    if (!campos.correo.trim()) nuevos.correo = 'Ingresa tu correo electrónico.'
    if (!campos.contrasena) nuevos.contrasena = 'Ingresa tu contraseña.'
    setErrores(nuevos)
    if (Object.keys(nuevos).length > 0) return

    setEnviando(true)
    setErrorGeneral(null)
    try {
      await iniciarSesion(campos.correo, campos.contrasena)
      // El proveedor de sesión publica la cuenta y esta vista redirige por rol.
    } catch (fallo: unknown) {
      setEnviando(false)
      setErrorGeneral(
        esFalloDeRed(fallo)
          ? 'No pudimos conectar con el servicio de acceso. Revisa tu conexión e inténtalo de nuevo.'
          : mensajeDeAcceso(fallo) || mensajeDeError(fallo),
      )
    }
  }

  return (
    <Stack gap="8" maxW="lg" mx="auto" w="full">
      <Stack gap="2" textAlign="center">
        <Text textStyle="label-caps" color="secondary">ACCESO A TU CUENTA</Text>
        <Heading as="h1" textStyle={{ base: 'headline-lg-mobile', md: 'headline-lg' }} color="primary">
          Bienvenido de nuevo
        </Heading>
        <Text color="fg.muted">
          Ingresa con el correo y la contraseña de tu cuenta para consultar tus solicitudes y tus conversaciones.
        </Text>
      </Stack>

      <Card.Root>
        <Card.Body gap="6">
          {errorGeneral && (
            <Alert.Root status="error" role="alert">
              <Alert.Indicator>
                <AlertCircle aria-hidden size={18} />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>No se pudo iniciar sesión</Alert.Title>
                <Alert.Description>{errorGeneral}</Alert.Description>
              </Alert.Content>
            </Alert.Root>
          )}

          <form onSubmit={enviar} noValidate>
            <Stack gap="5">
              <Field.Root invalid={Boolean(errores.correo)}>
                <Field.Label>Correo electrónico</Field.Label>
                <Input
                  type="email"
                  autoComplete="email"
                  value={campos.correo}
                  disabled={enviando}
                  onChange={(evento) => actualizar('correo', evento.target.value)}
                  placeholder="nombre@correo.com"
                />
                {errores.correo && <Field.ErrorText>{errores.correo}</Field.ErrorText>}
              </Field.Root>

              <Field.Root invalid={Boolean(errores.contrasena)}>
                <Flex justify="space-between" align="center" gap="3">
                  <Field.Label mb="0">Contraseña</Field.Label>
                  <ChakraLink asChild textStyle="label-sm" color="primary">
                    <Link to="/recuperar-password">¿Olvidaste tu contraseña?</Link>
                  </ChakraLink>
                </Flex>
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={campos.contrasena}
                  disabled={enviando}
                  onChange={(evento) => actualizar('contrasena', evento.target.value)}
                />
                {errores.contrasena && <Field.ErrorText>{errores.contrasena}</Field.ErrorText>}
              </Field.Root>

              <Button type="submit" width="full" loading={enviando} loadingText="Verificando tus datos">
                <LogIn aria-hidden size={18} />
                Iniciar sesión
              </Button>
            </Stack>
          </form>

          <Stack gap="2" borderTopWidth="1px" pt="5">
            <Text textStyle="body-sm" color="fg.muted">
              ¿Todavía no tienes cuenta? Puedes crear una como ciudadano o solicitar una cuenta profesional.
            </Text>
            <Flex gap="3" wrap="wrap">
              <Button asChild size="sm" variant="outline">
                <Link to="/registro/ciudadano">
                  <UserRoundPlus aria-hidden size={16} />
                  Registro de ciudadano
                </Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link to="/registro/abogado">
                  <BadgeCheck aria-hidden size={16} />
                  Registro de abogado
                </Link>
              </Button>
            </Flex>
          </Stack>
        </Card.Body>
      </Card.Root>

      <Box as="section" aria-labelledby="acceso-alcance">
        <Card.Root bg="bg.subtle">
          <Card.Body gap="4">
            <Flex align="center" gap="2">
              <Info aria-hidden size={18} />
              <Heading as="h2" id="acceso-alcance" textStyle="title-sm">
                Qué puedes hacer con y sin cuenta
              </Heading>
            </Flex>
            <List.Root gap="2" textStyle="body-sm" color="fg.muted">
              <List.Item>
                <Flex gap="2" align="start">
                  <Box color="primary" mt="0.5"><Search aria-hidden size={16} /></Box>
                  <Text as="span">
                    La búsqueda en el directorio es pública y no exige registro.
                  </Text>
                </Flex>
              </List.Item>
              <List.Item>
                <Flex gap="2" align="start">
                  <Box color="primary" mt="0.5"><UserRoundPlus aria-hidden size={16} /></Box>
                  <Text as="span">
                    Con una cuenta de ciudadano puedes enviar solicitudes de contacto y conversar por texto con el abogado
                    que las acepte.
                  </Text>
                </Flex>
              </List.Item>
              <List.Item>
                <Flex gap="2" align="start">
                  <Box color="primary" mt="0.5"><ShieldCheck aria-hidden size={16} /></Box>
                  <Text as="span">
                    La cuenta profesional permite recibir solicitudes; su inscripción queda pendiente de la revisión
                    administrativa antes de aparecer en el directorio.
                  </Text>
                </Flex>
              </List.Item>
            </List.Root>
          </Card.Body>
        </Card.Root>
      </Box>
    </Stack>
  )
}
