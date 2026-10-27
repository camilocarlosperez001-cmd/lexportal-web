import { useState } from 'react'
import { Button, Card, Flex, Link as ChakraLink, SegmentGroup, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { ArrowRight, Ban, Eye, MessageSquare, Search } from 'lucide-react'
import { Link as RouterLink } from 'react-router-dom'
import { EstadoSolicitudBadge } from '../../../components/shared/EstadoBadge'
import { FeedbackState } from '../../../components/shared/FeedbackState'
import { PageHeader } from '../../../components/shared/PageHeader'
import { useConsulta } from '../../../hooks/useConsulta'
import { useSesion } from '../../auth/hooks/useSesion'
import { leerClasificacion } from '../../../utils/contrato'
import { formatearFecha, formatearFechaHora } from '../../../utils/fechas'
import { listarSolicitudesPropias } from '../services/solicitudes'
import { DialogoCancelacion } from '../components/DialogoCancelacion'
import { TarjetaSolicitud } from '../components/TarjetaSolicitud'
import {
  contarPorEstado,
  etiquetaTipoCaso,
  filtrarPorEstado,
  OPCIONES_FILTRO_SOLICITUD,
  PERFIL_NO_DISPONIBLE,
  textoFiltroEstado,
  type FiltroEstadoSolicitud,
} from '../utils'

/**
 * CU 09: seguimiento del ciudadano sobre las solicitudes de contacto que envió.
 * La consulta se limita a las filas propias (`ciudadano_id`) y RLS vuelve a filtrarlas
 * en el servidor. Solo las solicitudes pendientes pueden cancelarse.
 */
export function MisSolicitudesPage() {
  const { estado, cuenta } = useSesion()
  const [filtro, setFiltro] = useState<FiltroEstadoSolicitud>('todas')
  const [porCancelar, setPorCancelar] = useState<string | null>(null)

  const cuentaId = cuenta?.id ?? null
  const solicitudes = useConsulta(
    () => (cuentaId ? listarSolicitudesPropias(cuentaId) : Promise.resolve([])),
    `solicitudes-propias-${cuentaId ?? 'sin-sesion'}`,
  )

  if (estado === 'cargando') {
    return <FeedbackState kind="loading" title="Comprobando tu sesión" />
  }

  if (estado === 'sin-sesion') {
    return (
      <FeedbackState
        kind="empty"
        title="Inicia sesión para ver tus solicitudes"
        description="El seguimiento de las solicitudes de contacto requiere una cuenta. La búsqueda en el directorio sigue siendo pública."
        action={
          <Flex gap="2" wrap="wrap" justify="center">
            <Button asChild>
              <RouterLink to="/login">Iniciar sesión</RouterLink>
            </Button>
            <Button asChild variant="outline">
              <RouterLink to="/directorio">Buscar abogados</RouterLink>
            </Button>
          </Flex>
        }
      />
    )
  }

  if (estado === 'error') {
    return (
      <FeedbackState
        kind="error"
        title="No pudimos comprobar tu sesión"
        description="Vuelve a intentarlo en unos segundos."
        action={
          <Button variant="outline" asChild>
            <RouterLink to="/login">Ir a iniciar sesión</RouterLink>
          </Button>
        }
      />
    )
  }

  const lista = solicitudes.datos ?? []
  const contador = contarPorEstado(lista)
  const visibles = filtrarPorEstado(lista, filtro)
  const esCiudadano = cuenta?.rol === 'ciudadano'

  const accionesCabecera = (
    <Button asChild variant="outline">
      <RouterLink to="/directorio">
        <Search aria-hidden size={16} />
        Buscar abogados
      </RouterLink>
    </Button>
  )

  return (
    <Stack gap="6">
      <PageHeader
        etiqueta="Solicitudes de contacto"
        titulo="Mis solicitudes"
        descripcion="Consulta el estado de las solicitudes que enviaste a un perfil profesional, cancela las que sigan pendientes y abre el detalle de cada una."
        acciones={accionesCabecera}
      />

      {!esCiudadano && cuenta && (
        <FeedbackState
          kind="empty"
          title="Las solicitudes de contacto las envían las cuentas de ciudadano"
          description="Tu cuenta profesional recibe solicitudes: consúltalas en «Solicitudes recibidas»."
          action={
            <Button asChild variant="outline">
              <RouterLink to="/solicitudes-recibidas">Ver solicitudes recibidas</RouterLink>
            </Button>
          }
        />
      )}

      {esCiudadano && (
        <>
          {solicitudes.cargando && <FeedbackState kind="loading" title="Cargando tus solicitudes" />}

          {!solicitudes.cargando && solicitudes.error && (
            <FeedbackState
              kind="error"
              title="No se pudieron cargar tus solicitudes"
              description={solicitudes.error}
              action={
                <Button variant="outline" onClick={solicitudes.recargar}>
                  Reintentar
                </Button>
              }
            />
          )}

          {!solicitudes.cargando && !solicitudes.error && lista.length === 0 && (
            <FeedbackState
              kind="empty"
              title="Aún no has enviado solicitudes de contacto"
              description="Cuando solicites contacto a un perfil del directorio, podrás seguir aquí su estado y la decisión del abogado."
              action={
                <Button asChild>
                  <RouterLink to="/directorio">
                    <Search aria-hidden size={16} />
                    Buscar abogados
                  </RouterLink>
                </Button>
              }
            />
          )}

          {!solicitudes.cargando && !solicitudes.error && lista.length > 0 && (
            <Stack gap="5">
              <SimpleGrid columns={{ base: 2, md: 5 }} gap="3">
                <ResumenSolicitudes etiqueta="Todas" total={lista.length} />
                <ResumenSolicitudes etiqueta="Pendientes" total={contador.pendiente} />
                <ResumenSolicitudes etiqueta="Aceptadas" total={contador.aceptada} />
                <ResumenSolicitudes etiqueta="Rechazadas" total={contador.rechazada} />
                <ResumenSolicitudes etiqueta="Canceladas" total={contador.cancelada} />
              </SimpleGrid>

              <SegmentGroup.Root
                value={filtro}
                onValueChange={(detalles) => {
                  if (detalles.value) setFiltro(detalles.value as FiltroEstadoSolicitud)
                }}
                aria-label="Filtrar las solicitudes por estado"
              >
                <SegmentGroup.Indicator />
                {OPCIONES_FILTRO_SOLICITUD.map((opcion) => {
                  const total = opcion.valor === 'todas' ? lista.length : contador[opcion.valor]
                  return (
                    <SegmentGroup.Item key={opcion.valor} value={opcion.valor}>
                      <SegmentGroup.ItemText>
                        {opcion.etiqueta} ({total})
                      </SegmentGroup.ItemText>
                      <SegmentGroup.ItemHiddenInput />
                    </SegmentGroup.Item>
                  )
                })}
              </SegmentGroup.Root>

              {visibles.length === 0 ? (
                <FeedbackState
                  kind="empty"
                  title="No hay solicitudes en este estado"
                  description={`Ninguna de tus solicitudes está en estado «${textoFiltroEstado(filtro)}». Cambia el filtro para ver las demás.`}
                  action={
                    <Button variant="outline" onClick={() => setFiltro('todas')}>
                      Ver todas
                    </Button>
                  }
                />
              ) : (
                <Stack gap="4">
                  {visibles.map((solicitud) => {
                    const clasificacion = leerClasificacion(solicitud.clasificacion_al_enviar)
                    const nombreAbogado = solicitud.nombre_abogado ?? PERFIL_NO_DISPONIBLE
                    const enviada = formatearFechaHora(solicitud.enviada_en)
                    const puedeCancelar = solicitud.estado === 'pendiente'
                    const conversacionId = solicitud.conversaciones?.id ?? null

                    return (
                      <TarjetaSolicitud
                        key={solicitud.id}
                        etiqueta="Solicitud enviada"
                        titulo={nombreAbogado}
                        descripcion={solicitud.descripcion_breve}
                        insignias={<EstadoSolicitudBadge estado={solicitud.estado} />}
                        datos={[
                          {
                            etiqueta: 'Tipo de caso',
                            valor: etiquetaTipoCaso(solicitud.tipos_caso?.nombre_cotidiano, clasificacion.tipoCaso),
                          },
                          {
                            etiqueta: 'Áreas declaradas',
                            valor: clasificacion.areas.length > 0 ? clasificacion.areas.join(', ') : null,
                          },
                          { etiqueta: 'Ciudad de atención', valor: solicitud.perfiles_abogados?.ciudad_atencion ?? null },
                          { etiqueta: 'Enviada', valor: enviada },
                          {
                            etiqueta: 'Decisión',
                            valor: solicitud.decidida_en ? formatearFecha(solicitud.decidida_en) : null,
                          },
                        ]}
                        acciones={
                          <>
                            <Button size="sm" variant="outline" asChild>
                              <RouterLink to={`/solicitudes/${solicitud.id}`}>
                                <Eye aria-hidden size={16} />
                                Ver detalle
                              </RouterLink>
                            </Button>
                            {conversacionId && (
                              <Button size="sm" variant="outline" asChild>
                                <RouterLink to={`/mensajes/${conversacionId}`}>
                                  <MessageSquare aria-hidden size={16} />
                                  Abrir conversación
                                </RouterLink>
                              </Button>
                            )}
                            {puedeCancelar && (
                              <Button size="sm" variant="outline" colorPalette="red" onClick={() => setPorCancelar(solicitud.id)}>
                                <Ban aria-hidden size={16} />
                                Cancelar
                              </Button>
                            )}
                            {!puedeCancelar && (
                              <Text textStyle="body-sm" color="fg.muted">
                                Esta solicitud ya no está pendiente y conserva su decisión registrada.
                              </Text>
                            )}
                          </>
                        }
                      />
                    )
                  })}
                </Stack>
              )}

              <ChakraLink asChild alignSelf="flex-start" color="primary" fontWeight="600">
                <RouterLink to="/directorio">
                  Explorar el directorio de abogados
                  <ArrowRight aria-hidden size={14} />
                </RouterLink>
              </ChakraLink>
            </Stack>
          )}
        </>
      )}

      {porCancelar && (
        <DialogoCancelacion
          key={porCancelar}
          solicitudId={porCancelar}
          abierto
          alCerrar={() => setPorCancelar(null)}
          alCancelar={solicitudes.recargar}
        />
      )}
    </Stack>
  )
}

function ResumenSolicitudes({ etiqueta, total }: { etiqueta: string; total: number }) {
  return (
    <Card.Root bg="bg.subtle" borderWidth="1px" borderColor="border">
      <Card.Body gap="1" p="4">
        <Text textStyle="label-caps" color="fg.muted">
          {etiqueta}
        </Text>
        <Text textStyle="headline-sm" color="primary">
          {total}
        </Text>
      </Card.Body>
    </Card.Root>
  )
}
