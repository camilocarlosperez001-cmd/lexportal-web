// CU 11 — Lista de conversaciones habilitadas por una solicitud aceptada.
// Solo se muestran las conversaciones donde el usuario participa; el acceso
// administrativo a la lectura no convierte el chat en una función ordinaria.

import { Box, Button, Card, Flex, Heading, Link as ChakraLink, Stack, Text } from '@chakra-ui/react'
import { MessageSquare, UserRound } from 'lucide-react'
import { Link as RouterLink } from 'react-router-dom'
import { EstadoSolicitudBadge } from '../../../components/shared/EstadoBadge'
import { FeedbackState } from '../../../components/shared/FeedbackState'
import { PageHeader } from '../../../components/shared/PageHeader'
import { useConsulta } from '../../../hooks/useConsulta'
import { formatearFechaHora } from '../../../utils/fechas'
import { useSesion } from '../../auth/hooks/useSesion'
import { listarConversaciones, recortarUltimoMensaje } from '../services/conversaciones'

export function ConversacionesPage() {
  const { estado, cuenta } = useSesion()
  const usuarioId = cuenta?.id ?? null

  const consulta = useConsulta(
    () => (usuarioId ? listarConversaciones(usuarioId) : Promise.resolve([])),
    `conversaciones:${usuarioId ?? 'sin-cuenta'}`,
  )

  const conversaciones = consulta.datos ?? []
  const esAbogado = cuenta?.rol === 'abogado'

  return (
    <Stack gap="6">
      <PageHeader
        titulo="Mensajes"
        etiqueta="Mensajería interna"
        descripcion="Conversaciones de texto con la otra parte de una solicitud aceptada. El intercambio no implica contratación ni garantiza resultados."
      />

      {estado === 'error' && (
        <FeedbackState
          kind="error"
          title="No pudimos comprobar tu sesión"
          description="Vuelve a intentarlo en unos segundos para consultar tus conversaciones."
        />
      )}

      {estado !== 'error' && consulta.cargando && (
        <FeedbackState kind="loading" title="Cargando tus conversaciones" />
      )}

      {estado !== 'error' && !consulta.cargando && consulta.error && (
        <FeedbackState
          kind="error"
          title="No se pudieron cargar tus conversaciones"
          description={consulta.error}
          action={
            <Button variant="outline" onClick={consulta.recargar}>
              Reintentar
            </Button>
          }
        />
      )}

      {estado !== 'error' && !consulta.cargando && !consulta.error && conversaciones.length === 0 && (
        <FeedbackState
          title="Aún no tienes conversaciones"
          description="El chat se habilita cuando el abogado acepta una solicitud de contacto. Mientras la solicitud esté pendiente, rechazada o cancelada no existe conversación."
          action={
            esAbogado ? (
              <Button asChild>
                <RouterLink to="/solicitudes-recibidas">
                  <UserRound aria-hidden size={18} />
                  Revisar solicitudes recibidas
                </RouterLink>
              </Button>
            ) : (
              <Button asChild>
                <RouterLink to="/solicitudes">
                  <MessageSquare aria-hidden size={18} />
                  Ver mis solicitudes
                </RouterLink>
              </Button>
            )
          }
        />
      )}

      {estado !== 'error' && !consulta.cargando && !consulta.error && conversaciones.length > 0 && (
        <Stack gap="4">
          {conversaciones.map((conversacion) => {
            const nombreContraparte = esAbogado
              ? conversacion.nombre_ciudadano ?? 'Cuenta ciudadana'
              : conversacion.nombre_abogado ?? 'Perfil profesional no disponible'
            const fecha = formatearFechaHora(conversacion.ultimo_mensaje?.enviado_en ?? conversacion.habilitada_en)
            return (
              <Card.Root key={conversacion.id}>
                <Card.Body gap="3">
                  <Flex justify="space-between" align="start" gap="3" wrap="wrap">
                    <Stack gap="1">
                      <Heading as="h2" textStyle="title-md">
                        <ChakraLink asChild color="primary" _hover={{ textDecoration: 'underline' }}>
                          <RouterLink to={`/mensajes/${conversacion.id}`}>{nombreContraparte}</RouterLink>
                        </ChakraLink>
                      </Heading>
                      <Text textStyle="body-sm" color="fg.muted">
                        {conversacion.tipo_caso ?? 'Caso sin clasificar'}
                      </Text>
                    </Stack>
                    <Stack gap="2" align="end">
                      <EstadoSolicitudBadge estado={conversacion.estado_solicitud} />
                      {fecha && (
                        <Text textStyle="body-sm" color="fg.muted">
                          {fecha}
                        </Text>
                      )}
                    </Stack>
                  </Flex>

                  <Box bg="bg.subtle" borderRadius="md" px="4" py="3">
                    <Text color={conversacion.ultimo_mensaje ? 'fg' : 'fg.muted'} overflowWrap="anywhere">
                      {conversacion.ultimo_mensaje
                        ? recortarUltimoMensaje(conversacion.ultimo_mensaje.contenido)
                        : 'Todavía no hay mensajes en esta conversación.'}
                    </Text>
                  </Box>

                  <Flex justify="flex-end">
                    <Button asChild size="sm" variant="outline">
                      <RouterLink to={`/mensajes/${conversacion.id}`}>
                        <MessageSquare aria-hidden size={16} />
                        Abrir conversación
                      </RouterLink>
                    </Button>
                  </Flex>
                </Card.Body>
              </Card.Root>
            )
          })}
        </Stack>
      )}

      <Text textStyle="body-sm" color="fg.muted">
        Los mensajes se consultan únicamente dentro de la conversación; no se guardan en el navegador ni se incluyen
        en los avisos por correo.
      </Text>
    </Stack>
  )
}
