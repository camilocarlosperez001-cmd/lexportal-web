// CU 11 — Conversación de una solicitud aceptada.
// La participación se comprueba con los datos consultados (no con la URL). Si el
// usuario no participa, se informa la falta de acceso sin revelar contenido alguno.

import { Button, Card, Flex, Link as ChakraLink, Stack, Text } from '@chakra-ui/react'
import { ArrowLeft, Info } from 'lucide-react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { EstadoSolicitudBadge } from '../../../components/shared/EstadoBadge'
import { FeedbackState } from '../../../components/shared/FeedbackState'
import { ListaDatos, type DatoPresentacion } from '../../../components/shared/ListaDatos'
import { PageHeader } from '../../../components/shared/PageHeader'
import { useConsulta } from '../../../hooks/useConsulta'
import { formatearFechaHora } from '../../../utils/fechas'
import { useSesion } from '../../auth/hooks/useSesion'
import { ChatConversacion } from '../components/ChatConversacion'
import { cargarContextoSolicitud, cargarConversacion } from '../services/conversaciones'

/** useConsulta entrega el mensaje normalizado; una denegación de RLS no se muestra como fallo genérico. */
function pareceErrorDeAcceso(mensaje: string): boolean {
  const texto = mensaje.toLowerCase()
  return texto.includes('row-level security') || texto.includes('no tiene permisos') || texto.includes('permission denied')
}

export function ConversacionPage() {
  const { conversacionId } = useParams<{ conversacionId: string }>()
  const { estado, cuenta } = useSesion()
  const usuarioId = cuenta?.id ?? null

  const consulta = useConsulta(
    async () => {
      if (!usuarioId || !conversacionId) return null
      const conversacion = await cargarConversacion(conversacionId, usuarioId)
      if (!conversacion) return null
      const contexto = await cargarContextoSolicitud(conversacionId, usuarioId)
      return { conversacion, contexto }
    },
    `conversacion:${conversacionId ?? 'sin-id'}:${usuarioId ?? 'sin-cuenta'}`,
  )

  const errorDeAcceso = consulta.error !== null && pareceErrorDeAcceso(consulta.error)
  const sinAcceso = !consulta.cargando && (consulta.datos === null || errorDeAcceso)

  if (estado === 'cargando' || consulta.cargando) {
    return <FeedbackState kind="loading" title="Cargando la conversación" />
  }

  if (estado === 'error') {
    return (
      <FeedbackState
        kind="error"
        title="No pudimos comprobar tu sesión"
        description="Vuelve a intentarlo en unos segundos para consultar la conversación."
      />
    )
  }

  if (estado === 'sin-sesion') {
    return (
      <FeedbackState
        kind="empty"
        title="Necesitas iniciar sesión"
        description="Las conversaciones solo se consultan con la sesión de una de las partes de la solicitud aceptada."
        action={
          <Button asChild>
            <RouterLink to="/login">Iniciar sesión</RouterLink>
          </Button>
        }
      />
    )
  }

  if (consulta.error && !sinAcceso) {
    return (
      <FeedbackState
        kind="error"
        title="No se pudo cargar la conversación"
        description={consulta.error}
        action={
          <Button variant="outline" onClick={consulta.recargar}>
            Reintentar
          </Button>
        }
      />
    )
  }

  if (sinAcceso || !consulta.datos || !usuarioId) {
    return (
      <FeedbackState
        kind="empty"
        title="No tienes acceso a esta conversación"
        description="Solo pueden consultar el chat las partes de una solicitud aceptada: el ciudadano que la envió y el abogado destinatario. Si crees que se trata de un error, revisa tus solicitudes."
        action={
          <Button asChild variant="outline">
            <RouterLink to="/mensajes">
              <ArrowLeft aria-hidden size={16} />
              Volver a mis conversaciones
            </RouterLink>
          </Button>
        }
      />
    )
  }

  const { conversacion, contexto } = consulta.datos
  const esAbogado = cuenta?.rol === 'abogado'
  const nombreContraparte = esAbogado
    ? conversacion.nombre_ciudadano ?? 'Cuenta ciudadana'
    : conversacion.nombre_abogado ?? 'Perfil profesional no disponible'

  const datos: DatoPresentacion[] = [
    { etiqueta: 'Tipo de caso', valor: conversacion.tipo_caso ?? 'Sin clasificar' },
    { etiqueta: 'Estado de la solicitud', valor: <EstadoSolicitudBadge estado={conversacion.estado_solicitud} /> },
    { etiqueta: 'Conversación habilitada', valor: formatearFechaHora(conversacion.habilitada_en) },
    { etiqueta: 'Solicitud enviada', valor: contexto ? formatearFechaHora(contexto.enviada_en) : null },
    { etiqueta: 'Ayuda buscada', valor: contexto?.ayuda_buscada ?? null },
    { etiqueta: 'Descripción breve', valor: contexto?.descripcion_breve ?? null },
  ]

  return (
    <Stack gap="6">
      <PageHeader
        titulo={nombreContraparte}
        etiqueta="Conversación"
        descripcion="Intercambio de texto entre las partes de una solicitud aceptada."
        acciones={
          <Button asChild variant="ghost">
            <RouterLink to="/mensajes">
              <ArrowLeft aria-hidden size={16} />
              Mis conversaciones
            </RouterLink>
          </Button>
        }
      />

      <Card.Root>
        <Card.Body gap="4">
          <ListaDatos items={datos} />
        </Card.Body>
      </Card.Root>

      <Flex gap="2" align="start" bg="bg.info" color="fg.info" borderRadius="md" p="4" role="note">
        <Info aria-hidden size={18} />
        <Text textStyle="body-sm">
          Este intercambio no implica contratación ni garantiza resultados jurídicos. Solo se admiten mensajes de
          texto: los archivos, las evidencias y las comunicaciones por otros medios quedan fuera de la mensajería
          interna.
        </Text>
      </Flex>

      <ChatConversacion conversacionId={conversacion.id} usuarioActualId={usuarioId} />

      <Text textStyle="body-sm" color="fg.muted">
        El contenido del chat solo lo consultan las partes participantes.{' '}
        <ChakraLink asChild color="primary">
          <RouterLink to="/privacidad">Consulta tus opciones de privacidad</RouterLink>
        </ChakraLink>
        .
      </Text>
    </Stack>
  )
}
