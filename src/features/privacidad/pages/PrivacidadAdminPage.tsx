import { useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Dialog,
  Field,
  Flex,
  Heading,
  NativeSelect,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
} from '@chakra-ui/react'
import { AlertTriangle, CheckCheck, Eye, Lock, ScrollText } from 'lucide-react'
import { EstadoPeticionBadge } from '../../../components/shared/EstadoBadge'
import { FeedbackState } from '../../../components/shared/FeedbackState'
import { PageHeader } from '../../../components/shared/PageHeader'
import { toaster } from '../../../components/ui/toaster-store'
import { useConsulta } from '../../../hooks/useConsulta'
import { useSesion } from '../../auth/hooks/useSesion'
import { esErrorDePermiso, mensajeDeError } from '../../../utils/errores'
import { formatearFechaHora } from '../../../utils/fechas'
import {
  ETIQUETA_ESTADO_PETICION,
  ETIQUETA_TIPO_PETICION,
  type EstadoPeticionPriv,
  type TipoPeticionPriv,
} from '../../../utils/etiquetas'
import { validarSeleccion, validarTextoRequerido } from '../../../utils/validaciones'
import {
  ESTADOS_PETICION,
  TIPOS_PETICION,
  listarPeticiones,
  resolverPeticion,
  type PeticionConTitular,
} from '../services/administracion'

/** Estados en los que la administración todavía puede registrar una resolución. */
const ESTADOS_RESOLUBLES: EstadoPeticionPriv[] = ['pendiente', 'en_proceso']

type BorradorResolucion = {
  estado: 'pendiente' | 'en_proceso' | 'resuelta'
  respuesta: string
  medidasAplicadas: string
}

const BORRADOR_INICIAL: BorradorResolucion = {
  estado: 'en_proceso',
  respuesta: '',
  medidasAplicadas: '',
}

/** Aviso permanente sobre el alcance de la resolución (CU 19). */
function AvisoAlcance() {
  return (
    <Alert.Root status="warning" mb="6">
      <Alert.Indicator>
        <AlertTriangle aria-hidden size={18} />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Title>La evaluación corresponde a la política aplicable</Alert.Title>
        <Alert.Description>
          Antes de responder, revisa la política de privacidad y de tratamiento de datos vigente. Debes documentar en
          «medidas aplicadas» el tratamiento de la información sujeta a conservación: retirar la publicación de un
          perfil en el directorio no elimina de inmediato el historial de solicitudes, mensajes o evidencias que la
          política obliga a conservar. La resolución no promete supresión instantánea de todo el historial.
        </Alert.Description>
      </Alert.Content>
    </Alert.Root>
  )
}

function filaTitular(peticion: PeticionConTitular): { nombre: string; correo: string } {
  if (!peticion.titular) return { nombre: 'Titular sin datos visibles', correo: '—' }
  return { nombre: peticion.titular.nombreCompleto, correo: peticion.titular.correo }
}

/**
 * CU 19 (parte administrativa) — Resolución de peticiones de privacidad.
 *
 * Lista las peticiones registradas por los titulares, permite filtrarlas por estado y tipo y
 * registra la resolución administrativa: estado, respuesta al titular, medidas aplicadas,
 * responsable (cuenta del administrador) y fecha de resolución. El aviso interno al titular lo
 * genera un trigger de la base de datos; el cliente no inserta notificaciones.
 */
