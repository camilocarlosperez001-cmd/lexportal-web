import { useState } from 'react'
import {
  Button,
  Card,
  Field,
  Flex,
  Input,
  Link as ChakraLink,
  Stack,
  Text,
} from '@chakra-ui/react'
import { KeyRound, LogOut, Save, ShieldCheck, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { FeedbackState } from '../../../components/shared/FeedbackState'
import { PageHeader } from '../../../components/shared/PageHeader'
import { RequisitosContrasena } from '../../../components/shared/RequisitosContrasena'
import { EstadoCuentaBadge } from '../../../components/shared/EstadoBadge'
import { ListaDatos } from '../../../components/shared/ListaDatos'
import { toaster } from '../../../components/ui/toaster-store'
import { ETIQUETA_ROL } from '../../../utils/etiquetas'
import { formatearFecha } from '../../../utils/fechas'
import { mensajeDeError } from '../../../utils/errores'
import {
  LIMITES_REGISTRO,
  validarConfirmacion,
  validarContrasena,
  validarNombreCompleto,
  validarTelefono,
} from '../../../utils/validaciones'
import { actualizarContrasena, iniciarSesion } from '../../auth/services/auth'
import { useSesion } from '../../auth/hooks/useSesion'
import { actualizarDatosCuenta, type Cuenta } from '../services/cuenta'

/**
 * CU 12 y CU 04: datos ordinarios de la cuenta, cambio de contraseña de la sesión actual
 * y cierre de sesión. El correo es de sólo lectura: su cambio no está habilitado en esta
 * vista, de modo que la identidad de acceso no se altera desde aquí.
 */
export function CuentaPage() {
  const { estado, cuenta, error: errorSesion, recargar, cerrarSesion } = useSesion()

  if (estado === 'cargando') {
    return <FeedbackState kind="loading" title="Cargando los datos de tu cuenta" />
  }

  if (estado === 'error' || !cuenta) {
    return (
      <FeedbackState
        kind="error"
        title="No pudimos leer tu cuenta"
        description={errorSesion ?? 'Vuelve a intentarlo en unos segundos.'}
        action={<Button onClick={() => void recargar()}>Reintentar</Button>}
      />
    )
  }

  // El formulario se remonta con `key` cuando cambian los datos guardados: así el estado
  // editable se inicializa desde el contrato en el render, sin sincronizarlo en un efecto.
  return (
    <CuentaContenido
      key={`cuenta-${cuenta.id}-${cuenta.nombre_completo}-${cuenta.telefono ?? ''}`}
      cuenta={cuenta}
      recargar={recargar}
      cerrarSesion={cerrarSesion}
    />
  )
}

function CuentaContenido({
  cuenta,
  recargar,
  cerrarSesion,
}: {
  cuenta: Cuenta
  recargar: () => Promise<void>
  cerrarSesion: () => Promise<void>
}) {
  const [nombre, setNombre] = useState(cuenta.nombre_completo)
  const [telefono, setTelefono] = useState(cuenta.telefono ?? '')
  const [erroresDatos, setErroresDatos] = useState<{ nombre?: string; telefono?: string }>({})
  const [errorDatos, setErrorDatos] = useState<string | null>(null)
  const [guardandoDatos, setGuardandoDatos] = useState(false)

  const [contrasenaActual, setContrasenaActual] = useState('')
  const [nuevaContrasena, setNuevaContrasena] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [erroresContrasena, setErroresContrasena] = useState<{
    actual?: string
    nueva?: string
    confirmacion?: string
  }>({})
  const [errorContrasena, setErrorContrasena] = useState<string | null>(null)
  const [guardandoContrasena, setGuardandoContrasena] = useState(false)
  const [errorCierre, setErrorCierre] = useState<string | null>(null)

  const esAbogado = cuenta.rol === 'abogado'

  async function guardarDatos() {
    const problemaNombre = validarNombreCompleto(nombre)
    const problemaTelefono = validarTelefono(telefono)
    setErroresDatos({
      nombre: problemaNombre ?? undefined,
      telefono: problemaTelefono ?? undefined,
    })
    if (problemaNombre || problemaTelefono) return

    setGuardandoDatos(true)
    setErrorDatos(null)
    try {
      await actualizarDatosCuenta(cuenta.id, { nombreCompleto: nombre, telefono })
      await recargar()
      toaster.create({
        title: 'Datos guardados',
        description: 'Tu nombre y tu teléfono quedaron actualizados.',
        type: 'success',
      })
    } catch (fallo: unknown) {
      setErrorDatos(mensajeDeError(fallo, 'No se pudieron guardar los datos de tu cuenta.'))
    } finally {
      setGuardandoDatos(false)
    }
  }

  async function cambiarContrasena() {
    const problemaActual = contrasenaActual ? null : 'Ingresa tu contraseña actual.'
    const problemaNueva = validarContrasena(nuevaContrasena)
    const problemaConfirmacion = validarConfirmacion(nuevaContrasena, confirmacion)
    setErroresContrasena({
      actual: problemaActual ?? undefined,
      nueva: problemaNueva ?? undefined,
      confirmacion: problemaConfirmacion ?? undefined,
    })
    if (problemaActual || problemaNueva || problemaConfirmacion) return

    setGuardandoContrasena(true)
    setErrorContrasena(null)
    try {
      // Comprobación de titularidad: si la contraseña actual no es válida, no se cambia nada.
      try {
        await iniciarSesion(cuenta.correo, contrasenaActual)
      } catch {
        setErroresContrasena({ actual: 'La contraseña actual no es correcta.' })
        return
      }
      await actualizarContrasena(nuevaContrasena)
      setContrasenaActual('')
      setNuevaContrasena('')
      setConfirmacion('')
      setErroresContrasena({})
      toaster.create({
        title: 'Contraseña actualizada',
        description: 'La nueva contraseña ya se aplica a tu sesión actual.',
        type: 'success',
      })
    } catch (fallo: unknown) {
      setErrorContrasena(mensajeDeError(fallo, 'No se pudo cambiar la contraseña.'))
    } finally {
      setGuardandoContrasena(false)
    }
  }

  async function salir() {
    setErrorCierre(null)
    try {
      await cerrarSesion()
    } catch (fallo: unknown) {
      setErrorCierre(mensajeDeError(fallo, 'No se pudo cerrar la sesión. Inténtalo de nuevo.'))
    }
  }

  return (
    <Stack gap="8">
      <PageHeader
        etiqueta="Mi cuenta"
        titulo="Seguridad y datos"
        descripcion="Consulta y actualiza los datos ordinarios de tu cuenta, cambia tu contraseña y cierra la sesión."
      />

      <Card.Root>
        <Card.Header>
          <Flex justify="space-between" align="center" gap="3" wrap="wrap">
            <Flex align="center" gap="2">
              <UserRound aria-hidden size={20} />
              <Card.Title>Datos de la cuenta</Card.Title>
            </Flex>
            <EstadoCuentaBadge estado={cuenta.estado} />
          </Flex>
        </Card.Header>
        <Card.Body gap="6">
          <ListaDatos
            items={[
              { etiqueta: 'Correo electrónico', valor: cuenta.correo },
              { etiqueta: 'Rol', valor: ETIQUETA_ROL[cuenta.rol] },
              { etiqueta: 'Fecha de alta', valor: formatearFecha(cuenta.creada_en) },
            ]}
          />

          <Text textStyle="body-sm" color="fg.muted">
            El correo electrónico identifica tu cuenta y no puede modificarse desde esta vista. Si necesitas
            cambiarlo, registra una petición de privacidad; la administración evalúa el procedimiento aplicable.
          </Text>

          <form
            noValidate
            onSubmit={(evento) => {
              evento.preventDefault()
              void guardarDatos()
            }}
          >
            <Stack gap="5">
              <Field.Root invalid={Boolean(erroresDatos.nombre)}>
                <Field.Label>Nombre completo</Field.Label>
                <Input
                  value={nombre}
                  onChange={(evento) => setNombre(evento.target.value)}
                  maxLength={LIMITES_REGISTRO.nombre}
                  autoComplete="name"
                />
                <Field.HelperText>Nombre y apellido, hasta {LIMITES_REGISTRO.nombre} caracteres.</Field.HelperText>
                <Field.ErrorText>{erroresDatos.nombre}</Field.ErrorText>
              </Field.Root>

              <Field.Root invalid={Boolean(erroresDatos.telefono)}>
                <Field.Label>Teléfono</Field.Label>
                <Input
                  value={telefono}
                  onChange={(evento) => setTelefono(evento.target.value)}
                  maxLength={LIMITES_REGISTRO.telefonoFormatoMax}
                  autoComplete="tel"
                  placeholder="Opcional"
                />
                <Field.HelperText>
                  Entre 7 y 15 dígitos. Se usa para avisos internos del servicio; no se publica en tu perfil.
                </Field.HelperText>
                <Field.ErrorText>{erroresDatos.telefono}</Field.ErrorText>
              </Field.Root>

              {errorDatos && (
                <Field.Root invalid>
                  <Field.ErrorText role="alert">{errorDatos}</Field.ErrorText>
                </Field.Root>
              )}

              <Flex justify="flex-start">
                <Button type="submit" loading={guardandoDatos}>
                  <Save aria-hidden size={16} />
                  Guardar cambios
                </Button>
              </Flex>
            </Stack>
          </form>
        </Card.Body>
      </Card.Root>

      <Card.Root>
        <Card.Header>
          <Flex align="center" gap="2">
            <KeyRound aria-hidden size={20} />
            <Card.Title>Cambio de contraseña</Card.Title>
          </Flex>
        </Card.Header>
        <Card.Body>
          <form
            noValidate
            onSubmit={(evento) => {
              evento.preventDefault()
              void cambiarContrasena()
            }}
          >
            <Stack gap="5">
              <Text color="fg.muted">
                La nueva contraseña se aplica de inmediato a la sesión actual. Si no recuerdas tu contraseña,
                cierra la sesión y solicita la recuperación desde el inicio de sesión.
              </Text>

              <Field.Root invalid={Boolean(erroresContrasena.actual)}>
                <Field.Label>Contraseña actual</Field.Label>
                <Input
                  type="password"
                  value={contrasenaActual}
                  onChange={(evento) => setContrasenaActual(evento.target.value)}
                  autoComplete="current-password"
                />
                <Field.ErrorText>{erroresContrasena.actual}</Field.ErrorText>
              </Field.Root>

              <Field.Root invalid={Boolean(erroresContrasena.nueva)}>
                <Field.Label>Nueva contraseña</Field.Label>
                <Input
                  type="password"
                  value={nuevaContrasena}
                  onChange={(evento) => setNuevaContrasena(evento.target.value)}
                  autoComplete="new-password"
                />
                {erroresContrasena.nueva && <Field.ErrorText>{erroresContrasena.nueva}</Field.ErrorText>}
                <RequisitosContrasena valor={nuevaContrasena} />
              </Field.Root>

              <Field.Root invalid={Boolean(erroresContrasena.confirmacion)}>
                <Field.Label>Confirmar nueva contraseña</Field.Label>
                <Input
                  type="password"
                  value={confirmacion}
                  onChange={(evento) => setConfirmacion(evento.target.value)}
                  autoComplete="new-password"
                />
                <Field.ErrorText>{erroresContrasena.confirmacion}</Field.ErrorText>
              </Field.Root>

              {errorContrasena && (
                <Field.Root invalid>
                  <Field.ErrorText role="alert">{errorContrasena}</Field.ErrorText>
                </Field.Root>
              )}

              <Flex justify="flex-start">
                <Button type="submit" loading={guardandoContrasena}>
                  <KeyRound aria-hidden size={16} />
                  Actualizar contraseña
                </Button>
              </Flex>
            </Stack>
          </form>
        </Card.Body>
      </Card.Root>

      <Card.Root>
        <Card.Header>
          <Flex align="center" gap="2">
            <ShieldCheck aria-hidden size={20} />
            <Card.Title>Privacidad y perfil</Card.Title>
          </Flex>
        </Card.Header>
        <Card.Body gap="4">
          <Text color="fg.muted">
            Consulta tus aceptaciones legales, las peticiones de privacidad que hayas registrado y, si eres
            abogado, los campos que autorizas publicar.
          </Text>
          <Stack gap="2" align="flex-start">
            <ChakraLink asChild color="primary" fontWeight="600">
              <Link to="/privacidad">Privacidad y datos personales</Link>
            </ChakraLink>
            {esAbogado && (
              <ChakraLink asChild color="primary" fontWeight="600">
                <Link to="/mi-perfil">Mi perfil profesional</Link>
              </ChakraLink>
            )}
          </Stack>
        </Card.Body>
      </Card.Root>

      <Card.Root>
        <Card.Header>
          <Flex align="center" gap="2">
            <LogOut aria-hidden size={20} />
            <Card.Title>Sesión</Card.Title>
          </Flex>
        </Card.Header>
        <Card.Body gap="4">
          <Text color="fg.muted">
            Al cerrar la sesión se solicitarán tus credenciales la próxima vez que accedas a las funciones que
            requieren cuenta.
          </Text>
          {errorCierre && (
            <Field.Root invalid>
              <Field.ErrorText role="alert">{errorCierre}</Field.ErrorText>
            </Field.Root>
          )}
          <Flex>
            <Button variant="outline" onClick={() => void salir()}>
              <LogOut aria-hidden size={16} />
              Cerrar sesión
            </Button>
          </Flex>
        </Card.Body>
      </Card.Root>
    </Stack>
  )
}
