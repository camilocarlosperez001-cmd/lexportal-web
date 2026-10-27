import { useState } from 'react'
import { Button, Flex, SegmentGroup, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { Eye, Search, UserRound } from 'lucide-react'
import { Link as RouterLink } from 'react-router-dom'
import { EstadoSolicitudBadge } from '../../../components/shared/EstadoBadge'
import { FeedbackState } from '../../../components/shared/FeedbackState'
import { PageHeader } from '../../../components/shared/PageHeader'
import { useConsulta } from '../../../hooks/useConsulta'
import { useSesion } from '../../auth/hooks/useSesion'
import { cargarMiPerfil } from '../../perfil/services/perfil'
import { leerClasificacion } from '../../../utils/contrato'
import { formatearFecha } from '../../../utils/fechas'
import { listarSolicitudesRecibidas, type SolicitudRecibida } from '../services/solicitudes'
import { TarjetaSolicitud } from '../components/TarjetaSolicitud'
import {
  contarPorEstado,
  etiquetaTipoCaso,
  filtrarPorEstado,
  OPCIONES_FILTRO_SOLICITUD,
  textoFiltroEstado,
  type FiltroEstadoSolicitud,
} from '../utils'

/**
 * CU 10: bandeja del abogado con las solicitudes dirigidas a su perfil. La consulta usa el
 * identificador del perfil propio, de modo que RLS solo devuelve las filas de las que la
 * cuenta es destinataria.
 *
 * La identidad del solicitante no se expone: la política de lectura de public.cuentas
 * reserva esos datos al titular y a la administración, así que la bandeja no la consulta
 * ni la muestra.
 */
export function SolicitudesRecibidasPage() {
  const { estado, cuenta } = useSesion()
  const [filtro, setFiltro] = useState<FiltroEstadoSolicitud>('todas')

  const cuentaId = cuenta?.id ?? null
  const perfil = useConsulta(
    () => (cuentaId ? cargarMiPerfil(cuentaId) : Promise.resolve(null)),
    `perfil-propio-${cuentaId ?? 'sin-sesion'}`,
  )
  const perfilId = perfil.datos?.id ?? null

  const recibidas = useConsulta(
    () => (perfilId ? listarSolicitudesRecibidas(perfilId) : Promise.resolve<SolicitudRecibida[]>([])),
    `solicitudes-recibidas-${perfilId ?? 'sin-perfil'}`,
  )

  if (estado === 'cargando' || perfil.cargando) {
    return <FeedbackState kind="loading" title="Comprobando tu perfil profesional" />
  }

  if (estado === 'sin-sesion') {
    return (
      <FeedbackState
        kind="empty"
        title="Inicia sesión para ver las solicitudes recibidas"
        description="La bandeja de solicitudes es privada de la cuenta profesional destinataria."
        action={
          <Button asChild>
            <RouterLink to="/login">Iniciar sesión</RouterLink>
          </Button>
        }
      />
    )
  }

  if (estado === 'error' || perfil.error) {
    return (
      <FeedbackState
        kind="error"
        title="No se pudo comprobar tu perfil profesional"
        description={perfil.error ?? 'Vuelve a intentarlo en unos segundos.'}
        action={
          <Button variant="outline" onClick={perfil.recargar}>
            Reintentar
          </Button>
        }
      />
    )
  }

  if (!perfil.datos) {
    return (
      <Stack gap="6">
        <PageHeader
          etiqueta="Solicitudes recibidas"
          titulo="Completa tu perfil profesional"
          descripcion="Las solicitudes de contacto se dirigen a un perfil profesional. Cuando exista el tuyo, aparecerán aquí."
        />
        <FeedbackState
          kind="empty"
          title="Todavía no tienes un perfil profesional"
          description="El alta profesional y su verificación son requisitos para recibir solicitudes de contacto. Puedes completar el registro por pasos en «Mi perfil»."
          action={
            <Button asChild>
              <RouterLink to="/mi-perfil">Ir a mi perfil profesional</RouterLink>
            </Button>
          }
        />
      </Stack>
    )
  }

  const lista = recibidas.datos ?? []
  const contador = contarPorEstado(lista)
  const visibles = filtrarPorEstado(lista, filtro)

  return (
    <Stack gap="6">
      <PageHeader
        etiqueta="Solicitudes recibidas"
        titulo="Solicitudes dirigidas a tu perfil"
        descripcion="Revisa el relato y la clasificación declarada, acepta o rechaza mientras la solicitud siga pendiente y registra una orientación cuando el asunto corresponda a otra área de práctica."
      />

      {recibidas.cargando && <FeedbackState kind="loading" title="Cargando las solicitudes recibidas" />}

      {!recibidas.cargando && recibidas.error && (
        <FeedbackState
          kind="error"
          title="No se pudieron cargar las solicitudes recibidas"
          description={recibidas.error}
          action={
            <Button variant="outline" onClick={recibidas.recargar}>
              Reintentar
            </Button>
          }
        />
      )}

      {!recibidas.cargando && !recibidas.error && lista.length === 0 && (
        <FeedbackState
          kind="empty"
          title="Aún no has recibido solicitudes de contacto"
          description="Cuando un ciudadano solicite contacto a tu perfil, la solicitud aparecerá en esta bandeja para que la aceptes o la rechaces."
          action={
            <Button asChild variant="outline">
              <RouterLink to="/mi-perfil">Revisar mi perfil público</RouterLink>
            </Button>
          }
        />
      )}

      {!recibidas.cargando && !recibidas.error && lista.length > 0 && (
        <Stack gap="5">
          <SimpleGrid columns={{ base: 2, md: 5 }} gap="3">
            <ResumenRecibidas etiqueta="Todas" total={lista.length} />
            <ResumenRecibidas etiqueta="Pendientes" total={contador.pendiente} />
            <ResumenRecibidas etiqueta="Aceptadas" total={contador.aceptada} />
            <ResumenRecibidas etiqueta="Rechazadas" total={contador.rechazada} />
            <ResumenRecibidas etiqueta="Canceladas" total={contador.cancelada} />
          </SimpleGrid>

          <SegmentGroup.Root
            value={filtro}
            onValueChange={(detalles) => {
              if (detalles.value) setFiltro(detalles.value as FiltroEstadoSolicitud)
            }}
            aria-label="Filtrar las solicitudes recibidas por estado"
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
              description={`Ninguna de las solicitudes recibidas está en estado «${textoFiltroEstado(filtro)}». Cambia el filtro para ver las demás.`}
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
                const tipoCaso = etiquetaTipoCaso(solicitud.tipos_caso?.nombre_cotidiano, clasificacion.tipoCaso)

                return (
                  <TarjetaSolicitud
                    key={solicitud.id}
                    etiqueta="Solicitud de una cuenta de ciudadano"
                    titulo={`Solicitud recibida: ${tipoCaso}`}
                    descripcion={solicitud.descripcion_breve}
                    insignias={<EstadoSolicitudBadge estado={solicitud.estado} />}
                    datos={[
                      { etiqueta: 'Tipo de caso declarado', valor: tipoCaso },
                      {
                        etiqueta: 'Áreas de la clasificación declarada',
                        valor: clasificacion.areas.length > 0 ? clasificacion.areas.join(', ') : null,
                      },
                      { etiqueta: 'Recibida', valor: formatearFecha(solicitud.enviada_en) },
                      {
                        etiqueta: 'Decisión registrada',
                        valor: solicitud.decidida_en ? formatearFecha(solicitud.decidida_en) : null,
                      },
                    ]}
                    acciones={
                      <>
                        <Button size="sm" asChild>
                          <RouterLink to={`/solicitudes-recibidas/${solicitud.id}`}>
                            <Eye aria-hidden size={16} />
                            Abrir solicitud
                          </RouterLink>
                        </Button>
                        <Flex gap="2" align="center" color="fg.muted">
                          <UserRound aria-hidden size={16} />
                          <Text textStyle="body-sm">
                            La identidad del solicitante no se muestra en la bandeja.
                          </Text>
                        </Flex>
                      </>
                    }
                  />
                )
              })}
            </Stack>
          )}

          <Flex gap="2" align="center" color="fg.muted" wrap="wrap">
            <Search aria-hidden size={16} />
            <Text textStyle="body-sm">
              El relato completo se consulta al abrir cada solicitud; esta bandeja no incluye datos de contacto del
              ciudadano.
            </Text>
          </Flex>
        </Stack>
      )}
    </Stack>
  )
}

function ResumenRecibidas({ etiqueta, total }: { etiqueta: string; total: number }) {
  return (
    <Stack gap="1" bg="bg.subtle" borderWidth="1px" borderColor="border" borderRadius="md" p="4">
      <Text textStyle="label-caps" color="fg.muted">
        {etiqueta}
      </Text>
      <Text textStyle="headline-sm" color="primary">
        {total}
      </Text>
    </Stack>
  )
}
