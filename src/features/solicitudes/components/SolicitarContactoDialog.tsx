import { useState } from 'react'
import {
  Button,
  Dialog,
  Field,
  Flex,
  NativeSelect,
  Stack,
  Text,
  Textarea,
} from '@chakra-ui/react'
import { Send } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { FeedbackState } from '../../../components/shared/FeedbackState'
import { toaster } from '../../../components/ui/toaster-store'
import { useConsulta } from '../../../hooks/useConsulta'
import { listarTiposCaso } from '../../catalogo/services/catalogo'
import { useSesion } from '../../auth/hooks/useSesion'
import { mensajeDeError } from '../../../utils/errores'
import { SIN_CLASIFICAR } from '../../../utils/contrato'
import { validarTextoRequerido } from '../../../utils/validaciones'
import { crearSolicitud } from '../services/solicitudes'

export type SolicitudDialogoProps = {
  perfilId: string
  nombreProfesional: string
  areasDelPerfil: string[]
  abierto: boolean
  alCerrar: (enviada: boolean) => void
  clasificacionInicial?: { tipoCasoId?: string | null }
}

/**
 * Envío de una solicitud de contacto (CU 09). Solo las cuentas de ciudadano pueden
 * enviarla: la comprobación de rol se repite en el servidor mediante la política de
 * inserción de solicitudes_contacto.
 */
