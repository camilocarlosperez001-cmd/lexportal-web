import { useState } from 'react'
import { Button, Flex, Link as ChakraLink, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { ArrowLeft, Ban, Compass, MessageSquare, Search } from 'lucide-react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { EstadoSolicitudBadge } from '../../../components/shared/EstadoBadge'
import { FeedbackState } from '../../../components/shared/FeedbackState'
import { ListaDatos } from '../../../components/shared/ListaDatos'
import { MediosContacto } from '../../../components/shared/MediosContacto'
import { PageHeader } from '../../../components/shared/PageHeader'
import { useConsulta } from '../../../hooks/useConsulta'
import { listarAreas, listarTiposCaso } from '../../catalogo/services/catalogo'
import { leerClasificacion } from '../../../utils/contrato'
import { formatearFechaHora } from '../../../utils/fechas'
import { ETIQUETA_ESTADO_SOLICITUD } from '../../../utils/etiquetas'
import { cargarContactoPublicoPerfil, cargarSolicitudPropia } from '../services/solicitudes'
import { DialogoCancelacion } from '../components/DialogoCancelacion'
import { SeccionDetalle } from '../components/SeccionDetalle'
import { etiquetaTipoCaso, PERFIL_NO_DISPONIBLE } from '../utils'

/**
 * CU 09 y CU 20 (vista del ciudadano): detalle de una solicitud propia. La fila se
 * consulta con `cargarSolicitudPropia`; si no existe o RLS la oculta, se informa sin
 * distinguir entre «no existe» y «sin acceso».
 */
export function DetalleSolicitudPage() {
  const { solicitudId } = useParams<{ solicitudId: string }>()
  const [confirmarCancelacion, setConfirmarCancelacion] = useState(false)

  const consulta = useConsulta(
    () => (solicitudId ? cargarSolicitudPropia(solicitudId) : Promise.resolve(null)),
    `solicitud-propia-${solicitudId ?? 'sin-id'}`,
  )
  // Perfil público del abogado: solo se muestra mientras esté publicado. El ciudadano no
  // puede leer `perfiles_abogados`, así que la fuente es la proyección buscar_abogados.
  const abogadoPerfilId = consulta.datos?.abogado_perfil_id ?? null
  const perfilPublico = useConsulta(
    () => cargarContactoPublicoPerfil(abogadoPerfilId),
    `solicitud-perfil-publico-${abogadoPerfilId ?? 'sin-perfil'}`,
  )
  // Catálogo completo (también inactivo) para resolver los nombres recomendados, que se
  // conservan por referencia histórica aunque el elemento haya dejado de ofrecerse.
  const areas = useConsulta(() => listarAreas(), 'areas-catalogo-orientacion')
  const tipos = useConsulta(() => listarTiposCaso(), 'tipos-caso-catalogo-orientacion')

  const solicitud = consulta.datos

  if (consulta.cargando) {
    return <FeedbackState kind="loading" title="Cargando la solicitud" />
  }

  if (consulta.error || !solicitud) {
    return (
      <Stack gap="6">
        <EncabezadoVolver />
        <FeedbackState
          kind="error"
          title="La solicitud no está disponible o no tienes acceso"
          description={consulta.error ?? 'No encontramos la solicitud con el identificador indicado.'}
          action={
            <Flex gap="2" wrap="wrap" justify="center">
              <Button variant="outline" onClick={consulta.recargar}>
                Reintentar
              </Button>
              <Button asChild variant="outline">
                <RouterLink to="/solicitudes">Volver a mis solicitudes</RouterLink>
              </Button>
            </Flex>
          }
        />
      </Stack>
    )
  }

  const clasificacion = leerClasificacion(solicitud.clasificacion_al_enviar)
  const tipoCaso = etiquetaTipoCaso(solicitud.tipos_caso?.nombre_cotidiano, clasificacion.tipoCaso)
  const nombreAbogado = solicitud.nombre_abogado ?? PERFIL_NO_DISPONIBLE
  const pendiente = solicitud.estado === 'pendiente'
  const conversacionId = solicitud.conversaciones?.id ?? null
  const orientacion = solicitud.orientaciones
  // Medios que el profesional publica en su perfil; la regla vive en el servicio.
  const contactoPublico = perfilPublico.datos
  const mediosContacto = contactoPublico?.medios ?? []
  const ciudadAtencion = solicitud.perfiles_abogados?.ciudad_atencion ?? contactoPublico?.ciudadAtencion ?? null

  const nombreAreaRecomendada = orientacion?.area_id
    ? areas.datos?.find((area) => area.id === orientacion.area_id)?.nombre ?? null
    : null
  const nombreTipoRecomendado = orientacion?.tipo_caso_id
    ? tipos.datos?.find((tipo) => tipo.id === orientacion.tipo_caso_id)?.nombre_cotidiano ?? null
    : null

  return (
    <Stack gap="6">
      <EncabezadoVolver />

      <PageHeader
        etiqueta="Solicitud de contacto"
        titulo={nombreAbogado}
        descripcion={`Enviada el ${formatearFechaHora(solicitud.enviada_en) ?? 'sin fecha registrada'}.`}
        acciones={<EstadoSolicitudBadge estado={solicitud.estado} />}
      />

      {contactoPublico && !contactoPublico.disponible && (
        <Text color="fg.muted" textStyle="body-sm">
          El perfil público del abogado no está disponible en este momento. La solicitud y su decisión se conservan.
        </Text>
      )}

      {perfilPublico.error && (
        <Text color="fg.muted" textStyle="body-sm">
          No se pudieron consultar los datos de contacto públicos del profesional.
        </Text>
      )}

      {mediosContacto.length > 0 && (
        <SeccionDetalle
          titulo="Datos de contacto publicados por el profesional"
          descripcion="Los publica el propio abogado en su perfil público, no los verifica la plataforma."
        >
          <Stack gap="3">
            <MediosContacto medios={mediosContacto} />
            <Text textStyle="body-sm" color="fg.muted">
              Si el abogado retira la publicación de su perfil, estos datos dejan de mostrarse aquí.
            </Text>
          </Stack>
        </SeccionDetalle>
      )}

      <SimpleGrid columns={{ base: 1, lg: 2 }} gap="5">
        <SeccionDetalle titulo="Tu relato">
          <ListaDatos
            orientacion="vertical"
            items={[
              { etiqueta: 'Descripción breve', valor: solicitud.descripcion_breve },
              { etiqueta: 'Ayuda buscada', valor: solicitud.ayuda_buscada },
            ]}
          />
        </SeccionDetalle>

        <SeccionDetalle
          titulo="Clasificación registrada"
          descripcion="Instantánea de la clasificación declarada al enviar la solicitud."
        >
          <ListaDatos
            orientacion="vertical"
            items={[
              { etiqueta: 'Tipo de caso', valor: tipoCaso },
              {
                etiqueta: 'Áreas declaradas al enviar',
                valor: clasificacion.areas.length > 0 ? clasificacion.areas.join(', ') : null,
              },
              { etiqueta: 'Ciudad de atención', valor: ciudadAtencion },
              { etiqueta: 'Enviada', valor: formatearFechaHora(solicitud.enviada_en) },
              { etiqueta: 'Decidida', valor: solicitud.decidida_en ? formatearFechaHora(solicitud.decidida_en) : null },
              { etiqueta: 'Cancelada', valor: solicitud.cancelada_en ? formatearFechaHora(solicitud.cancelada_en) : null },
            ]}
          />
        </SeccionDetalle>
      </SimpleGrid>

      {solicitud.motivo_rechazo && solicitud.estado === 'rechazada' && (
        <SeccionDetalle titulo="Motivo del rechazo" descripcion="Motivo general registrado por el abogado destinatario.">
          <Text whiteSpace="pre-wrap" color="fg">
            {solicitud.motivo_rechazo}
          </Text>
        </SeccionDetalle>
      )}

      {orientacion && (
        <SeccionDetalle
          titulo="Orientación recibida"
          descripcion="Recomendación de otra clasificación jurídica. No transfiere la solicitud ni tus datos a otro abogado."
        >
          <ListaDatos
            orientacion="vertical"
            items={[
              {
                etiqueta: 'Área recomendada',
                valor:
                  nombreAreaRecomendada ??
                  (orientacion.area_id ? 'Área recomendada fuera del catálogo vigente' : null),
              },
              {
                etiqueta: 'Tipo de caso recomendado',
                valor:
                  nombreTipoRecomendado ??
                  (orientacion.tipo_caso_id ? 'Tipo de caso recomendado fuera del catálogo vigente' : null),
              },
              { etiqueta: 'Comentario general', valor: orientacion.comentario_general },
              { etiqueta: 'Registrada', valor: formatearFechaHora(orientacion.creada_en) },
            ]}
          />
          <Flex gap="2" wrap="wrap">
            <Button asChild>
              <RouterLink
                to={`/directorio?areas=${orientacion.area_id ?? ''}&tiposCaso=${orientacion.tipo_caso_id ?? ''}`}
              >
                <Search aria-hidden size={16} />
                Buscar abogados con esta recomendación
              </RouterLink>
            </Button>
            <Button asChild variant="outline">
              <RouterLink to="/directorio">Explorar el directorio completo</RouterLink>
            </Button>
          </Flex>
        </SeccionDetalle>
      )}

      <SeccionDetalle titulo="Conversación" descripcion="El chat solo se habilita cuando el abogado acepta la solicitud.">
        {conversacionId ? (
          <Flex gap="3" wrap="wrap" align="center">
            <Text color="fg.muted">
              La aceptación habilitó una conversación única de texto. El intercambio no implica contratación ni
              garantiza resultados.
            </Text>
            <Button asChild>
              <RouterLink to={`/mensajes/${conversacionId}`}>
                <MessageSquare aria-hidden size={16} />
                Abrir la conversación
              </RouterLink>
            </Button>
          </Flex>
        ) : (
          <Text color="fg.muted">
            {pendiente
              ? 'Todavía no hay conversación: se habilita únicamente si el abogado acepta la solicitud.'
              : 'Esta solicitud no tiene una conversación habilitada.'}
          </Text>
        )}
      </SeccionDetalle>

      <SeccionDetalle
        titulo="Acciones sobre esta solicitud"
        descripcion="Solo tú puedes cancelarla y únicamente mientras siga pendiente."
        acciones={
          pendiente ? (
            <Button colorPalette="red" variant="outline" onClick={() => setConfirmarCancelacion(true)}>
              <Ban aria-hidden size={16} />
              Cancelar la solicitud
            </Button>
          ) : (
            <Text color="fg.muted">
              El estado vigente es «{ETIQUETA_ESTADO_SOLICITUD[solicitud.estado]}» y no admite cancelación.
            </Text>
          )
        }
      >
        {orientacion ? (
          <Flex gap="2" align="center" color="fg.muted">
            <Compass aria-hidden size={16} />
            <Text>Revisa la orientación recibida para iniciar una búsqueda con la clasificación recomendada.</Text>
          </Flex>
        ) : (
          <Text color="fg.muted">
            Si el asunto no corresponde a la práctica del abogado, puede registrar una orientación hacia otra
            clasificación jurídica.
          </Text>
        )}
      </SeccionDetalle>

      {confirmarCancelacion && solicitudId && (
        <DialogoCancelacion
          key={solicitudId}
          solicitudId={solicitudId}
          abierto
          alCerrar={() => setConfirmarCancelacion(false)}
          alCancelar={consulta.recargar}
        />
      )}
    </Stack>
  )
}

function EncabezadoVolver() {
  return (
    <ChakraLink asChild alignSelf="flex-start" color="primary" textStyle="label-md">
      <RouterLink to="/solicitudes">
        <ArrowLeft aria-hidden size={16} />
        Volver a mis solicitudes
      </RouterLink>
    </ChakraLink>
  )
}
