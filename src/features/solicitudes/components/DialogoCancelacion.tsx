import { useState } from 'react'
import { Button, Dialog, Flex, Stack, Text } from '@chakra-ui/react'
import { Ban } from 'lucide-react'
import { FeedbackState } from '../../../components/shared/FeedbackState'
import { cancelarSolicitud } from '../services/solicitudes'
import { mensajeDeError } from '../../../utils/errores'

export type DialogoCancelacionProps = {
  solicitudId: string
  abierto: boolean
  alCerrar: () => void
  /** Se invoca tras cancelar correctamente para recargar los datos vigentes. */
  alCancelar: () => void
}

const ESTADO_INICIAL = { enviando: false, error: null as string | null }

/**
 * Cancelación de una solicitud por su propietario (CU 09). La actualización del servicio
 * exige que el estado siga siendo pendiente; si ya existe decisión, se explica el conflicto
 * en lugar de simular una cancelación correcta.
 *
 * La página lo monta solo mientras la confirmación está abierta, así que el estado interno
 * se reinicia en cada apertura sin necesidad de un efecto de sincronización.
 */
export function DialogoCancelacion({ solicitudId, abierto, alCerrar, alCancelar }: DialogoCancelacionProps) {
  const [estado, setEstado] = useState(ESTADO_INICIAL)

  const bloqueado = estado.enviando

  async function confirmar() {
    if (bloqueado) return
    setEstado({ enviando: true, error: null })
    try {
      await cancelarSolicitud(solicitudId)
      alCancelar()
      alCerrar()
    } catch (fallo: unknown) {
      setEstado({
        enviando: false,
        error: mensajeDeError(fallo, 'No se pudo cancelar la solicitud. Inténtalo de nuevo.'),
      })
    }
  }

  return (
    <Dialog.Root
      open={abierto}
      onOpenChange={(detalles) => {
        if (!detalles.open && !bloqueado) alCerrar()
      }}
      role="alertdialog"
      size="md"
    >
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Cancelar la solicitud</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Stack gap="4">
              <Text color="fg.muted">
                La cancelación solo es posible mientras la solicitud siga pendiente. Si el abogado ya la aceptó o la
                rechazó, no se modificará y se conservará la decisión registrada.
              </Text>
              {estado.error && (
                <FeedbackState
                  kind="error"
                  title="No se pudo cancelar la solicitud"
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
            <Flex gap="3" width="full" justify="flex-end">
              <Button variant="outline" onClick={alCerrar} disabled={bloqueado}>
                Conservar la solicitud
              </Button>
              <Button colorPalette="red" onClick={() => void confirmar()} loading={estado.enviando}>
                <Ban aria-hidden size={16} />
                Confirmar cancelación
              </Button>
            </Flex>
          </Dialog.Footer>
          <Dialog.CloseTrigger aria-label="Cerrar el diálogo de cancelación" disabled={bloqueado} />
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  )
}
