import { useState } from 'react'
import { Button, Dialog, Field, Flex, Stack, Text, Textarea } from '@chakra-ui/react'
import { CircleCheck, CircleX } from 'lucide-react'
import { FeedbackState } from '../../../components/shared/FeedbackState'
import { toaster } from '../../../components/ui/toaster-store'
import { decidirSolicitud } from '../services/solicitudes'
import { ETIQUETA_ESTADO_SOLICITUD, type EstadoSolicitud } from '../../../utils/etiquetas'
import { esErrorDePermiso, mensajeDeError } from '../../../utils/errores'

export type DecisionPendiente = 'aceptada' | 'rechazada'

export type DialogoDecisionProps = {
  solicitudId: string
  decision: DecisionPendiente | null
  /** Estado vigente según los datos cargados por la página; se comprueba antes de llamar a la RPC. */
  estadoVigente: EstadoSolicitud
  alCerrar: () => void
  /** Se invoca tras intentar la decisión para recargar el estado vigente. */
  alDecidir: () => void
}

type EstadoDialogo = { motivo: string; enviando: boolean; error: string | null; errorDePermiso: boolean }

const ESTADO_INICIAL: EstadoDialogo = { motivo: '', enviando: false, error: null, errorDePermiso: false }

/**
 * Decisión del abogado destinatario sobre una solicitud pendiente (CU 10).
 * Antes de llamar a la RPC se vuelve a comprobar el estado vigente recibido por props:
 * si ya no es «pendiente» no se permite otra transición y se informa el estado actual,
 * porque la función del servidor no verifica por sí sola el estado previo.
 *
 * La página monta el diálogo con una `key` por solicitud y decisión, de modo que el motivo
 * y los errores se reinician al cambiar de acción sin recurrir a un efecto de sincronización.
 */
export function DialogoDecision({ solicitudId, decision, estadoVigente, alCerrar, alDecidir }: DialogoDecisionProps) {
  const [estado, setEstado] = useState<EstadoDialogo>(ESTADO_INICIAL)

  const bloqueado = estado.enviando
  const esRechazo = decision === 'rechazada'
  const titulo = esRechazo ? 'Rechazar la solicitud' : 'Aceptar la solicitud'

  async function confirmar() {
    if (!decision || bloqueado) return

    if (estadoVigente !== 'pendiente') {
      setEstado({
        motivo: estado.motivo,
        enviando: false,
        errorDePermiso: false,
        error: `La solicitud ya no está pendiente: su estado vigente es «${ETIQUETA_ESTADO_SOLICITUD[estadoVigente]}». No se registró ninguna decisión nueva.`,
      })
      return
    }

    setEstado((previo) => ({ ...previo, enviando: true, error: null, errorDePermiso: false }))
    try {
      await decidirSolicitud(solicitudId, decision, esRechazo ? estado.motivo : undefined)
      toaster.create({
        title: esRechazo ? 'Solicitud rechazada' : 'Solicitud aceptada',
        description: esRechazo
          ? 'El ciudadano puede consultar el estado y el motivo registrado. Aún puedes añadir una orientación hacia otra clasificación.'
          : 'Se habilitó una conversación única de texto con el ciudadano. La aceptación no implica contratación ni garantiza resultados.',
        type: 'success',
      })
      alDecidir()
      alCerrar()
    } catch (fallo: unknown) {
      const sinPermiso = esErrorDePermiso(fallo)
      setEstado({
        motivo: estado.motivo,
        enviando: false,
        errorDePermiso: sinPermiso,
        error: sinPermiso
          ? 'La solicitud no está dirigida a este perfil: solo el abogado destinatario puede aceptarla o rechazarla.'
          : mensajeDeError(fallo, 'No se pudo registrar la decisión. Verifica el estado de la solicitud e inténtalo de nuevo.'),
      })
      alDecidir()
    }
  }

  return (
    <Dialog.Root
      open={decision !== null}
      onOpenChange={(detalles) => {
        if (!detalles.open && !bloqueado) alCerrar()
      }}
      role="dialog"
      size="md"
    >
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>{titulo}</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Stack gap="4">
              <Text color="fg.muted">
                {esRechazo
                  ? 'El rechazo no habilita la conversación. Puedes registrar un motivo general, sin incluir datos sensibles ni copiar el relato del ciudadano.'
                  : 'La aceptación habilita una conversación única de texto entre tú y el ciudadano. No crea un contrato ni agenda una cita.'}
              </Text>

              {estadoVigente !== 'pendiente' && (
                <FeedbackState
                  kind="empty"
                  title="La solicitud ya no está pendiente"
                  description={`El estado vigente es «${ETIQUETA_ESTADO_SOLICITUD[estadoVigente]}», así que no se admite otra transición. Cierra este diálogo para consultar la decisión registrada.`}
                />
              )}

              {esRechazo && (
                <Field.Root>
                  <Field.Label>Motivo general del rechazo (opcional)</Field.Label>
                  <Textarea
                    value={estado.motivo}
                    onChange={(evento) => setEstado((previo) => ({ ...previo, motivo: evento.target.value }))}
                    rows={3}
                    maxLength={600}
                    disabled={bloqueado}
                    placeholder="Por ejemplo: el asunto corresponde a otra área de práctica."
                  />
                  <Field.HelperText>
                    El motivo queda registrado junto con la decisión y el ciudadano puede consultarlo.
                  </Field.HelperText>
                </Field.Root>
              )}

              {estado.error && (
                <FeedbackState
                  kind="error"
                  title={estado.errorDePermiso ? 'La solicitud no está dirigida a este perfil' : 'No se registró la decisión'}
                  description={estado.error}
                  action={
                    <Button variant="outline" onClick={alCerrar}>
                      Cerrar
                    </Button>
                  }
                />
              )}
            </Stack>
          </Dialog.Body>
          <Dialog.Footer>
            <Flex gap="3" width="full" justify="flex-end" wrap="wrap">
              <Button variant="outline" onClick={alCerrar} disabled={bloqueado}>
                Volver
              </Button>
              {esRechazo ? (
                <Button colorPalette="red" onClick={() => void confirmar()} loading={estado.enviando}>
                  <CircleX aria-hidden size={16} />
                  Rechazar solicitud
                </Button>
              ) : (
                <Button colorPalette="green" onClick={() => void confirmar()} loading={estado.enviando}>
                  <CircleCheck aria-hidden size={16} />
                  Aceptar solicitud
                </Button>
              )}
            </Flex>
          </Dialog.Footer>
          <Dialog.CloseTrigger aria-label="Cerrar el diálogo de decisión" disabled={bloqueado} />
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}
