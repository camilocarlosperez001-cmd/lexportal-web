// CU 16: recuperación de acceso. La ruta /recuperar-password atiende la solicitud del
// enlace y, cuando el enlace válido abrió una sesión de recuperación, el establecimiento
// de la nueva contraseña.

import { useEffect, useState, type FormEvent } from 'react'
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
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, KeyRound, LogIn, MailCheck, Send } from 'lucide-react'
import { FeedbackState } from '../../../components/shared/FeedbackState'
import { RequisitosContrasena } from '../../../components/shared/RequisitosContrasena'
import { supabase } from '../../../lib/supabase'
import { mensajeDeError } from '../../../utils/errores'
import { LIMITES_REGISTRO, validarConfirmacion, validarContrasena, validarCorreo } from '../../../utils/validaciones'
import { useSesion } from '../hooks/useSesion'
import { useAuthEmailLink } from '../hooks/useAuthEmailLink'
import { actualizarContrasena, cerrarSesion, solicitarRecuperacion } from '../services/auth'
import { esFalloDeRed } from '../types'

type CamposNuevaContrasena = { contrasena: string; confirmacion: string }
type ErrorNuevaContrasena = Partial<Record<keyof CamposNuevaContrasena, string>>

type EstadoEnlace = 'comprobando' | 'valido' | 'invalido'

/** Parámetros que declara un enlace de recuperación de Supabase en el fragmento. */
function enlaceDeRecuperacion(): boolean {
  if (typeof window === 'undefined') return false
  const parametros = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  if (parametros.get('access_token') || parametros.get('error_description')) return true
  if (parametros.get('type') === 'recovery') return true
  const busqueda = new URLSearchParams(window.location.search)
  if (busqueda.get('code') || busqueda.get('error_description')) return true
  return busqueda.get('type') === 'recovery'
}

/** Motivo del enlace inválido declarado por el propio enlace de recuperación. */
function errorDelEnlace(): string | null {
  if (typeof window === 'undefined') return null
  const parametros = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const descripcion = parametros.get('error_description') ?? parametros.get('error')
  if (!descripcion) return null
  return 'El enlace no es válido, ha caducado o ya se utilizó.'
}

