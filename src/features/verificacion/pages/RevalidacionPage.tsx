// CU 18 — Revalidación profesional: política vigente, revalidaciones programadas y
// vencidas, perfiles suspendidos e historial trazable de decisiones.
// La ejecución periódica se delega en la función RPC `ejecutar_revalidacion_periodica`,
// verificada en local y autorizada a la administración autenticada; el cliente no decide
// por sí mismo qué perfiles requieren revalidación.

import { useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Flex,
  Input,
  Link as ChakraLink,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
} from '@chakra-ui/react'
import {
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CircleAlert,
  History,
  Info,
  Landmark,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldOff,
  TriangleAlert,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { EstadoRevisionBadge, VisibilidadBadge } from '../../../components/shared/EstadoBadge'
import { FeedbackState } from '../../../components/shared/FeedbackState'
import { ListaDatos } from '../../../components/shared/ListaDatos'
import { PageHeader } from '../../../components/shared/PageHeader'
import { toaster } from '../../../components/ui/toaster-store'
import { useSesion } from '../../auth/hooks/useSesion'
import { useConsulta } from '../../../hooks/useConsulta'
import { ETIQUETA_ESTADO_REVISION, ETIQUETA_TIPO_REVISION } from '../../../utils/etiquetas'
import { esErrorDePermiso, mensajeDeError } from '../../../utils/errores'
import { validarEnteroNoNegativo } from '../../../utils/validaciones'
import {
  MAX_DIAS_REVALIDACION,
  cargarPoliticaRevalidacion,
  ejecutarRevalidacionPeriodica,
  guardarPoliticaRevalidacion,
  listarHistorialRevalidacion,
  listarPerfilesSuspendidos,
  listarRevalidaciones,
  reactivarPerfil,
  type FilaHistorial,
  type FilaRevalidacion,
  type PerfilSuspendido,
} from '../services/verificacion'
import { SIN_REGISTRO, clasificarRevalidacion, textoFechaHora } from '../utils'

export function RevalidacionPage() {
  const { cuenta } = useSesion()
  const [intento, setIntento] = useState(0)
  const [mensajeAccion, setMensajeAccion] = useState<string | null>(null)

  const politica = useConsulta(cargarPoliticaRevalidacion, `politica-revalidacion:${intento}`)
  const revalidaciones = useConsulta(listarRevalidaciones, `revalidaciones:${intento}`)
  const suspendidos = useConsulta(listarPerfilesSuspendidos, `perfiles-suspendidos:${intento}`)
  const historial = useConsulta(listarHistorialRevalidacion, `historial-revalidacion:${intento}`)

  function refrescar() {
    setIntento((valor) => valor + 1)
  }

  const programadas = (revalidaciones.datos ?? []).filter((fila) => clasificarRevalidacion(fila) === 'programada')
  const vencidas = (revalidaciones.datos ?? []).filter((fila) => clasificarRevalidacion(fila) === 'vencida')
  // Las revalidaciones ya decididas se muestran en el historial trazable: aquí solo se
  // listan las que siguen pendientes de atención.
  const atendidas = (revalidaciones.datos ?? []).filter((fila) => clasificarRevalidacion(fila) === 'decidida')

  return (
    <Stack gap="6">
      <PageHeader
        titulo="Revalidación profesional"
        descripcion="Periodicidad configurada, revisiones programadas y vencidas, suspensiones de visibilidad e historial de decisiones administrativas."
        etiqueta="CU 18 · Revalidación"
        acciones={
          <Button variant="outline" onClick={refrescar}>
            <RefreshCw aria-hidden size={16} />
            Actualizar
          </Button>
        }
      />

      {mensajeAccion && (
        <Alert.Root status="info" role="status">
          <Alert.Indicator>
            <Info aria-hidden size={18} />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>Acción registrada</Alert.Title>
            <Alert.Description>{mensajeAccion}</Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}

      <SimpleGrid columns={{ base: 1, lg: 2 }} gap="6" alignItems="start">
        <PoliticaVigente
          politica={politica.datos}
          cargando={politica.cargando}
          error={politica.error}
          recargar={politica.recargar}
          cuentaId={cuenta?.id ?? null}
          alActualizar={refrescar}
          alInformar={setMensajeAccion}
        />
        <EjecucionPeriodica alActualizar={refrescar} alInformar={setMensajeAccion} />
      </SimpleGrid>

      <RevisionesDeRevalidacion
        programadas={programadas}
        vencidas={vencidas}
        atendidas={atendidas}
        cargando={revalidaciones.cargando}
        error={revalidaciones.error}
        recargar={revalidaciones.recargar}
      />

      <PerfilesSuspendidos
        perfiles={suspendidos.datos}
        cargando={suspendidos.cargando}
        error={suspendidos.error}
        recargar={suspendidos.recargar}
        alActualizar={refrescar}
        alInformar={setMensajeAccion}
      />

      <HistorialDecisiones
        historial={historial.datos}
        cargando={historial.cargando}
        error={historial.error}
        recargar={historial.recargar}
      />
    </Stack>
  )
}

/** Política de revalidación vigente y formulario para fijar una nueva periodicidad. */
function PoliticaVigente({
  politica,
  cargando,
  error,
  recargar,
  cuentaId,
  alActualizar,
  alInformar,
}: {
  politica: { id: string; periodicidad_dias: number; vigente_desde: string; configurada_por: string } | null
  cargando: boolean
  error: string | null
  recargar: () => void
  cuentaId: string | null
  alActualizar: () => void
  alInformar: (mensaje: string) => void
}) {
  const [dias, setDias] = useState('')
  const [errorDias, setErrorDias] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    const validacion = validarEnteroNoNegativo(dias, 'la periodicidad en días', MAX_DIAS_REVALIDACION)
    if (validacion) {
      setErrorDias(validacion)
      return
    }
    if (!cuentaId) {
      setErrorAccion('No se pudo identificar tu cuenta para registrar quién configura la política.')
      return
    }

    setGuardando(true)
    setErrorAccion(null)
    try {
      await guardarPoliticaRevalidacion(Number(dias), cuentaId)
      toaster.create({
        title: 'Política de revalidación actualizada',
        description: `La nueva periodicidad de ${Number(dias)} días queda vigente desde ahora; la política anterior se conserva en el historial.`,
        type: 'success',
      })
      setDias('')
      alInformar('Nueva periodicidad fijada. Las próximas revalidaciones deben programarse conforme a ella.')
      alActualizar()
    } catch (fallo: unknown) {
      setErrorAccion(
        esErrorDePermiso(fallo)
          ? 'Solo la administración puede configurar la política de revalidación.'
          : mensajeDeError(fallo, 'No se pudo guardar la política de revalidación.'),
      )
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Card.Root>
      <Card.Header gap="1">
        <Flex align="center" gap="2">
          <CalendarDays aria-hidden size={18} />
          <Card.Title>Política de revalidación vigente</Card.Title>
        </Flex>
        <Text textStyle="body-sm" color="fg.muted">
          La periodicidad aplicada es la última registrada. Se conservan las políticas anteriores para la trazabilidad.
        </Text>
      </Card.Header>
      <Card.Body gap="5">
        {cargando && <FeedbackState kind="loading" title="Cargando la política vigente" />}

        {!cargando && error && (
          <FeedbackState
            kind="error"
            title="No se pudo cargar la política de revalidación"
            description={error}
            action={<Button onClick={recargar}>Reintentar</Button>}
          />
        )}

        {!cargando && !error && !politica && (
          <FeedbackState
            kind="empty"
            title="Aún no hay una periodicidad configurada"
            description="Sin política registrada no es posible determinar cada cuánto revalidar. Fija la periodicidad en días para dejar la regla vigente."
          />
        )}

        {!cargando && !error && politica && (
          <ListaDatos
            items={[
              { etiqueta: 'Periodicidad', valor: `${politica.periodicidad_dias} días` },
              { etiqueta: 'Vigente desde', valor: textoFechaHora(politica.vigente_desde) },
              { etiqueta: 'Configurada por', valor: `Cuenta ${politica.configurada_por.slice(0, 8)}…` },
            ]}
          />
        )}

        <Stack gap="4" borderTopWidth="1px" pt="4">
          <Field.Root invalid={Boolean(errorDias)}>
            <Field.Label>Nueva periodicidad (días)</Field.Label>
            <Input
              type="number"
              min={1}
              max={MAX_DIAS_REVALIDACION}
              inputMode="numeric"
              value={dias}
              onChange={(evento) => {
                setDias(evento.target.value)
                setErrorDias(null)
              }}
              placeholder="Por ejemplo, 730"
            />
            <Field.HelperText>
              Se registra una nueva fila con la fecha de vigencia; la política anterior no se reescribe.
            </Field.HelperText>
            <Field.ErrorText>{errorDias}</Field.ErrorText>
          </Field.Root>

          <Flex>
            <Button onClick={() => void guardar()} loading={guardando} disabled={!cuentaId}>
              <CalendarCheck aria-hidden size={16} />
              Fijar periodicidad
            </Button>
          </Flex>
        </Stack>

        {errorAccion && (
          <Alert.Root status="error" role="alert">
            <Alert.Indicator>
              <CircleAlert aria-hidden size={18} />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>No se pudo guardar la política</Alert.Title>
              <Alert.Description>{errorAccion}</Alert.Description>
            </Alert.Content>
          </Alert.Root>
        )}
      </Card.Body>
    </Card.Root>
  )
}

/** Ejecución de la revalidación periódica en la base de datos. */
function EjecucionPeriodica({
  alActualizar,
  alInformar,
}: {
  alActualizar: () => void
  alInformar: (mensaje: string) => void
}) {
  const [ejecutando, setEjecutando] = useState(false)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

  async function ejecutar() {
    setEjecutando(true)
    setErrorAccion(null)
    try {
      await ejecutarRevalidacionPeriodica()
      toaster.create({
        title: 'Revalidación periódica ejecutada',
        description: 'La ejecución quedó registrada. Revisa abajo las revisiones programadas y vencidas resultantes.',
        type: 'success',
      })
      alInformar('Ejecución de la revalidación periódica completada. Revisa las revisiones pendientes y vencidas.')
      alActualizar()
    } catch (fallo: unknown) {
      setErrorAccion(
        esErrorDePermiso(fallo)
          ? 'Solo la administración puede ejecutar la revalidación periódica.'
          : mensajeDeError(
              fallo,
              'No se pudo ejecutar la revalidación periódica. Revisa la conexión e inténtalo de nuevo.',
            ),
      )
    } finally {
      setEjecutando(false)
    }
  }

  return (
    <Card.Root>
      <Card.Header gap="1">
        <Flex align="center" gap="2">
          <Play aria-hidden size={18} />
          <Card.Title>Ejecutar revalidación periódica</Card.Title>
        </Flex>
        <Text textStyle="body-sm" color="fg.muted">
          La ejecución delega el cálculo en la función de la base de datos. No modifica por sí sola la verificación
          vigente: cada caso requiere una decisión administrativa registrada.
        </Text>
      </Card.Header>
      <Card.Body gap="4">
        <Alert.Root status="info" role="status">
          <Alert.Indicator>
            <Info aria-hidden size={18} />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>Ejecución autorizada a la administración</Alert.Title>
            <Alert.Description>
              La función está aplicada y verificada en local; solo la administración autenticada puede ejecutarla. Crea
              las revisiones programadas que correspondan y no cambia por sí sola ninguna verificación vigente.
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>

        <Flex>
          <Button onClick={() => void ejecutar()} loading={ejecutando}>
            <Play aria-hidden size={16} />
            Ejecutar revalidación periódica
          </Button>
        </Flex>

        {errorAccion && (
          <Alert.Root status="error" role="alert">
            <Alert.Indicator>
              <CircleAlert aria-hidden size={18} />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>No se pudo ejecutar la revalidación</Alert.Title>
              <Alert.Description>{errorAccion}</Alert.Description>
            </Alert.Content>
          </Alert.Root>
        )}
      </Card.Body>
    </Card.Root>
  )
}

/** Revalidaciones programadas y vencidas con el perfil y la versión. */
function RevisionesDeRevalidacion({
  programadas,
  vencidas,
  atendidas,
  cargando,
  error,
  recargar,
}: {
  programadas: FilaRevalidacion[]
  vencidas: FilaRevalidacion[]
  atendidas: FilaRevalidacion[]
  cargando: boolean
  error: string | null
  recargar: () => void
}) {
  const pendientes = programadas.length + vencidas.length

  return (
    <Card.Root>
      <Card.Header gap="1">
        <Flex align="center" gap="2">
          <CalendarClock aria-hidden size={18} />
          <Card.Title>Revisiones de revalidación pendientes</Card.Title>
        </Flex>
        <Text textStyle="body-sm" color="fg.muted">
          La fecha prevista se calcula sobre `proxima_revision`. Estas revisiones todavía no tienen decisión; las ya
          decididas se conservan en el historial de abajo.
        </Text>
      </Card.Header>
      <Card.Body>
        {cargando && <FeedbackState kind="loading" title="Cargando las revalidaciones" />}

        {!cargando && error && (
          <FeedbackState
            kind="error"
            title="No se pudieron cargar las revalidaciones"
            description={error}
            action={<Button onClick={recargar}>Reintentar</Button>}
          />
        )}

        {!cargando && !error && pendientes === 0 && (
          <FeedbackState
            kind="empty"
            title="No hay revalidaciones pendientes"
            description={
              atendidas.length > 0
                ? 'Las revalidaciones registradas ya tienen una decisión; consulta el historial trazable más abajo.'
                : 'Programa una revalidación sobre una versión aprobada o ejecuta la revalidación periódica cuando la política esté configurada.'
            }
          />
        )}

        {!cargando && !error && pendientes > 0 && (
          <Tabs.Root defaultValue={vencidas.length > 0 ? 'vencidas' : 'programadas'} variant="line">
            <Tabs.List>
              <Tabs.Trigger value="vencidas">
                Vencidas
                <Badge variant="subtle" size="sm" ml="2">{vencidas.length}</Badge>
              </Tabs.Trigger>
              <Tabs.Trigger value="programadas">
                Programadas
                <Badge variant="subtle" size="sm" ml="2">{programadas.length}</Badge>
              </Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="vencidas" pt="4">
              <TablaRevalidaciones filas={vencidas} vacio="No hay revalidaciones vencidas sin decisión." />
            </Tabs.Content>
            <Tabs.Content value="programadas" pt="4">
              <TablaRevalidaciones filas={programadas} vacio="No hay revalidaciones programadas a futuro." />
            </Tabs.Content>
          </Tabs.Root>
        )}
      </Card.Body>
    </Card.Root>
  )
}

function TablaRevalidaciones({ filas, vacio }: { filas: FilaRevalidacion[]; vacio: string }) {
  if (filas.length === 0) return <Text color="fg.muted">{vacio}</Text>

  return (
    <Table.ScrollArea>
      <Table.Root size="sm">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>Profesional</Table.ColumnHeader>
            <Table.ColumnHeader>Versión</Table.ColumnHeader>
            <Table.ColumnHeader>Programada</Table.ColumnHeader>
            <Table.ColumnHeader>Próxima revisión</Table.ColumnHeader>
            <Table.ColumnHeader>Estado</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="end">Acciones</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {filas.map((fila) => (
            <Table.Row key={fila.revision.id}>
              <Table.Cell>
                <Stack gap="1">
                  <Text textStyle="title-sm">{fila.perfil.nombre_profesional}</Text>
                  <Text textStyle="body-sm" color="fg.muted">{fila.perfil.ciudad_atencion}</Text>
                </Stack>
              </Table.Cell>
              <Table.Cell>Versión {fila.version.numero_version}</Table.Cell>
              <Table.Cell>{textoFechaHora(fila.revision.programada_en)}</Table.Cell>
              <Table.Cell>{textoFechaHora(fila.revision.proxima_revision)}</Table.Cell>
              <Table.Cell>
                <Stack gap="2" align="start">
                  <EstadoRevisionBadge estado={fila.revision.estado} />
                  {fila.vencida && (
                    <Badge colorPalette="red" variant="subtle" size="sm">
                      <TriangleAlert aria-hidden size={14} />
                      Vencida
                    </Badge>
                  )}
                </Stack>
              </Table.Cell>
              <Table.Cell textAlign="end">
                <ChakraLink asChild color="primary" fontWeight="600">
                  <Link to={`/admin/verificacion/${fila.version.id}`}>Revisar versión</Link>
                </ChakraLink>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Table.ScrollArea>
  )
}

/** Perfiles suspendidos con su motivo y fecha, y reactivación administrativa. */
function PerfilesSuspendidos({
  perfiles,
  cargando,
  error,
  recargar,
  alActualizar,
  alInformar,
}: {
  perfiles: PerfilSuspendido[] | null
  cargando: boolean
  error: string | null
  recargar: () => void
  alActualizar: () => void
  alInformar: (mensaje: string) => void
}) {
  const [reactivando, setReactivando] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

  async function reactivar(perfilId: string, nombre: string) {
    setReactivando(perfilId)
    setErrorAccion(null)
    try {
      await reactivarPerfil(perfilId)
      toaster.create({
        title: 'Perfil reactivado',
        description: `La suspensión de ${nombre} quedó levantada. La publicación depende de la verificación vigente y de la actividad del perfil.`,
        type: 'success',
      })
      alInformar(`Suspensión levantada para ${nombre}.`)
      alActualizar()
    } catch (fallo: unknown) {
      setErrorAccion(
        esErrorDePermiso(fallo)
          ? 'Solo la administración puede reactivar un perfil.'
          : mensajeDeError(fallo, 'No se pudo reactivar el perfil.'),
      )
    } finally {
      setReactivando(null)
    }
  }

  return (
    <Card.Root>
      <Card.Header gap="1">
        <Flex align="center" gap="2">
          <ShieldOff aria-hidden size={18} />
          <Card.Title>Perfiles suspendidos</Card.Title>
        </Flex>
        <Text textStyle="body-sm" color="fg.muted">
          La suspensión conserva su motivo y su fecha; levantarla es una decisión administrativa expresa.
        </Text>
      </Card.Header>
      <Card.Body gap="4">
        {cargando && <FeedbackState kind="loading" title="Cargando los perfiles suspendidos" />}

        {!cargando && error && (
          <FeedbackState
            kind="error"
            title="No se pudieron cargar los perfiles suspendidos"
            description={error}
            action={<Button onClick={recargar}>Reintentar</Button>}
          />
        )}

        {!cargando && !error && perfiles && perfiles.length === 0 && (
          <FeedbackState
            kind="empty"
            title="No hay perfiles suspendidos"
            description="Ningún perfil tiene una suspensión registrada. Las suspensiones se aplican desde la revisión de la versión correspondiente."
          />
        )}

        {!cargando && !error && perfiles && perfiles.length > 0 && (
          <Table.ScrollArea>
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Profesional</Table.ColumnHeader>
                  <Table.ColumnHeader>Motivo</Table.ColumnHeader>
                  <Table.ColumnHeader>Suspendido</Table.ColumnHeader>
                  <Table.ColumnHeader>Visibilidad</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Acciones</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {perfiles.map((perfil) => (
                  <Table.Row key={perfil.id}>
                    <Table.Cell>
                      <Stack gap="1">
                        <Text textStyle="title-sm">{perfil.nombre_profesional}</Text>
                        <Text textStyle="body-sm" color="fg.muted">
                          {perfil.cuenta ? perfil.cuenta.correo : SIN_REGISTRO}
                        </Text>
                      </Stack>
                    </Table.Cell>
                    <Table.Cell maxW="sm">{perfil.motivo_suspension ?? SIN_REGISTRO}</Table.Cell>
                    <Table.Cell>{textoFechaHora(perfil.suspendido_en)}</Table.Cell>
                    <Table.Cell>
                      <VisibilidadBadge visibilidad={perfil.visibilidad} />
                    </Table.Cell>
                    <Table.Cell textAlign="end">
                      <Button
                        size="sm"
                        variant="outline"
                        loading={reactivando === perfil.id}
                        onClick={() => void reactivar(perfil.id, perfil.nombre_profesional)}
                      >
                        <RotateCcw aria-hidden size={16} />
                        Reactivar
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Table.ScrollArea>
        )}

        {errorAccion && (
          <Alert.Root status="error" role="alert">
            <Alert.Indicator>
              <CircleAlert aria-hidden size={18} />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>No se pudo reactivar el perfil</Alert.Title>
              <Alert.Description>{errorAccion}</Alert.Description>
            </Alert.Content>
          </Alert.Root>
        )}
      </Card.Body>
    </Card.Root>
  )
}

/** Historial trazable de decisiones de revalidación. */
function HistorialDecisiones({
  historial,
  cargando,
  error,
  recargar,
}: {
  historial: FilaHistorial[] | null
  cargando: boolean
  error: string | null
  recargar: () => void
}) {
  return (
    <Card.Root>
      <Card.Header gap="1">
        <Flex align="center" gap="2">
          <History aria-hidden size={18} />
          <Card.Title>Historial de decisiones</Card.Title>
        </Flex>
        <Text textStyle="body-sm" color="fg.muted">
          Cada decisión conserva su resultado, su motivo, la fecha y la cuenta responsable registrada.
        </Text>
      </Card.Header>
      <Card.Body>
        {cargando && <FeedbackState kind="loading" title="Cargando el historial" />}

        {!cargando && error && (
          <FeedbackState
            kind="error"
            title="No se pudo cargar el historial de decisiones"
            description={error}
            action={<Button onClick={recargar}>Reintentar</Button>}
          />
        )}

        {!cargando && !error && historial && historial.length === 0 && (
          <FeedbackState
            kind="empty"
            title="Todavía no hay decisiones de revalidación"
            description="Cuando se decida una revalidación, aquí quedará el resultado con su responsable y motivo."
          />
        )}

        {!cargando && !error && historial && historial.length > 0 && (
          <Stack gap="4" as="ul" listStyleType="none" p="0">
            {historial.map((fila) => (
              <Flex
                as="li"
                key={fila.revision.id}
                direction="column"
                gap="3"
                borderTopWidth="1px"
                pt="4"
                _first={{ borderTopWidth: 0, pt: 0 }}
              >
                <Flex gap="2" wrap="wrap" align="center">
                  <EstadoRevisionBadge estado={fila.revision.estado} />
                  <Badge variant="outline" size="sm">
                    <Landmark aria-hidden size={14} />
                    {ETIQUETA_TIPO_REVISION[fila.revision.tipo]}
                  </Badge>
                  <Text textStyle="body-sm" color="fg.muted">
                    {fila.perfil ? fila.perfil.nombre_profesional : 'Perfil no disponible'}
                  </Text>
                </Flex>
                <ListaDatos
                  items={[
                    { etiqueta: 'Responsable', valor: fila.responsable ? fila.responsable.nombre_completo : SIN_REGISTRO },
                    { etiqueta: 'Resultado', valor: ETIQUETA_ESTADO_REVISION[fila.revision.estado] },
                    { etiqueta: 'Decisión', valor: fila.revision.decision },
                    { etiqueta: 'Motivo', valor: fila.revision.motivo },
                    { etiqueta: 'Alcance', valor: fila.revision.alcance },
                    { etiqueta: 'Decidida', valor: textoFechaHora(fila.revision.decidida_en) },
                    { etiqueta: 'Próxima revisión', valor: textoFechaHora(fila.revision.proxima_revision) },
                  ]}
                />
              </Flex>
            ))}
          </Stack>
        )}
      </Card.Body>
    </Card.Root>
  )
}