export function SolicitarContactoDialog({
  perfilId,
  nombreProfesional,
  areasDelPerfil,
  abierto,
  alCerrar,
  clasificacionInicial,
}: SolicitudDialogoProps) {
  const { estado, cuenta, usuario } = useSesion()
  const navegar = useNavigate()
  const tipos = useConsulta(() => listarTiposCaso({ soloActivos: true }), 'tipos-caso-activos')

  const [tipoCasoId, setTipoCasoId] = useState<string>(clasificacionInicial?.tipoCasoId ?? SIN_CLASIFICAR)
  const [descripcion, setDescripcion] = useState('')
  const [ayuda, setAyuda] = useState('')
  const [errores, setErrores] = useState<{ descripcion?: string; ayuda?: string }>({})
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const sinSesion = estado === 'sin-sesion'
  const rolNoPermitido = estado === 'con-sesion' && cuenta !== null && cuenta.rol !== 'ciudadano'
  const puedeEnviar = Boolean(usuario) && cuenta?.rol === 'ciudadano'

  function irAIniciarSesion() {
    navegar(`/login?redirigir=${encodeURIComponent(`/directorio/${perfilId}`)}`)
  }

  async function enviar() {
    if (!usuario || !cuenta) return
    const errorDescripcion = validarTextoRequerido(descripcion, 'la descripción breve', 600)
    const errorAyuda = validarTextoRequerido(ayuda, 'la ayuda que buscas', 600)
    setErrores({ descripcion: errorDescripcion ?? undefined, ayuda: errorAyuda ?? undefined })
    if (errorDescripcion || errorAyuda) return

    setEnviando(true)
    setErrorEnvio(null)
    try {
      const clasificado = tipoCasoId !== SIN_CLASIFICAR
      const tipo = clasificado ? tipos.datos?.find((opcion) => opcion.id === tipoCasoId) ?? null : null
      await crearSolicitud({
        ciudadanoId: cuenta.id,
        perfilId,
        tipoCasoId: clasificado ? tipoCasoId : null,
        tipoCasoNombre: tipo?.nombre_cotidiano ?? null,
        areasDelPerfil,
        descripcionBreve: descripcion,
        ayudaBuscada: ayuda,
      })
      toaster.create({
        title: 'Solicitud enviada',
        description: 'Puedes seguir su estado desde «Mis solicitudes». El abogado decidirá si la acepta o la rechaza.',
        type: 'success',
      })
      setDescripcion('')
      setAyuda('')
      alCerrar(true)
    } catch (fallo: unknown) {
      setErrorEnvio(mensajeDeError(fallo, 'No se pudo enviar la solicitud. Inténtalo de nuevo.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog.Root
      open={abierto}
      onOpenChange={(detalles) => {
        if (!detalles.open) alCerrar(false)
      }}
      size="lg"
      role="dialog"
    >
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Solicitar contacto</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Stack gap="5">
              <Text color="fg.muted">
                La solicitud se dirige a <Text as="span" fontWeight="600" color="fg">{nombreProfesional}</Text>. Al
                aceptarla se habilita una conversación de texto; no implica contratación ni garantiza resultados.
              </Text>

              {sinSesion && (
                <FeedbackState
                  kind="empty"
                  title="Necesitas una cuenta de ciudadano"
                  description="Inicia sesión o crea una cuenta de ciudadano para enviar la solicitud. La búsqueda del directorio seguirá siendo pública."
                  action={<Button onClick={irAIniciarSesion}>Iniciar sesión o registrarme</Button>}
                />
              )}

              {rolNoPermitido && (
                <FeedbackState
                  kind="empty"
                  title="Tu rol no envía solicitudes de contacto"
                  description="Las solicitudes las envían las cuentas de ciudadano. Las cuentas profesionales las reciben y deciden sobre ellas."
                />
              )}

              {estado === 'error' && (
                <FeedbackState kind="error" title="No pudimos comprobar tu sesión" description="Vuelve a intentarlo en unos segundos." />
              )}

              {puedeEnviar && (
                <>
                  <Field.Root>
                    <Field.Label>Tipo de caso</Field.Label>
                    <NativeSelect.Root disabled={tipos.cargando}>
                      <NativeSelect.Field
                        value={tipoCasoId}
                        onChange={(evento) => setTipoCasoId(evento.target.value)}
                      >
                        <option value={SIN_CLASIFICAR}>No sé cómo clasificar mi caso</option>
                        {(tipos.datos ?? []).map((opcion) => (
                          <option key={opcion.id} value={opcion.id}>{opcion.nombre_cotidiano}</option>
                        ))}
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                    <Field.HelperText>
                      {tipos.error
                        ? 'No se pudo cargar el catálogo de tipos de caso. Puedes enviar la solicitud sin clasificar.'
                        : 'Elige la situación que más se parezca a tu caso, o déjalo sin clasificar.'}
                    </Field.HelperText>
                  </Field.Root>

                  <Field.Root invalid={Boolean(errores.descripcion)}>
                    <Field.Label>Descripción breve</Field.Label>
                    <Textarea
                      value={descripcion}
                      onChange={(evento) => setDescripcion(evento.target.value)}
                      maxLength={600}
                      rows={4}
                      placeholder="Resume tu situación sin incluir datos sensibles."
                    />
                    <Field.ErrorText>{errores.descripcion}</Field.ErrorText>
                  </Field.Root>

                  <Field.Root invalid={Boolean(errores.ayuda)}>
                    <Field.Label>Ayuda que buscas</Field.Label>
                    <Textarea
                      value={ayuda}
                      onChange={(evento) => setAyuda(evento.target.value)}
                      maxLength={600}
                      rows={3}
                      placeholder="¿Qué orientación o gestión necesitas?"
                    />
                    <Field.ErrorText>{errores.ayuda}</Field.ErrorText>
                  </Field.Root>

                  {errorEnvio && (
                    <Field.Root invalid>
                      <Field.ErrorText role="alert">{errorEnvio}</Field.ErrorText>
                    </Field.Root>
                  )}

                  <Text textStyle="body-sm" color="fg.muted">
                    El relato que escribas se conserva con la solicitud y solo lo consultan el abogado destinatario y tú.
                  </Text>
                </>
              )}
            </Stack>
          </Dialog.Body>
          <Dialog.Footer>
            <Flex gap="3" width="full" justify="flex-end">
              <Button variant="outline" onClick={() => alCerrar(false)}>Cerrar</Button>
              <Button onClick={() => void enviar()} loading={enviando} disabled={!puedeEnviar}>
                <Send aria-hidden size={16} />
                Enviar solicitud
              </Button>
            </Flex>
          </Dialog.Footer>
          <Dialog.CloseTrigger aria-label="Cerrar el formulario de solicitud" />
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}