export function PrivacidadAdminPage() {
  const { cuenta } = useSesion()
  const { datos, cargando, error, recargar } = useConsulta<PeticionConTitular[]>(
    listarPeticiones,
    'solicitudes-privacidad-admin',
  )
  const [filtroEstado, setFiltroEstado] = useState<'todos' | EstadoPeticionPriv>('todos')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | TipoPeticionPriv>('todos')
  const [peticionEnCurso, setPeticionEnCurso] = useState<PeticionConTitular | null>(null)
  const [borrador, setBorrador] = useState<BorradorResolucion>(BORRADOR_INICIAL)
  const [errores, setErrores] = useState<{ estado?: string; respuesta?: string; medidas?: string }>({})
  const [errorDialogo, setErrorDialogo] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [soloLectura, setSoloLectura] = useState(false)
  const [historial, setHistorial] = useState(false)

  const esAdministrador = cuenta?.rol === 'administrador'
  const peticiones = useMemo(() => datos ?? [], [datos])

  const filtradas = useMemo(
    () =>
      peticiones.filter(
        (peticion) =>
          (filtroEstado === 'todos' || peticion.solicitud.estado === filtroEstado) &&
          (filtroTipo === 'todos' || peticion.solicitud.tipo === filtroTipo),
      ),
    [peticiones, filtroEstado, filtroTipo],
  )

  const resueltas = useMemo(
    () => peticiones.filter((peticion) => peticion.solicitud.estado === 'resuelta'),
    [peticiones],
  )

  const abiertas = peticiones.filter((peticion) => peticion.solicitud.estado !== 'resuelta').length
  const errorDePermiso = error !== null && esErrorDePermiso(error)

  function abrirResolucion(peticion: PeticionConTitular) {
    setPeticionEnCurso(peticion)
    setSoloLectura(false)
    setErrorDialogo(null)
    setErrores({})
    setBorrador({
      estado: 'en_proceso',
      respuesta: peticion.solicitud.respuesta ?? '',
      medidasAplicadas: peticion.solicitud.medidas_aplicadas ?? '',
    })
  }

  function abrirConsulta(peticion: PeticionConTitular) {
    setPeticionEnCurso(peticion)
    setSoloLectura(true)
    setErrorDialogo(null)
    setErrores({})
    setBorrador({
      estado: 'resuelta',
      respuesta: peticion.solicitud.respuesta ?? '',
      medidasAplicadas: peticion.solicitud.medidas_aplicadas ?? '',
    })
  }

  async function guardarResolucion() {
    if (!peticionEnCurso || !cuenta) return
    const errorEstado = validarSeleccion(borrador.estado, 'el estado de la petición')
    const errorRespuesta = validarTextoRequerido(borrador.respuesta, 'la respuesta al titular', 1500)
    const errorMedidas = validarTextoRequerido(borrador.medidasAplicadas, 'las medidas aplicadas', 1500)
    setErrores({
      estado: errorEstado ?? undefined,
      respuesta: errorRespuesta ?? undefined,
      medidas: errorMedidas ?? undefined,
    })
    if (errorEstado || errorRespuesta || errorMedidas) return

    setGuardando(true)
    setErrorDialogo(null)
    try {
      await resolverPeticion(peticionEnCurso.solicitud.id, {
        estado: borrador.estado,
        respuesta: borrador.respuesta,
        medidasAplicadas: borrador.medidasAplicadas,
        responsableId: cuenta.id,
      })
      toaster.create({
        title: 'Resolución registrada',
        description:
          'Quedó trazada con responsable y fecha. El aviso interno al titular lo genera la base de datos al registrar la resolución.',
        type: 'success',
      })
      setPeticionEnCurso(null)
      recargar()
    } catch (fallo: unknown) {
      setErrorDialogo(mensajeDeError(fallo, 'No se pudo registrar la resolución de la petición.'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Box>
      <PageHeader
        titulo="Resolución de peticiones de privacidad"
        descripcion="Consulta las peticiones registradas por los titulares y registra la respuesta, las medidas aplicadas y el responsable de cada resolución."
        etiqueta="CU 19 · Privacidad de cuenta y perfil"
        acciones={
          <Button variant="outline" onClick={recargar} loading={cargando}>
            Actualizar
          </Button>
        }
      />

      <AvisoAlcance />

      {!esAdministrador && cuenta !== null && (
        <Alert.Root status="error" mb="6">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Tu rol no resuelve peticiones de privacidad</Alert.Title>
            <Alert.Description>
              La resolución corresponde a una cuenta administrativa. Si eres titular, consulta tus peticiones desde tu
              propia gestión de privacidad.
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}

      {cargando && !datos && <FeedbackState kind="loading" title="Cargando las peticiones de privacidad" />}

      {error !== null && (
        <FeedbackState
          kind="error"
          title={errorDePermiso ? 'No tienes permiso para consultar estas peticiones' : 'No se pudieron cargar las peticiones'}
          description={
            errorDePermiso
              ? 'El listado administrativo de privacidad requiere una cuenta con rol administrativo.'
              : error
          }
          action={
            <Button variant="outline" onClick={recargar}>
              Reintentar
            </Button>
          }
        />
      )}

      {datos && error === null && (
        <Stack gap="6">
          <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap="4">
            <Card.Root>
              <Card.Body>
                <Text textStyle="label-caps" color="fg.muted">Peticiones registradas</Text>
                <Heading as="p" textStyle="headline-md" color="primary">{peticiones.length}</Heading>
              </Card.Body>
            </Card.Root>
            <Card.Root>
              <Card.Body>
                <Text textStyle="label-caps" color="fg.muted">Sin resolver</Text>
                <Heading as="p" textStyle="headline-md" color="primary">{abiertas}</Heading>
                <Text textStyle="body-sm" color="fg.muted">Pendientes o en proceso</Text>
              </Card.Body>
            </Card.Root>
            <Card.Root>
              <Card.Body>
                <Text textStyle="label-caps" color="fg.muted">Resueltas</Text>
                <Heading as="p" textStyle="headline-md" color="primary">{resueltas.length}</Heading>
                <Text textStyle="body-sm" color="fg.muted">Con respuesta registrada</Text>
              </Card.Body>
            </Card.Root>
            <Card.Root>
              <Card.Body>
                <Text textStyle="label-caps" color="fg.muted">Mostrando ahora</Text>
                <Heading as="p" textStyle="headline-md" color="primary">{filtradas.length}</Heading>
                <Text textStyle="body-sm" color="fg.muted">Según los filtros activos</Text>
              </Card.Body>
            </Card.Root>
          </SimpleGrid>

          <Card.Root>
            <Card.Body>
              <Flex gap="4" direction={{ base: 'column', md: 'row' }} align={{ base: 'stretch', md: 'end' }}>
                <Field.Root flex="1">
                  <Field.Label>Filtrar por estado</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={filtroEstado}
                      onChange={(evento) => setFiltroEstado(evento.target.value as 'todos' | EstadoPeticionPriv)}
                    >
                      <option value="todos">Todos los estados</option>
                      {ESTADOS_PETICION.map((estado) => (
                        <option key={estado} value={estado}>
                          {ETIQUETA_ESTADO_PETICION[estado]}
                        </option>
                      ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Field.Root>
                <Field.Root flex="1">
                  <Field.Label>Filtrar por tipo de petición</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={filtroTipo}
                      onChange={(evento) => setFiltroTipo(evento.target.value as 'todos' | TipoPeticionPriv)}
                    >
                      <option value="todos">Todos los tipos</option>
                      {TIPOS_PETICION.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {ETIQUETA_TIPO_PETICION[tipo]}
                        </option>
                      ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Field.Root>
              </Flex>
            </Card.Body>
          </Card.Root>

          {peticiones.length === 0 ? (
            <FeedbackState
              title="No hay peticiones de privacidad registradas"
              description="Los titulares registran peticiones de acceso, rectificación, cancelación, oposición, desactivación o supresión desde su gestión de privacidad."
            />
          ) : filtradas.length === 0 ? (
            <FeedbackState
              title="Ninguna petición coincide con los filtros"
              description="Cambia el estado o el tipo de petición para ver otros registros."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setFiltroEstado('todos')
                    setFiltroTipo('todos')
                  }}
                >
                  Limpiar filtros
                </Button>
              }
            />
          ) : (
            <Table.ScrollArea borderWidth="1px" borderRadius="md">
              <Table.Root size="sm">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Titular</Table.ColumnHeader>
                    <Table.ColumnHeader>Tipo de petición</Table.ColumnHeader>
                    <Table.ColumnHeader>Solicitada</Table.ColumnHeader>
                    <Table.ColumnHeader>Estado</Table.ColumnHeader>
                    <Table.ColumnHeader>Resuelta</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">Acción</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {filtradas.map((peticion) => {
                    const titular = filaTitular(peticion)
                    const puedeResolver =
                      esAdministrador && ESTADOS_RESOLUBLES.includes(peticion.solicitud.estado)
                    return (
                      <Table.Row key={peticion.solicitud.id}>
                        <Table.Cell>
                          <Text fontWeight="600">{titular.nombre}</Text>
                          <Text textStyle="body-sm" color="fg.muted">{titular.correo}</Text>
                        </Table.Cell>
                        <Table.Cell>{ETIQUETA_TIPO_PETICION[peticion.solicitud.tipo]}</Table.Cell>
                        <Table.Cell>{formatearFechaHora(peticion.solicitud.solicitada_en) ?? '—'}</Table.Cell>
                        <Table.Cell>
                          <EstadoPeticionBadge estado={peticion.solicitud.estado} />
                        </Table.Cell>
                        <Table.Cell>{formatearFechaHora(peticion.solicitud.resuelta_en) ?? '—'}</Table.Cell>
                        <Table.Cell textAlign="end">
                          {peticion.solicitud.estado === 'resuelta' ? (
                            <Button size="xs" variant="outline" onClick={() => abrirConsulta(peticion)}>
                              <Eye aria-hidden size={14} />
                              Ver resolución
                            </Button>
                          ) : (
                            <Button size="xs" onClick={() => abrirResolucion(peticion)} disabled={!puedeResolver}>
                              <CheckCheck aria-hidden size={14} />
                              Resolver
                            </Button>
                          )}
                        </Table.Cell>
                      </Table.Row>
                    )
                  })}
                </Table.Body>
              </Table.Root>
            </Table.ScrollArea>
          )}

          <Card.Root>
            <Card.Header>
              <Flex justify="space-between" align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap="3">
                <Box>
                  <Flex align="center" gap="2">
                    <ScrollText aria-hidden size={18} />
                    <Card.Title textStyle="title-sm">Historial trazable de resoluciones</Card.Title>
                  </Flex>
                  <Text textStyle="body-sm" color="fg.muted" mt="1">
                    Cada resolución conserva la respuesta, las medidas aplicadas, el responsable y la fecha.
                  </Text>
                </Box>
                <Button variant="outline" onClick={() => setHistorial((valor) => !valor)}>
                  {historial ? 'Ocultar historial' : `Ver historial (${resueltas.length})`}
                </Button>
              </Flex>
            </Card.Header>
            {historial && (
              <Card.Body>
                {resueltas.length === 0 ? (
                  <Text color="fg.muted">Todavía no hay peticiones resueltas.</Text>
                ) : (
                  <Stack gap="4">
                    {resueltas.map((peticion) => {
                      const titular = filaTitular(peticion)
                      return (
                        <Box key={peticion.solicitud.id} borderWidth="1px" borderRadius="md" p="4">
                          <Flex justify="space-between" align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap="2">
                            <Box>
                              <Text fontWeight="600">{`${ETIQUETA_TIPO_PETICION[peticion.solicitud.tipo]} · ${titular.nombre}`}</Text>
                              <Text textStyle="body-sm" color="fg.muted">{titular.correo}</Text>
                            </Box>
                            <Flex gap="2" align="center" wrap="wrap">
                              <EstadoPeticionBadge estado={peticion.solicitud.estado} />
                              <Badge colorPalette="gray" variant="subtle">
                                {formatearFechaHora(peticion.solicitud.resuelta_en) ?? 'Sin fecha de resolución'}
                              </Badge>
                            </Flex>
                          </Flex>
                          <Stack gap="2" mt="3">
                            <Text textStyle="body-sm">
                              <Text as="span" fontWeight="600">Respuesta: </Text>
                              {peticion.solicitud.respuesta ?? 'Sin respuesta registrada.'}
                            </Text>
                            <Text textStyle="body-sm">
                              <Text as="span" fontWeight="600">Medidas aplicadas: </Text>
                              {peticion.solicitud.medidas_aplicadas ?? 'Sin medidas registradas.'}
                            </Text>
                            <Text textStyle="body-sm" color="fg.muted">
                              {peticion.solicitud.responsable_id
                                ? 'Responsable de la resolución: cuenta administrativa registrada.'
                                : 'Sin responsable registrado.'}
                            </Text>
                          </Stack>
                        </Box>
                      )
                    })}
                  </Stack>
                )}
              </Card.Body>
            )}
          </Card.Root>
        </Stack>
      )}

      <Dialog.Root
        open={peticionEnCurso !== null}
        onOpenChange={(detalles) => { if (!detalles.open) setPeticionEnCurso(null) }}
        size="lg"
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{soloLectura ? 'Resolución registrada' : 'Resolver petición de privacidad'}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              {peticionEnCurso && (
                <Stack gap="5">
                  <Stack gap="1">
                    <Text fontWeight="600">{filaTitular(peticionEnCurso).nombre}</Text>
                    <Text color="fg.muted" textStyle="body-sm">{filaTitular(peticionEnCurso).correo}</Text>
                    <Flex gap="2" wrap="wrap" mt="1">
                      <Badge variant="subtle">{ETIQUETA_TIPO_PETICION[peticionEnCurso.solicitud.tipo]}</Badge>
                      <Badge variant="subtle">
                        {`Solicitada el ${formatearFechaHora(peticionEnCurso.solicitud.solicitada_en) ?? '—'}`}
                      </Badge>
                      <EstadoPeticionBadge estado={peticionEnCurso.solicitud.estado} />
                    </Flex>
                  </Stack>

                  {!soloLectura && (
                    <Alert.Root status="info">
                      <Alert.Indicator>
                        <Lock aria-hidden size={18} />
                      </Alert.Indicator>
                      <Alert.Content>
                        <Alert.Title>Documenta el tratamiento aplicado</Alert.Title>
                        <Alert.Description>
                          Evalúa la política aplicable y describe en «medidas aplicadas» qué se hizo con la información
                          sujeta a conservación. El aviso interno al titular se genera al guardar la resolución; no se
                          envían notificaciones desde esta pantalla.
                        </Alert.Description>
                      </Alert.Content>
                    </Alert.Root>
                  )}

                  <Field.Root invalid={Boolean(errores.estado)}>
                    <Field.Label>Estado de la petición</Field.Label>
                    <NativeSelect.Root disabled={soloLectura}>
                      <NativeSelect.Field
                        value={borrador.estado}
                        onChange={(evento) =>
                          setBorrador((actual) => ({
                            ...actual,
                            estado: evento.target.value as BorradorResolucion['estado'],
                          }))
                        }
                      >
                        <option value="pendiente">{ETIQUETA_ESTADO_PETICION.pendiente}</option>
                        <option value="en_proceso">{ETIQUETA_ESTADO_PETICION.en_proceso}</option>
                        <option value="resuelta">{ETIQUETA_ESTADO_PETICION.resuelta}</option>
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                    {errores.estado && <Field.ErrorText>{errores.estado}</Field.ErrorText>}
                    <Field.HelperText>
                      Marca «Resuelta» cuando la respuesta y las medidas estén registradas. Los estados intermedios
                      permiten dejar constancia del avance.
                    </Field.HelperText>
                  </Field.Root>

                  <Field.Root invalid={Boolean(errores.respuesta)}>
                    <Field.Label>Respuesta al titular</Field.Label>
                    <Textarea
                      value={borrador.respuesta}
                      onChange={(evento) => setBorrador((actual) => ({ ...actual, respuesta: evento.target.value }))}
                      rows={4}
                      maxLength={1500}
                      readOnly={soloLectura}
                      placeholder="Describe la decisión y su fundamento conforme a la política aplicable."
                    />
                    {errores.respuesta && <Field.ErrorText>{errores.respuesta}</Field.ErrorText>}
                  </Field.Root>

                  <Field.Root invalid={Boolean(errores.medidas)}>
                    <Field.Label>Medidas aplicadas</Field.Label>
                    <Textarea
                      value={borrador.medidasAplicadas}
                      onChange={(evento) =>
                        setBorrador((actual) => ({ ...actual, medidasAplicadas: evento.target.value }))
                      }
                      rows={4}
                      maxLength={1500}
                      readOnly={soloLectura}
                      placeholder="Detalla el tratamiento de la información, incluida la sujeta a conservación."
                    />
                    {errores.medidas && <Field.ErrorText>{errores.medidas}</Field.ErrorText>}
                    <Field.HelperText>
                      La resolución no promete supresión inmediata de todo el historial: indica qué se conserva y por
                      qué.
                    </Field.HelperText>
                  </Field.Root>

                  {errorDialogo && (
                    <Field.Root invalid>
                      <Field.ErrorText role="alert">{errorDialogo}</Field.ErrorText>
                    </Field.Root>
                  )}
                </Stack>
              )}
            </Dialog.Body>
            <Dialog.Footer>
              <Flex gap="3" width="full" justify="flex-end">
                <Button variant="outline" onClick={() => setPeticionEnCurso(null)}>
                  {soloLectura ? 'Cerrar' : 'Cancelar'}
                </Button>
                {!soloLectura && (
                  <Button onClick={() => void guardarResolucion()} loading={guardando} disabled={!esAdministrador}>
                    <CheckCheck aria-hidden size={16} />
                    Registrar resolución
                  </Button>
                )}
              </Flex>
            </Dialog.Footer>
            <Dialog.CloseTrigger aria-label="Cerrar la resolución de la petición" />
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Box>
  )
}
