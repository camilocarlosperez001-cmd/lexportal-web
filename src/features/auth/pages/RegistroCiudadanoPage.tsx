// CU 01: registro de ciudadano. Crea la cuenta con Supabase Auth, exige las
// aceptaciones vigentes y nunca afirma que existe sesión cuando el alta requiere
// confirmación por correo.

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
import { Link, Navigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, CheckCircle2, LogIn, MailCheck, UserRoundPlus } from 'lucide-react'
import { FeedbackState } from '../../../components/shared/FeedbackState'
import { RequisitosContrasena } from '../../../components/shared/RequisitosContrasena'
import { AceptacionesLegales } from '../../privacidad/components/AceptacionesLegales'
import { TIPOS_DOCUMENTO_REQUERIDOS } from '../../privacidad/services/legales'
import { useDocumentosLegales } from '../../privacidad/hooks/useDocumentosLegales'
import { esCorreoDuplicado, mensajeDeError } from '../../../utils/errores'
import { LIMITES_REGISTRO } from '../../../utils/validaciones'
import { registrarCuenta } from '../services/auth'
import { validarCredenciales, type CamposCredenciales, type ErrorCredenciales } from '../types'

const CAMPOS_VACIOS: CamposCredenciales = {
  nombreCompleto: '',
  correo: '',
  contrasena: '',
  confirmacion: '',
  telefono: '',
}