export function RecuperarPasswordPage() {
  const enlace = useAuthEmailLink('recovery')
  const { estado: estadoSesion, usuario } = useSesion()
  const navegar = useNavigate()

  const [motivoEnlace, setMotivoEnlace] = useState<string | null>(() => errorDelEnlace())
  const [recuperacionDetectada, setRecuperacionDetectada] = useState(false)

  const [correo, setCorreo] = useState('')
  const [errorCorreo, setErrorCorreo] = useState<string | null>(null)
  const [solicitudEnviada, setSolicitudEnviada] = useState(false)
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false)

  const [campos, setCampos] = useState<CamposNuevaContrasena>({ contrasena: '', confirmacion: '' })
  const [errores, setErrores] = useState<ErrorNuevaContrasena>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [restablecida, setRestablecida] = useState(false)

  // Supabase emite PASSWORD_RECOVERY cuando el enlace del correo es válido.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'PASSWORD_RECOVERY') {
        setRecuperacionDetectada(true)
        setMotivoEnlace(null)
      }
    })
    return () => {
      data.subscription.unsubscribe()
    }
  }, [])

  const haySesion = estadoSesion === 'con-sesion' && usuario !== null
  // Un error declarado por el enlace manda sobre todo lo demás. Si el enlace traía
  // parámetros de recuperación y no abrió sesión, se considera vencido o ya usado.
  let estadoEnlace: EstadoEnlace
  if (enlace.checking) {
    estadoEnlace = 'comprobando'
  } else if (enlace.error || motivoEnlace) {
    estadoEnlace = 'invalido'
  } else if (enlace.valid || haySesion || recuperacionDetectada) {
    estadoEnlace = 'valido'
  } else if (enlaceDeRecuperacion()) {
    estadoEnlace = estadoSesion === 'cargando' ? 'comprobando' : 'invalido'
  } else {
    // Visita directa a /recuperar-password: se ofrece el formulario de solicitud.
    estadoEnlace = 'invalido'
  }

  function limpiarFragmento() {
    if (typeof window === 'undefined') return
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }

  async function enviarSolicitud(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (enviandoSolicitud) return

    const problema = validarCorreo(correo)
    setErrorCorreo(problema)
    if (problema) return

    setEnviandoSolicitud(true)
    try {
      await solicitarRecuperacion(correo)
    } catch {
      // El mensaje de éxito es genérico a propósito: no revela si el correo existe.
    } finally {
      setEnviandoSolicitud(false)
      setSolicitudEnviada(true)
    }
  }

  async function enviarNuevaContrasena(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (guardando) return

    const nuevos: ErrorNuevaContrasena = {}
    const problemaContrasena = validarContrasena(campos.contrasena)
    if (problemaContrasena) nuevos.contrasena = problemaContrasena
    const problemaConfirmacion = validarConfirmacion(campos.contrasena, campos.confirmacion)
    if (problemaConfirmacion) nuevos.confirmacion = problemaConfirmacion
    setErrores(nuevos)
    if (Object.keys(nuevos).length > 0) return

    setGuardando(true)
    setErrorGeneral(null)
    try {
      await actualizarContrasena(campos.contrasena)
      setCampos({ contrasena: '', confirmacion: '' })
      limpiarFragmento()
      // El enlace queda invalidado: se cierra la sesión de recuperación para exigir
      // un inicio de sesión con la nueva contraseña.
      setRestablecida(true)
      try {
        await cerrarSesion()
      } catch {
        // La contraseña ya cambió; si el cierre falla, el usuario puede cerrar sesión después.
      }
    } catch (fallo: unknown) {
      setErrorGeneral(
        esFalloDeRed(fallo)
          ? 'No pudimos conectar con el servicio de acceso. Revisa tu conexión e inténtalo de nuevo.'
          : mensajeDeError(fallo, 'No pudimos establecer la nueva contraseña. Solicita un enlace nuevo.'),
      )
    } finally {
      setGuardando(false)
    }
  }

  if (restablecida) {
    return (
      <Stack gap="8" maxW="2xl" mx="auto">
        <Card.Root>
          <Card.Body gap="5" textAlign="center" alignItems="center">
            <Box color="primary" bg="bg.subtle" p="3" borderRadius="full">
              <KeyRound aria-hidden size={28} />
            </Box>
            <Heading as="h1" textStyle="headline-md" color="primary">Contraseña actualizada</Heading>
            <Text color="fg.muted" maxW="xl">
              Tu contraseña quedó establecida y el enlace utilizado dejó de ser válido. Cerramos la sesión de recuperación:
              inicia sesión con tu nueva contraseña.
            </Text>
            <Button
              onClick={() => void navegar('/login', { replace: true })}
            >
              <LogIn aria-hidden size={18} />
              Ir a iniciar sesión
            </Button>
          </Card.Body>
        </Card.Root>
      </Stack>
    )
  }

  if (estadoEnlace === 'comprobando') {
    return (
      <Stack gap="8" maxW="2xl" mx="auto">
        <FeedbackState
          kind="loading"
          title="Comprobando el enlace de recuperación"
          description="Verificamos si el enlace abrió una sesión válida para establecer una nueva contraseña."
        />
      </Stack>
    )
  }

  if (estadoEnlace === 'valido') {
    return (
      <Stack gap="8" maxW="2xl" mx="auto">
        <Stack gap="2" textAlign="center">
          <Text textStyle="label-caps" color="secondary">RECUPERACIÓN DE ACCESO</Text>
          <Heading as="h1" textStyle={{ base: 'headline-lg-mobile', md: 'headline-lg' }} color="primary">
            Define tu nueva contraseña
          </Heading>
          <Text color="fg.muted">
            El enlace fue válido. Al guardar, el enlace queda invalidado y deberás iniciar sesión con la nueva contraseña.
          </Text>
        </Stack>

        {errorGeneral && (
          <Alert.Root status="error" role="alert">
            <Alert.Indicator>
              <AlertCircle aria-hidden size={18} />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>No se pudo actualizar la contraseña</Alert.Title>
              <Alert.Description>{errorGeneral}</Alert.Description>
            </Alert.Content>
          </Alert.Root>
        )}

        <Card.Root>
          <Card.Body>
            <form onSubmit={enviarNuevaContrasena} noValidate>
              <Stack gap="5">
                <Field.Root invalid={Boolean(errores.contrasena)}>
                  <Field.Label>Nueva contraseña</Field.Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={campos.contrasena}
                    disabled={guardando}
                    onChange={(evento) => {
                      setCampos((actual) => ({ ...actual, contrasena: evento.target.value }))
                      setErrores((actual) => ({ ...actual, contrasena: undefined }))
                    }}
                  />
                  {errores.contrasena && <Field.ErrorText>{errores.contrasena}</Field.ErrorText>}
                  <RequisitosContrasena valor={campos.contrasena} />
                </Field.Root>

                <Field.Root invalid={Boolean(errores.confirmacion)}>
                  <Field.Label>Confirmar nueva contraseña</Field.Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={campos.confirmacion}
                    disabled={guardando}
                    onChange={(evento) => {
                      setCampos((actual) => ({ ...actual, confirmacion: evento.target.value }))
                      setErrores((actual) => ({ ...actual, confirmacion: undefined }))
                    }}
                  />
                  {errores.confirmacion && <Field.ErrorText>{errores.confirmacion}</Field.ErrorText>}
                </Field.Root>

                <Button type="submit" width="full" loading={guardando} loadingText="Guardando la contraseña">
                  <KeyRound aria-hidden size={18} />
                  Guardar nueva contraseña
                </Button>

                <Flex justify="center">
                  <ChakraLink asChild textStyle="body-sm" color="primary">
                    <Link to="/login">
                      <ArrowLeft aria-hidden size={14} style={{ display: 'inline', marginRight: 4 }} />
                      Volver a iniciar sesión
                    </Link>
                  </ChakraLink>
                </Flex>
              </Stack>
            </form>
          </Card.Body>
        </Card.Root>
      </Stack>
    )
  }

  // Enlace vencido o ya utilizado: se informa y se permite solicitar otro.
  if (solicitudEnviada) {
    return (
      <Stack gap="8" maxW="2xl" mx="auto">
        <Card.Root>
          <Card.Body gap="5" textAlign="center" alignItems="center">
            <Box color="primary" bg="bg.subtle" p="3" borderRadius="full">
              <MailCheck aria-hidden size={28} />
            </Box>
            <Heading as="h1" textStyle="headline-md" color="primary">Revisa tu correo</Heading>
            <Text color="fg.muted" maxW="xl">
              Si la dirección corresponde a una cuenta registrada, recibirás un enlace de un solo uso para restablecer la
              contraseña. Por seguridad no confirmamos si el correo existe en la plataforma.
            </Text>
            <Button asChild variant="outline">
              <Link to="/login">
                <ArrowLeft aria-hidden size={16} />
                Volver a iniciar sesión
              </Link>
            </Button>
          </Card.Body>
        </Card.Root>
      </Stack>
    )
  }

  return (
    <Stack gap="8" maxW="2xl" mx="auto">
      <Stack gap="2" textAlign="center">
        <Text textStyle="label-caps" color="secondary">RECUPERACIÓN DE ACCESO</Text>
        <Heading as="h1" textStyle={{ base: 'headline-lg-mobile', md: 'headline-lg' }} color="primary">
          Recupera tu acceso
        </Heading>
        <Text color="fg.muted">
          Indica el correo de tu cuenta y te enviaremos un enlace de un solo uso para establecer una nueva contraseña.
        </Text>
      </Stack>

      {estadoEnlace === 'invalido' && (
        <Alert.Root status="warning" role="alert">
          <Alert.Indicator>
            <AlertCircle aria-hidden size={18} />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>El enlace no es válido o ya se utilizó</Alert.Title>
            <Alert.Description>
              {enlace.error ?? (motivoEnlace
                ? `${motivoEnlace} Solicita uno nuevo con el formulario de abajo.`
                : 'Los enlaces de recuperación caducan y solo pueden usarse una vez. Solicita uno nuevo.')}
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}

      {errorGeneral && (
        <Alert.Root status="error" role="alert">
          <Alert.Indicator>
            <AlertCircle aria-hidden size={18} />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>No se pudo enviar la solicitud</Alert.Title>
            <Alert.Description>{errorGeneral}</Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}

      <Card.Root>
        <Card.Body>
          <form onSubmit={enviarSolicitud} noValidate>
            <Stack gap="5">
              <Field.Root invalid={Boolean(errorCorreo)}>
                <Field.Label>Correo electrónico registrado</Field.Label>
                <Input
                  type="email"
                  autoComplete="email"
                  value={correo}
                  disabled={enviandoSolicitud}
                  maxLength={LIMITES_REGISTRO.correo}
                  onChange={(evento) => {
                    setCorreo(evento.target.value)
                    setErrorCorreo(null)
                  }}
                  placeholder="nombre@correo.com"
                />
                {errorCorreo && <Field.ErrorText>{errorCorreo}</Field.ErrorText>}
              </Field.Root>

              <Button type="submit" width="full" loading={enviandoSolicitud} loadingText="Enviando la solicitud">
                <Send aria-hidden size={18} />
                Enviar enlace de recuperación
              </Button>

              <Flex justify="center">
                <ChakraLink asChild textStyle="body-sm" color="primary">
                  <Link to="/login">
                    <ArrowLeft aria-hidden size={14} style={{ display: 'inline', marginRight: 4 }} />
                    Volver a iniciar sesión
                  </Link>
                </ChakraLink>
              </Flex>
            </Stack>
          </form>
        </Card.Body>
      </Card.Root>

      <Card.Root bg="bg.subtle">
        <Card.Body gap="3">
          <Heading as="h2" textStyle="title-sm">Ten en cuenta</Heading>
          <List.Root gap="2" textStyle="body-sm" color="fg.muted">
            <List.Item>El enlace es de un solo uso y caduca pasado un tiempo.</List.Item>
            <List.Item>Si no llega, revisa la carpeta de correo no deseado antes de solicitar otro.</List.Item>
            <List.Item>
              Si tu cuenta aún no tiene el correo confirmado, primero abre el enlace de confirmación que enviamos al
              registrarte.
            </List.Item>
          </List.Root>
        </Card.Body>
      </Card.Root>
    </Stack>
  )
}
