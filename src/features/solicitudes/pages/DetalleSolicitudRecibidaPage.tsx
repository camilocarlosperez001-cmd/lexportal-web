import { useState } from 'react'
import { Button, Card, Flex, Link as ChakraLink, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { ArrowLeft, CircleCheck, CircleX, Info, MessageSquare } from 'lucide-react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { EstadoSolicitudBadge } from '../../../components/shared/EstadoBadge'
import { FeedbackState } from '../../../components/shared/FeedbackState'
import { ListaDatos } from '../../../components/shared/ListaDatos'
import { PageHeader } from '../../../components/shared/PageHeader'
import { useConsulta } from '../../../hooks/useConsulta'
import { leerClasificacion } from '../../../utils/contrato'
import { formatearFechaHora } from '../../../utils/fechas'
import { ETIQUETA_ESTADO_SOLICITUD } from '../../../utils/etiquetas'
import { cargarConversacionDeSolicitud, cargarSolicitudRecibida } from '../services/solicitudes'
import { DialogoDecision, type DecisionPendiente } from '../components/DialogoDecision'
import { FormularioOrientacion } from '../components/FormularioOrientacion'
import { SeccionDetalle } from '../components/SeccionDetalle'
import { etiquetaTipoCaso } from '../utils'

/**
 * CU 10 y CU 20 (vista del abogado destinatario): decisión sobre una solicitud recibida y
 * registro de una orientación hacia otra clasificación.
 *
 * La transición se realiza con la RPC `cambiar_estado_solicitud`, que verifica al actor en
 * el servidor; el estado vigente se vuelve a comprobar antes de llamarla para no producir
 * dos estados finales.
 */
export function DetalleSolicitudRecibidaPage() {
  const { solicitudId } = useParams<{ solicitudId: string }>()
  const [decision, setDecision] = useState<DecisionPendiente | null>(null)

  const consulta = useConsulta(
    () => (solicitudId ? cargarSolicitudRecibida(solicitudId) : Promise.resolve(null)),
    `solicitud-recibida-${solicitudId ?? 'sin-id'}`,
  )
  const conversacion = useConsulta(
    () => (solicitudId ? cargarConversacionDeSolicitud(solicitudId) : Promise.resolve(null)),
    `conversacion-solicitud-${solicitudId ?? 'sin-id'}`,
  )

  const solicitud = consulta.datos

  if (consulta.cargando) {
    return <FeedbackState kind="loading" title="Cargando la solicitud recibida" />
  }

  if (consulta.error || !solicitud) {
    return (
      <Stack gap="6">
        <EncabezadoVolver />
        <FeedbackState
          kind="error"
          title="La solicitud no está disponible o no tienes acceso"
          description={
            consulta.error ??
            'Solo el abogado destinatario puede consultar esta solicitud. Comprueba el enlace o vuelve a tu bandeja.'
          }
          action={
            <Flex gap="2" wrap="wrap" justify="center">
              <Button variant="outline" onClick={consulta.recargar}>
                Reintentar
              </Button>
              <Button asChild variant="outline">
                <RouterLink to="/solicitudes-recibidas">Volver a las solicitudes recibidas</RouterLink>
              </Button>
            </Flex>
          }
        />
      </Stack>
    )
  }

  const clasificacion = leerClasificacion(solicitud.clasificacion_al_enviar)
  const tipoCaso = etiquetaTipoCaso(solicitud.tipos_caso?.nombre_cotidiano, clasificacion.tipoCaso)
  const pendiente = solicitud.estado === 'pendiente'
  const aceptada = solicitud.estado === 'aceptada'
  const conversacionId = solicitud.conversaciones?.id ?? conversacion.datos?.id ?? null

  return (
    <Stack gap="6">
      <EncabezadoVolver />

      <PageHeader
        etiqueta="Solicitud recibida"
        titulo={`Solicitud: ${tipoCaso}`}
        descripcion={`Recibida el ${formatearFechaHora(solicitud.enviada_en) ?? 'sin fecha registrada'}.`}
        acciones={<EstadoSolicitudBadge estado={solicitud.estado} />}
      />

      <SimpleGrid columns={{ base: 1, lg: 2 }} gap="5">
        <SeccionDetalle
          titulo="Relato del ciudadano"
          descripcion="Contenido aportado por la persona solicitante. Consérvalo únicamente para atender esta solicitud."
        >
          <ListaDatos
            orientacion="vertical"
            items={[
              { etiqueta: 'Descripción breve', valor: solicitud.descripcion_breve },
              { etiqueta: 'Ayuda buscada', valor: solicitud.ayuda_buscada },
            ]}
          />
        </SeccionDetalle>

        <SeccionDetalle
          titulo="Clasificación y estado vigente"
          descripcion="Instantánea registrada al enviar la solicitud y fechas de la decisión."
        >
          <ListaDatos
            orientacion="vertical"
            items={[
              { etiqueta: 'Tipo de caso declarado', valor: tipoCaso },
              {
                etiqueta: 'Áreas de la clasificación declarada',
                valor: clasificacion.areas.length > 0 ? clasificacion.areas.join(', ') : null,
              },
              { etiqueta: 'Recibida', valor: formatearFechaHora(solicitud.enviada_en) },
              { etiqueta: 'Decidida', valor: solicitud.decidida_en ? formatearFechaHora(solicitud.decidida_en) : null },
              { etiqueta: 'Estado', valor: ETIQUETA_ESTADO_SOLICITUD[solicitud.estado] },
              { etiqueta: 'Motivo del rechazo', valor: solicitud.motivo_rechazo },
            ]}
          />
        </SeccionDetalle>
      </SimpleGrid>

      <SeccionDetalle
        titulo="Tu decisión"
        descripcion="Solo el perfil destinatario puede aceptar o rechazar la solicitud, y únicamente mientras siga pendiente."
      >
        {pendiente ? (
          <Stack gap="4">
            <Text color="fg.muted">
              Aceptar habilita una conversación única de texto; rechazar la impide. Ninguna de las dos opciones crea un
              contrato ni agenda una cita.
            </Text>
            <Flex gap="3" wrap="wrap">
              <Button colorPalette="green" onClick={() => setDecision('aceptada')}>
                <CircleCheck aria-hidden size={16} />
                Aceptar
              </Button>
              <Button colorPalette="red" variant="outline" onClick={() => setDecision('rechazada')}>
                <CircleX aria-hidden size={16} />
                Rechazar
              </Button>
            </Flex>
          </Stack>
        ) : (
          <Stack gap="3">
            <Text color="fg.muted">
              La solicitud ya no está pendiente: su estado vigente es «{ETIQUETA_ESTADO_SOLICITUD[solicitud.estado]}», así
              que no se admite otra transición.
            </Text>
            {solicitud.estado === 'cancelada' && (
              <Text color="fg.muted">
                La cancelación la solicitó el ciudadano propietario mientras la solicitud seguía pendiente.
              </Text>
            )}
            {solicitud.estado === 'rechazada' && solicitud.motivo_rechazo && (
              <Text color="fg.muted">Motivo registrado: {solicitud.motivo_rechazo}</Text>
            )}
          </Stack>
        )}
      </SeccionDetalle>

      <SeccionDetalle
        titulo="Conversación de la solicitud"
        descripcion="La aceptación habilita una conversación única de texto y no implica contratación ni garantía de resultados."
      >
        {conversacion.cargando ? (
          <Text color="fg.muted">Comprobando si existe una conversación habilitada…</Text>
        ) : conversacionId ? (
          <Flex gap="3" wrap="wrap" align="center">
            <Button asChild>
              <RouterLink to={`/mensajes/${conversacionId}`}>
                <MessageSquare aria-hidden size={16} />
                Abrir la conversación
              </RouterLink>
            </Button>
            <Text color="fg.muted" textStyle="body-sm">
              El chat admite únicamente texto entre los participantes de la solicitud aceptada.
            </Text>
          </Flex>
        ) : (
          <Text color="fg.muted">
            {conversacion.error
              ? 'No se pudo comprobar si la solicitud tiene una conversación habilitada. Recarga el detalle en unos segundos.'
              : aceptada
                ? 'La solicitud está aceptada, pero la conversación todavía no se pudo confirmar. Recarga el detalle en unos segundos.'
                : 'Todavía no hay conversación: se habilita únicamente si aceptas la solicitud.'}
          </Text>
        )}
      </SeccionDetalle>

      <Card.Root as="section" borderWidth="1px" borderColor="border" bg="bg.panel">
        <Card.Header>
          <Stack gap="2">
            <Text textStyle="label-caps" color="secondary">
              CU 20
            </Text>
            <Text textStyle="title-md" color="primary">
              Orientación hacia otra clasificación jurídica
            </Text>
            <Card.Description>
              Recomienda un área o un tipo de caso del catálogo activo cuando el asunto no corresponda a tu práctica.
            </Card.Description>
          </Stack>
        </Card.Header>
        <Card.Body pt="0">
          <FormularioOrientacion
            solicitudId={solicitud.id}
            orientacion={solicitud.orientaciones}
            alGuardar={consulta.recargar}
          />
        </Card.Body>
      </Card.Root>

      <Flex gap="2" align="flex-start" color="fg.muted">
        <Info aria-hidden size={16} />
        <Text textStyle="body-sm">
          La orientación no transfiere la solicitud a otro abogado, no reemplaza la decisión sobre el estado y no envía
          el relato ni datos personales del ciudadano.
        </Text>
      </Flex>

      <DialogoDecision
        key={`${solicitud.id}-${decision ?? 'sin-decision'}`}
        solicitudId={solicitud.id}
        decision={decision}
        estadoVigente={solicitud.estado}
        alCerrar={() => setDecision(null)}
        alDecidir={consulta.recargar}
      />
    </Stack>
  )
}

function EncabezadoVolver() {
  return (
    <ChakraLink asChild alignSelf="flex-start" color="primary" textStyle="label-md">
      <RouterLink to="/solicitudes-recibidas">
        <ArrowLeft aria-hidden size={16} />
        Volver a las solicitudes recibidas
      </RouterLink>
    </ChakraLink>
  )
}