export function RegistroCiudadanoPage() {
  const { documentos, cargando: cargandoDocumentos, error: errorDocumentos } = useDocumentosLegales()

  const [campos, setCampos] = useState<CamposCredenciales>(CAMPOS_VACIOS)
  const [errores, setErrores] = useState<ErrorCredenciales>({})
  const [aceptados, setAceptados] = useState<string[]>([])
  const [errorAceptaciones, setErrorAceptaciones] = useState<string | null>(null)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [conSesionCreada, setConSesionCreada] = useState(false)
  const [correoPendiente, setCorreoPendiente] = useState<string | null>(null)

  function actualizar(campo: keyof CamposCredenciales, valor: string) {
    setCampos((actuales) => ({ ...actuales, [campo]: valor }))
    setErrores((actuales) => ({ ...actuales, [campo]: undefined }))
    setErrorGeneral(null)
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (enviando) return

    const nuevos = validarCredenciales(campos)
    setErrores(nuevos)

    const faltantes = documentos.filter(
      (documento) => TIPOS_DOCUMENTO_REQUERIDOS.includes(documento.tipo) && !aceptados.includes(documento.id),
    )
    setErrorAceptaciones(
      faltantes.length > 0 ? 'Debes aceptar todos los documentos vigentes para completar el registro.' : null,
    )

    if (Object.keys(nuevos).length > 0 || faltantes.length > 0) return

    setEnviando(true)
    setErrorGeneral(null)
    try {
      const resultado = await registrarCuenta({
        rol: 'ciudadano',
        nombreCompleto: campos.nombreCompleto,
        correo: campos.correo,
        contrasena: campos.contrasena,
        telefono: campos.telefono,
        documentoIds: aceptados,
      })
      if (resultado.requiereConfirmacion) {
        setCorreoPendiente(campos.correo.trim().toLowerCase())
      } else {
        setConSesionCreada(true)
      }
    } catch (fallo: unknown) {
      setErrorGeneral(
        esCorreoDuplicado(fallo)
          ? 'Ya existe una cuenta registrada con este correo. Inicia sesión o recupera tu contraseña.'
          : mensajeDeError(fallo, 'No pudimos completar tu registro. Inténtalo de nuevo.'),
      )
    } finally {
      setEnviando(false)
    }
  }

  if (conSesionCreada) return <Navigate to="/solicitudes" replace />

  if (correoPendiente) {
    return (
      <Stack gap="8" maxW="2xl" mx="auto">
        <Card.Root>
          <Card.Body gap="5" textAlign="center" alignItems="center">
            <Box color="primary" bg="bg.subtle" p="3" borderRadius="full">
              <MailCheck aria-hidden size={28} />
            </Box>
            <Heading as="h1" textStyle="headline-md" color="primary">
              Revisa tu correo para confirmar la cuenta
            </Heading>
            <Text color="fg.muted" maxW="xl">
              Enviamos un enlace de confirmación a <Text as="span" fontWeight="600">{correoPendiente}</Text>. La cuenta
              queda activa cuando abras ese enlace; hasta entonces no es posible iniciar sesión.
            </Text>
            <List.Root gap="2" textStyle="body-sm" color="fg.muted" textAlign="left" maxW="md">
              <List.Item>Revisa también la carpeta de correo no deseado.</List.Item>
              <List.Item>El enlace es de un solo uso y caduca pasado un tiempo.</List.Item>
              <List.Item>
                Tus aceptaciones quedan registradas con la fecha y la versión del documento aceptado.
              </List.Item>
            </List.Root>
            <Flex gap="3" wrap="wrap" justifyContent="center">
              <Button asChild>
                <Link to="/login">
                  <LogIn aria-hidden size={18} />
                  Ir a iniciar sesión
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/directorio">Buscar abogados sin registrarme</Link>
              </Button>
            </Flex>
          </Card.Body>
        </Card.Root>
      </Stack>
    )
  }

  return (
    <Stack gap="8" maxW="2xl" mx="auto">
      <Stack gap="2">
        <Text textStyle="label-caps" color="secondary">CUENTA DE CIUDADANO</Text>
        <Heading as="h1" textStyle={{ base: 'headline-lg-mobile', md: 'headline-lg' }} color="primary">
          Crea tu cuenta
        </Heading>
        <Text color="fg.muted">
          Con una cuenta de ciudadano puedes enviar solicitudes de contacto a los abogados del directorio y conversar por
          texto cuando acepten tu solicitud. La búsqueda del directorio continúa disponible sin registro.
        </Text>
      </Stack>

      {errorGeneral && (
        <Alert.Root status="error" role="alert">
          <Alert.Indicator>
            <AlertCircle aria-hidden size={18} />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>No se pudo completar el registro</Alert.Title>
            <Alert.Description>{errorGeneral}</Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}

      <Card.Root>
        <Card.Body>
          <form onSubmit={enviar} noValidate>
            <Stack gap="5">
              <Field.Root invalid={Boolean(errores.nombreCompleto)}>
                <Field.Label>Nombre completo</Field.Label>
                <Input
                  value={campos.nombreCompleto}
                  disabled={enviando}
                  autoComplete="name"
                  maxLength={LIMITES_REGISTRO.nombre}
                  onChange={(evento) => actualizar('nombreCompleto', evento.target.value)}
                  placeholder="Nombre y apellidos"
                />
                {errores.nombreCompleto ? (
                  <Field.ErrorText>{errores.nombreCompleto}</Field.ErrorText>
                ) : (
                  <Field.HelperText>Escribe nombre y apellido, hasta 200 caracteres.</Field.HelperText>
                )}
              </Field.Root>

              <Field.Root invalid={Boolean(errores.correo)}>
                <Field.Label>Correo electrónico</Field.Label>
                <Input
                  type="email"
                  value={campos.correo}
                  disabled={enviando}
                  autoComplete="email"
                  maxLength={LIMITES_REGISTRO.correo}
                  onChange={(evento) => actualizar('correo', evento.target.value)}
                  placeholder="nombre@correo.com"
                />
                {errores.correo ? (
                  <Field.ErrorText>{errores.correo}</Field.ErrorText>
                ) : (
                  <Field.HelperText>Recibirás aquí el enlace de confirmación de la cuenta.</Field.HelperText>
                )}
              </Field.Root>

              <Field.Root invalid={Boolean(errores.contrasena)}>
                <Field.Label>Contraseña</Field.Label>
                <Input
                  type="password"
                  value={campos.contrasena}
                  disabled={enviando}
                  autoComplete="new-password"
                  onChange={(evento) => actualizar('contrasena', evento.target.value)}
                />
                {errores.contrasena && <Field.ErrorText>{errores.contrasena}</Field.ErrorText>}
                <RequisitosContrasena valor={campos.contrasena} />
              </Field.Root>

              <Field.Root invalid={Boolean(errores.confirmacion)}>
                <Field.Label>Confirmar contraseña</Field.Label>
                <Input
                  type="password"
                  value={campos.confirmacion}
                  disabled={enviando}
                  autoComplete="new-password"
                  onChange={(evento) => actualizar('confirmacion', evento.target.value)}
                />
                {errores.confirmacion && <Field.ErrorText>{errores.confirmacion}</Field.ErrorText>}
              </Field.Root>

              <Field.Root invalid={Boolean(errores.telefono)}>
                <Field.Label>Teléfono (opcional)</Field.Label>
                <Input
                  type="tel"
                  value={campos.telefono}
                  disabled={enviando}
                  autoComplete="tel"
                  maxLength={LIMITES_REGISTRO.telefonoFormatoMax}
                  onChange={(evento) => actualizar('telefono', evento.target.value)}
                  placeholder="+57 300 000 0000"
                />
                {errores.telefono ? (
                  <Field.ErrorText>{errores.telefono}</Field.ErrorText>
                ) : (
                  <Field.HelperText>Entre 7 y 15 dígitos; puedes dejarlo vacío.</Field.HelperText>
                )}
              </Field.Root>

              <Stack gap="3" borderTopWidth="1px" pt="5">
                <Heading as="h2" textStyle="title-sm">Términos y autorizaciones</Heading>
                {cargandoDocumentos ? (
                  <FeedbackState kind="loading" title="Cargando los documentos vigentes" />
                ) : errorDocumentos ? (
                  <FeedbackState
                    kind="error"
                    title="No pudimos cargar los documentos legales"
                    description={errorDocumentos}
                  />
                ) : (
                  <AceptacionesLegales
                    documentos={documentos}
                    seleccionados={aceptados}
                    alCambiar={(ids) => {
                      setAceptados(ids)
                      setErrorAceptaciones(null)
                    }}
                    error={errorAceptaciones ?? undefined}
                    deshabilitado={enviando}
                  />
                )}
              </Stack>

              <Button type="submit" width="full" loading={enviando} loadingText="Creando tu cuenta">
                <UserRoundPlus aria-hidden size={18} />
                Registrarme
              </Button>
            </Stack>
          </form>
        </Card.Body>
        <Card.Footer justifyContent="center" borderTopWidth="1px" pt="4">
          <Text textStyle="body-sm" color="fg.muted">
            ¿Ya tienes una cuenta?{' '}
            <ChakraLink asChild color="primary" fontWeight="600">
              <Link to="/login">
                <CheckCircle2 aria-hidden size={14} style={{ display: 'inline', marginRight: 4 }} />
                Inicia sesión
              </Link>
            </ChakraLink>
          </Text>
        </Card.Footer>
      </Card.Root>

      <Flex justify="start">
        <Button asChild variant="ghost" size="sm">
          <Link to="/registro">
            <ArrowLeft aria-hidden size={16} />
            Volver a la elección de cuenta
          </Link>
        </Button>
      </Flex>
    </Stack>
  )
}
