// CU 03 — Verificación profesional: revisión de una versión presentada.
// La identificación privada y la tarjeta profesional solo se muestran en este ámbito
// administrativo. Las evidencias viven en el bucket privado `evidencias-privadas` y se
// abren mediante un enlace firmado temporal generado bajo demanda.

import { useState } from 'react'
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Dialog,
  Field,
  Flex,
  Grid,
  Input,
  Link as ChakraLink,
  NativeSelect,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
} from '@chakra-ui/react'
import {
  ArrowLeft,
  CalendarClock,
  CircleAlert,
  ClipboardCheck,
  FileSearch,
  FileText,
  FolderOpen,
  IdCard,
  Info,
  Landmark,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Stamp,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { EstadoCuentaBadge, EstadoRevisionBadge, VerificacionBadge, VisibilidadBadge } from '../../../components/shared/EstadoBadge'
import { FeedbackState } from '../../../components/shared/FeedbackState'
import { ListaDatos } from '../../../components/shared/ListaDatos'
import { PageHeader } from '../../../components/shared/PageHeader'
import { toaster } from '../../../components/ui/toaster-store'
import { useConsulta } from '../../../hooks/useConsulta'
import {
  ETIQUETA_ESTADO_REVISION,
  ETIQUETA_TIPO_REVISION,
  etiquetaTipoEvidencia,
  type EstadoRevisionProf,
} from '../../../utils/etiquetas'
import { fechaParaInput, inputAFechaIso } from '../../../utils/fechas'
import { esErrorDePermiso, mensajeDeError } from '../../../utils/errores'
import { validarSeleccion, validarTextoRequerido } from '../../../utils/validaciones'
import {
  cargarVersionParaRevision,
  crearEnlaceEvidencia,
  decidirRevision,
  iniciarRevision,
  reactivarPerfil,
  registrarResultadoConsulta,
  suspenderPerfil,
  ESTADOS_CON_MOTIVO_OBLIGATORIO,
  ESTADOS_DECISION,
  type DecisionRevision,
  type DetalleVersion,
  type RevisionProfesional,
} from '../services/verificacion'
import { SIN_REGISTRO, textoFecha, textoFechaHora } from '../utils'

export function RevisionDetallePage() {
  const { versionId = '' } = useParams<{ versionId: string }>()
  const [intento, setIntento] = useState(0)
  const [mensajeAccion, setMensajeAccion] = useState<string | null>(null)
  const { datos, cargando, error } = useConsulta(
    () => cargarVersionParaRevision(versionId),
    `${versionId}:${intento}`,
  )

  function refrescar() {
    setIntento((valor) => valor + 1)
  }

  if (cargando && !datos) {
    return <FeedbackState kind="loading" title="Cargando la versión presentada" description="Consultamos el perfil, la cuenta profesional y las evidencias privadas." />
  }

  if (error && !datos) {
    return (
      <Stack gap="4">
        <PageHeader titulo="Revisión de credenciales" etiqueta="CU 03 · Verificación inicial" />
        <FeedbackState
          kind="error"
          title="No se pudo cargar la versión presentada"
          description={`${error} La revisión de versiones profesionales, evidencias privadas y cuentas está reservada a la administración: si tu cuenta no tiene ese rol, la consulta será rechazada por las políticas de acceso.`}
          action={<Button onClick={refrescar}>Reintentar</Button>}
        />
        <Box>
          <ChakraLink asChild color="primary" fontWeight="600">
            <Link to="/admin/verificacion">
              <ArrowLeft aria-hidden size={16} style={{ display: 'inline', marginRight: 4 }} />
              Volver a la cola de verificación
            </Link>
          </ChakraLink>
        </Box>
      </Stack>
    )
  }

  if (!datos) return null

  const revisionAbierta = datos.revisiones.find((revision) => revision.decidida_en === null) ?? null
  const consultaRegistrada = Boolean(revisionAbierta?.consultada_en)
  const versionAprobada = datos.version.id === datos.perfil.version_aprobada_id

  return (
    <Stack gap="6">
      <PageHeader
        titulo="Revisión de credenciales profesionales"
        descripcion={`Versión ${datos.version.numero_version} presentada el ${textoFecha(datos.version.presentada_en)}. Registra la consulta oficial antes de decidir y conserva el motivo de cada decisión.`}
        etiqueta="CU 03 · Verificación inicial"
        acciones={
          <Flex gap="2" wrap="wrap">
            <Button variant="outline" onClick={refrescar} disabled={cargando}>
              <RefreshCw aria-hidden size={16} />
              Actualizar
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/admin/verificacion">
                <ArrowLeft aria-hidden size={16} />
                Volver a la cola
              </Link>
            </Button>
          </Flex>
        }
      />

      {cargando && <FeedbackState kind="loading" title="Actualizando la versión" />}

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
        <Stack gap="6">
          <TarjetaVersion detalle={datos} versionAprobada={versionAprobada} />
          <TarjetaEvidencias detalle={datos} />
          <TarjetaPerfil detalle={datos} alActualizar={refrescar} alInformar={setMensajeAccion} />
        </Stack>

        <Stack gap="6">
          <TarjetaInicioRevision
            detalle={datos}
            revisionAbierta={revisionAbierta}
            alActualizar={refrescar}
            alInformar={setMensajeAccion}
          />
          <TarjetaConsulta
            revision={revisionAbierta}
            alActualizar={refrescar}
            alInformar={setMensajeAccion}
          />
          <TarjetaDecision
            revision={revisionAbierta}
            consultaRegistrada={consultaRegistrada}
            alActualizar={refrescar}
            alInformar={setMensajeAccion}
          />
          <TarjetaHistorial revisiones={datos.revisiones} />
        </Stack>
      </SimpleGrid>
    </Stack>
  )
}

type PropiedadesTarjeta = {
  detalle: DetalleVersion
  alActualizar: () => void
  alInformar: (mensaje: string) => void
}

/** Identificación privada y tarjeta profesional: solo en el ámbito administrativo. */
function TarjetaVersion({ detalle, versionAprobada }: { detalle: DetalleVersion; versionAprobada: boolean }) {
  const { version, perfil, cuenta } = detalle

  return (
    <Card.Root>
      <Card.Header gap="3">
        <Flex justify="space-between" align="start" gap="3" wrap="wrap">
          <Stack gap="1">
            <Card.Title>Versión presentada</Card.Title>
            <Text textStyle="body-sm" color="fg.muted">
              Número {version.numero_version} · presentada el {textoFechaHora(version.presentada_en)}
            </Text>
          </Stack>
          <Flex gap="2" wrap="wrap">
            <EstadoRevisionBadge estado={version.estado_revision} />
            {versionAprobada && (
              <Badge colorPalette="green" variant="subtle" size="sm">
                <ShieldCheck aria-hidden size={14} />
                Versión aprobada vigente
              </Badge>
            )}
          </Flex>
        </Flex>
      </Card.Header>
      <Card.Body gap="5">
        <Alert.Root status="warning" role="note">
          <Alert.Indicator>
            <ShieldAlert aria-hidden size={18} />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>Información privada de verificación</Alert.Title>
            <Alert.Description>
              Estos datos no se publican en el directorio. No los copies, no los registres en logs y consúltalos solo
              para esta revisión.
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>

        <ListaDatos
          items={[
            {
              etiqueta: 'Identificación privada',
              valor: (
                <Flex align="center" gap="2">
                  <IdCard aria-hidden size={16} />
                  <Text as="span">{version.identificacion_privada}</Text>
                </Flex>
              ),
            },
            {
              etiqueta: 'Tarjeta profesional',
              valor: (
                <Flex align="center" gap="2">
                  <Stamp aria-hidden size={16} />
                  <Text as="span">{version.tarjeta_profesional}</Text>
                </Flex>
              ),
            },
          ]}
        />

        <Stack gap="2" borderTopWidth="1px" pt="4">
          <Text textStyle="label-caps" color="secondary">Perfil profesional</Text>
          <ListaDatos
            items={[
              { etiqueta: 'Nombre profesional', valor: perfil.nombre_profesional },
              { etiqueta: 'Ciudad de atención', valor: perfil.ciudad_atencion },
              {
                etiqueta: 'Visibilidad',
                valor: <VisibilidadBadge visibilidad={perfil.visibilidad} />,
              },
              { etiqueta: 'Perfil activo', valor: perfil.activo ? 'Sí' : 'No' },
              {
                etiqueta: 'Verificación vigente',
                valor: (
                  <Stack gap="1">
                    <VerificacionBadge fechaVerificacion={perfil.fecha_verificacion_vigente} />
                    <Text textStyle="body-sm" color="fg.muted">
                      {perfil.fecha_verificacion_vigente
                        ? `Registrada el ${textoFecha(perfil.fecha_verificacion_vigente)}`
                        : 'El perfil no tiene una aprobación registrada.'}
                    </Text>
                  </Stack>
                ),
              },
              { etiqueta: 'Alcance registrado', valor: perfil.alcance_verificacion_vigente },
            ]}
          />
        </Stack>

        <Stack gap="2" borderTopWidth="1px" pt="4">
          <Text textStyle="label-caps" color="secondary">Cuenta profesional</Text>
          {cuenta ? (
            <ListaDatos
              items={[
                { etiqueta: 'Titular', valor: cuenta.nombre_completo },
                { etiqueta: 'Correo', valor: cuenta.correo },
                { etiqueta: 'Estado de la cuenta', valor: <EstadoCuentaBadge estado={cuenta.estado} /> },
              ]}
            />
          ) : (
            <Text textStyle="body-sm" color="fg.muted">
              La cuenta asociada al perfil no está disponible para consulta.
            </Text>
          )}
        </Stack>

        <Stack gap="2" borderTopWidth="1px" pt="4">
          <Text textStyle="label-caps" color="secondary">Versión aprobada vigente</Text>
          {detalle.versionAprobada ? (
            <ListaDatos
              items={[
                { etiqueta: 'Número de versión', valor: `Versión ${detalle.versionAprobada.numero_version}` },
                { etiqueta: 'Presentada', valor: textoFecha(detalle.versionAprobada.presentada_en) },
                {
                  etiqueta: 'Fecha de verificación',
                  valor: textoFecha(perfil.fecha_verificacion_vigente),
                },
              ]}
            />
          ) : (
            <Text textStyle="body-sm" color="fg.muted">
              El perfil no conserva una versión aprobada previa. Aprobar esta versión fija la verificación vigente.
            </Text>
          )}
        </Stack>
      </Card.Body>
    </Card.Root>
  )
}

/** Evidencias privadas de la versión: tipo, fecha y enlace firmado temporal. */
function TarjetaEvidencias({ detalle }: { detalle: DetalleVersion }) {
  const [abriendo, setAbriendo] = useState<string | null>(null)
  const [errorEnlace, setErrorEnlace] = useState<string | null>(null)

  async function abrirEvidencia(evidenciaId: string, ruta: string) {
    setAbriendo(evidenciaId)
    setErrorEnlace(null)
    // La ventana se abre en el mismo gesto del usuario para no ser bloqueada; solo se
    // navega cuando el enlace firmado está disponible.
    const ventana = window.open('', '_blank', 'noopener,noreferrer')
    try {
      const enlace = await crearEnlaceEvidencia(ruta)
      if (ventana) ventana.location.href = enlace
      else setErrorEnlace('El navegador bloqueó la ventana. Habilita las ventanas emergentes para abrir la evidencia.')
    } catch (fallo: unknown) {
      if (ventana) ventana.close()
      setErrorEnlace(
        esErrorDePermiso(fallo)
          ? 'No tienes autorización para leer esta evidencia privada.'
          : mensajeDeError(fallo, 'No se pudo generar el enlace temporal de la evidencia.'),
      )
    } finally {
      setAbriendo(null)
    }
  }

  return (
    <Card.Root>
      <Card.Header gap="1">
        <Card.Title>Evidencias privadas</Card.Title>
        <Text textStyle="body-sm" color="fg.muted">
          El enlace de cada evidencia es temporal ({'60'} segundos) y se genera solo cuando lo solicitas. No se comparte
          ni se copia fuera de esta revisión.
        </Text>
      </Card.Header>
      <Card.Body gap="4" p={detalle.evidencias.length > 0 ? '0' : undefined}>
        {detalle.evidencias.length === 0 ? (
          <Text color="fg.muted">
            La versión no tiene evidencias registradas. Si la información aportada no permite completar la consulta
            oficial, registra la situación y decide sin presuponer un resultado favorable.
          </Text>
        ) : (
          <Table.ScrollArea>
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Tipo</Table.ColumnHeader>
                  <Table.ColumnHeader>Aportada</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Acciones</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {detalle.evidencias.map((evidencia) => (
                  <Table.Row key={evidencia.id}>
                    <Table.Cell>
                      <Flex align="center" gap="2">
                        <FileText aria-hidden size={16} />
                        <Text as="span">{etiquetaTipoEvidencia(evidencia.tipo)}</Text>
                      </Flex>
                    </Table.Cell>
                    <Table.Cell>{textoFecha(evidencia.aportada_en)}</Table.Cell>
                    <Table.Cell textAlign="end">
                      <Button
                        size="sm"
                        variant="outline"
                        loading={abriendo === evidencia.id}
                        onClick={() => void abrirEvidencia(evidencia.id, evidencia.ruta_storage_privada)}
                      >
                        <FolderOpen aria-hidden size={16} />
                        Abrir evidencia
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Table.ScrollArea>
        )}

        {errorEnlace && (
          <Box px={detalle.evidencias.length > 0 ? 'space-lg' : undefined} pb={detalle.evidencias.length > 0 ? 'space-lg' : undefined}>
            <Alert.Root status="error" role="alert">
              <Alert.Indicator>
                <CircleAlert aria-hidden size={18} />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>No se pudo abrir la evidencia</Alert.Title>
                <Alert.Description>{errorEnlace}</Alert.Description>
              </Alert.Content>
            </Alert.Root>
          </Box>
        )}
      </Card.Body>
    </Card.Root>
  )
}

/** Estado del perfil y suspensión o reactivación administrativa trazable (CU 18). */
function TarjetaPerfil({ detalle, alActualizar, alInformar }: PropiedadesTarjeta) {
  const { perfil, version } = detalle
  const suspendido = Boolean(perfil.suspendido_en)

  const [motivo, setMotivo] = useState('')
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [confirmarSuspension, setConfirmarSuspension] = useState(false)

  async function confirmarSuspender() {
    const validacion = validarTextoRequerido(motivo, 'el motivo de la suspensión', 600)
    setErrorMotivo(validacion)
    if (validacion) return

    setProcesando(true)
    setErrorAccion(null)
    try {
      await suspenderPerfil(perfil.id, motivo)
      toaster.create({
        title: 'Perfil suspendido',
        description: 'El perfil dejó de mostrarse en el directorio. El motivo y la fecha quedaron registrados.',
        type: 'success',
      })
      setMotivo('')
      setConfirmarSuspension(false)
      alInformar('Suspensión registrada con motivo y fecha. El perfil ya no se muestra públicamente.')
      alActualizar()
    } catch (fallo: unknown) {
      setErrorAccion(
        esErrorDePermiso(fallo)
          ? 'Solo la administración puede suspender un perfil.'
          : mensajeDeError(fallo, 'No se pudo suspender el perfil.'),
      )
    } finally {
      setProcesando(false)
    }
  }

  async function reactivar() {
    setProcesando(true)
    setErrorAccion(null)
    try {
      await reactivarPerfil(perfil.id)
      toaster.create({
        title: 'Perfil reactivado',
        description: 'La suspensión quedó levantada. La publicación efectiva depende de la verificación y de la actividad del perfil.',
        type: 'success',
      })
      alInformar('Perfil reactivado. La publicación depende además de la verificación vigente y de que el perfil esté activo.')
      alActualizar()
    } catch (fallo: unknown) {
      setErrorAccion(
        esErrorDePermiso(fallo)
          ? 'Solo la administración puede reactivar un perfil.'
          : mensajeDeError(fallo, 'No se pudo reactivar el perfil.'),
      )
    } finally {
      setProcesando(false)
    }
  }

  return (
    <Card.Root>
      <Card.Header gap="1">
        <Card.Title>Perfil y visibilidad</Card.Title>
        <Text textStyle="body-sm" color="fg.muted">
          La suspensión es una decisión administrativa trazable: se conserva el motivo y la fecha, y se levanta
          expresamente.
        </Text>
      </Card.Header>
      <Card.Body gap="5">
        <Flex gap="2" wrap="wrap">
          <VisibilidadBadge visibilidad={perfil.visibilidad} />
          <Badge colorPalette={perfil.activo ? 'green' : 'gray'} variant="subtle" size="sm">
            {perfil.activo ? 'Perfil activo' : 'Perfil inactivo'}
          </Badge>
          {suspendido && (
            <Badge colorPalette="red" variant="subtle" size="sm">
              <ShieldOff aria-hidden size={14} />
              Suspensión registrada
            </Badge>
          )}
        </Flex>

        {perfil.visibilidad === 'oculto' && !suspendido && (
          <Alert.Root status="info" role="status">
            <Alert.Indicator>
              <Info aria-hidden size={18} />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>Aprobar no publica el perfil</Alert.Title>
              <Alert.Description>
                La búsqueda pública exige tres condiciones: visibilidad pública, perfil activo y verificación aprobada.
                Este perfil está oculto porque el titular no ha activado la publicación desde su Privacidad; hasta
                entonces no aparecerá en el directorio aunque su verificación quede aprobada.
              </Alert.Description>
            </Alert.Content>
          </Alert.Root>
        )}

        {suspendido ? (
          <Stack gap="4">
            <Alert.Root status="warning" role="status">
              <Alert.Indicator>
                <ShieldOff aria-hidden size={18} />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>Perfil suspendido el {textoFechaHora(perfil.suspendido_en)}</Alert.Title>
                <Alert.Description>{perfil.motivo_suspension ?? SIN_REGISTRO}</Alert.Description>
              </Alert.Content>
            </Alert.Root>
            <Text textStyle="body-sm" color="fg.muted">
              Al reactivar, la publicación depende además de que la versión aprobada siga vigente y de que el perfil esté
              activo.
            </Text>
            <Flex>
              <Button onClick={() => void reactivar()} loading={procesando}>
                <RotateCcw aria-hidden size={16} />
                Reactivar perfil
              </Button>
            </Flex>
          </Stack>
        ) : (
          <Stack gap="4">
            <Text textStyle="body-sm" color="fg.muted">
              Suspende la aparición pública cuando el perfil deje de cumplir los criterios. La versión {version.numero_version}{' '}
              y su historial se conservan.
            </Text>
            <Field.Root invalid={Boolean(errorMotivo)}>
              <Field.Label>Motivo de la suspensión</Field.Label>
              <Textarea
                value={motivo}
                rows={3}
                maxLength={600}
                onChange={(evento) => {
                  setMotivo(evento.target.value)
                  setErrorMotivo(null)
                }}
                placeholder="Describe el incumplimiento detectado y la evidencia en que se basa."
              />
              <Field.ErrorText>{errorMotivo}</Field.ErrorText>
            </Field.Root>
            <Flex>
              <Button colorPalette="red" variant="outline" onClick={() => setConfirmarSuspension(true)} disabled={procesando}>
                <ShieldOff aria-hidden size={16} />
                Suspender perfil
              </Button>
            </Flex>
          </Stack>
        )}

        {errorAccion && (
          <Alert.Root status="error" role="alert">
            <Alert.Indicator>
              <CircleAlert aria-hidden size={18} />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>No se pudo completar la acción</Alert.Title>
              <Alert.Description>{errorAccion}</Alert.Description>
            </Alert.Content>
          </Alert.Root>
        )}
      </Card.Body>

      <Dialog.Root open={confirmarSuspension} onOpenChange={(detalles) => setConfirmarSuspension(detalles.open)} role="alertdialog">
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Confirmar la suspensión del perfil</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap="4">
                <Text>
                  El perfil dejará de mostrarse en el directorio público. Se registran el motivo que escribiste y la
                  fecha de la decisión.
                </Text>
                <ListaDatos items={[{ etiqueta: 'Motivo registrado', valor: motivo.trim() || SIN_REGISTRO }]} />
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Flex gap="3" width="full" justify="flex-end">
                <Button variant="outline" onClick={() => setConfirmarSuspension(false)}>
                  Cancelar
                </Button>
                <Button colorPalette="red" onClick={() => void confirmarSuspender()} loading={procesando}>
                  Suspender perfil
                </Button>
              </Flex>
            </Dialog.Footer>
            <Dialog.CloseTrigger aria-label="Cerrar la confirmación de suspensión" />
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Card.Root>
  )
}

/** Paso 1: abre la revisión administrativa de la versión presentada. */
function TarjetaInicioRevision({
  detalle,
  revisionAbierta,
  alActualizar,
  alInformar,
}: {
  detalle: DetalleVersion
  revisionAbierta: RevisionProfesional | null
  alActualizar: () => void
  alInformar: (mensaje: string) => void
}) {
  const [procesando, setProcesando] = useState(false)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const esVersionAprobada = detalle.version.id === detalle.perfil.version_aprobada_id

  async function iniciar() {
    setProcesando(true)
    setErrorAccion(null)
    try {
      // La RPC deriva el responsable de la sesión y es idempotente: si ya hay una revisión
      // abierta la reutiliza en lugar de duplicarla.
      const revisionId = await iniciarRevision(detalle.version.id)
      toaster.create({
        title: 'Revisión iniciada',
        description: `La versión queda en revisión con la revisión ${revisionId.slice(0, 8)}… registrada para tu cuenta.`,
        type: 'success',
      })
      alInformar('Revisión iniciada. Registra ahora la consulta en la fuente oficial antes de decidir.')
      alActualizar()
    } catch (fallo: unknown) {
      setErrorAccion(
        esErrorDePermiso(fallo)
          ? 'Solo la administración puede iniciar la revisión de una versión profesional.'
          : mensajeDeError(fallo, 'No se pudo iniciar la revisión.'),
      )
    } finally {
      setProcesando(false)
    }
  }

  return (
    <Card.Root>
      <Card.Header gap="1">
        <Flex align="center" gap="2">
          <ClipboardCheck aria-hidden size={18} />
          <Card.Title>Paso 1 · Iniciar la revisión</Card.Title>
        </Flex>
        <Text textStyle="body-sm" color="fg.muted">
          Al iniciar la revisión la versión pasa a «en revisión» y se abre un registro de tipo verificación inicial con
          la responsabilidad de quien revisa.
        </Text>
      </Card.Header>
      <Card.Body gap="4">
        {revisionAbierta ? (
          <Alert.Root status="info" role="status">
            <Alert.Indicator>
              <Info aria-hidden size={18} />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>Revisión abierta</Alert.Title>
              <Alert.Description>
                {revisionAbierta.tipo === 'revalidacion' ? 'Revalidación' : 'Verificación inicial'} iniciada el{' '}
                {textoFechaHora(revisionAbierta.programada_en)}. Continúa con la consulta oficial y la decisión.
              </Alert.Description>
            </Alert.Content>
          </Alert.Root>
        ) : (
          <>
            {esVersionAprobada && (
              <Text textStyle="body-sm" color="fg.muted">
                Esta versión ya es la aprobada vigente del perfil. Puedes abrir una nueva revisión si necesitas registrar
                una decisión posterior sobre ella.
              </Text>
            )}
            <Flex>
              <Button onClick={() => void iniciar()} loading={procesando}>
                <ClipboardCheck aria-hidden size={16} />
                Iniciar revisión
              </Button>
            </Flex>
          </>
        )}

        {errorAccion && (
          <Alert.Root status="error" role="alert">
            <Alert.Indicator>
              <CircleAlert aria-hidden size={18} />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>No se pudo iniciar la revisión</Alert.Title>
              <Alert.Description>{errorAccion}</Alert.Description>
            </Alert.Content>
          </Alert.Root>
        )}
      </Card.Body>
    </Card.Root>
  )
}

/** Paso 2: consulta en la fuente oficial. Es obligatoria antes de decidir. */
function TarjetaConsulta({
  revision,
  alActualizar,
  alInformar,
}: {
  revision: RevisionProfesional | null
  alActualizar: () => void
  alInformar: (mensaje: string) => void
}) {
  const [fuente, setFuente] = useState(revision?.fuente_oficial ?? '')
  const [resultado, setResultado] = useState(revision?.resultado_consulta ?? '')
  const [errores, setErrores] = useState<{ fuente?: string; resultado?: string }>({})
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)

  async function registrar() {
    if (!revision) return
    const errorFuente = validarTextoRequerido(fuente, 'la fuente oficial consultada', 200)
    const errorResultado = validarTextoRequerido(resultado, 'el resultado de la consulta', 1000)
    setErrores({ fuente: errorFuente ?? undefined, resultado: errorResultado ?? undefined })
    if (errorFuente || errorResultado) return

    setProcesando(true)
    setErrorAccion(null)
    try {
      await registrarResultadoConsulta(revision.id, {
        fuenteOficial: fuente.trim(),
        resultadoConsulta: resultado.trim(),
      })
      toaster.create({
        title: 'Consulta registrada',
        description: 'Quedaron guardadas la fuente oficial, el resultado y la fecha de consulta.',
        type: 'success',
      })
      alInformar('Consulta oficial registrada con su fecha. Ya puedes registrar la decisión.')
      alActualizar()
    } catch (fallo: unknown) {
      setErrorAccion(
        esErrorDePermiso(fallo)
          ? 'Solo la administración puede registrar el resultado de la consulta.'
          : mensajeDeError(fallo, 'No se pudo registrar la consulta.'),
      )
    } finally {
      setProcesando(false)
    }
  }

  return (
    <Card.Root>
      <Card.Header gap="1">
        <Flex align="center" gap="2">
          <Landmark aria-hidden size={18} />
          <Card.Title>Paso 2 · Consulta en la fuente oficial</Card.Title>
        </Flex>
        <Text textStyle="body-sm" color="fg.muted">
          Registra la fuente consultada y su resultado con la fecha de consulta. Si la consulta oficial no puede
          completarse, documenta la situación: no se presupone un resultado favorable.
        </Text>
      </Card.Header>
      <Card.Body gap="4">
        {!revision ? (
          <Text color="fg.muted">Inicia la revisión para registrar la consulta oficial.</Text>
        ) : (
          <>
            {revision.consultada_en && (
              <Alert.Root status="success" role="status">
                <Alert.Indicator>
                  <ShieldCheck aria-hidden size={18} />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Consulta registrada</Alert.Title>
                  <Alert.Description>
                    {revision.fuente_oficial ?? SIN_REGISTRO} · {textoFechaHora(revision.consultada_en)}
                  </Alert.Description>
                </Alert.Content>
              </Alert.Root>
            )}

            <Field.Root invalid={Boolean(errores.fuente)}>
              <Field.Label>Fuente oficial consultada</Field.Label>
              <Input
                value={fuente}
                maxLength={200}
                onChange={(evento) => {
                  setFuente(evento.target.value)
                  setErrores((actuales) => ({ ...actuales, fuente: undefined }))
                }}
                placeholder="Entidad o registro oficial consultado"
              />
              <Field.HelperText>Identifica la fuente, no el detalle del documento privado.</Field.HelperText>
              <Field.ErrorText>{errores.fuente}</Field.ErrorText>
            </Field.Root>

            <Field.Root invalid={Boolean(errores.resultado)}>
              <Field.Label>Resultado de la consulta</Field.Label>
              <Textarea
                value={resultado}
                rows={4}
                maxLength={1000}
                onChange={(evento) => {
                  setResultado(evento.target.value)
                  setErrores((actuales) => ({ ...actuales, resultado: undefined }))
                }}
                placeholder="Describe lo que arrojó la consulta y, si no pudo completarse, la situación documentada."
              />
              <Field.ErrorText>{errores.resultado}</Field.ErrorText>
            </Field.Root>

            <Flex>
              <Button onClick={() => void registrar()} loading={procesando}>
                <FileSearch aria-hidden size={16} />
                {revision.consultada_en ? 'Actualizar consulta' : 'Registrar consulta'}
              </Button>
            </Flex>
          </>
        )}

        {errorAccion && (
          <Alert.Root status="error" role="alert">
            <Alert.Indicator>
              <CircleAlert aria-hidden size={18} />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>No se pudo registrar la consulta</Alert.Title>
              <Alert.Description>{errorAccion}</Alert.Description>
            </Alert.Content>
          </Alert.Root>
        )}
      </Card.Body>
    </Card.Root>
  )
}

/** Paso 3: decisión administrativa con estado, motivo, alcance y próxima revisión. */
function TarjetaDecision({
  revision,
  consultaRegistrada,
  alActualizar,
  alInformar,
}: {
  revision: RevisionProfesional | null
  consultaRegistrada: boolean
  alActualizar: () => void
  alInformar: (mensaje: string) => void
}) {
  const [estado, setEstado] = useState<EstadoRevisionProf>(revision?.estado ?? 'aprobada')
  const [decision, setDecision] = useState(revision?.decision ?? '')
  const [motivo, setMotivo] = useState(revision?.motivo ?? '')
  const [alcance, setAlcance] = useState(revision?.alcance ?? '')
  const [proxima, setProxima] = useState(fechaParaInput(revision?.proxima_revision ?? null))
  const [errores, setErrores] = useState<{ estado?: string; decision?: string; motivo?: string }>({})
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)

  const exigeMotivo = ESTADOS_CON_MOTIVO_OBLIGATORIO.includes(estado)
  const puedeDecidir = Boolean(revision) && consultaRegistrada

  async function registrar() {
    if (!revision) return
    const errorEstado = validarSeleccion(estado, 'el estado de la decisión')
    const errorDecision = validarTextoRequerido(decision, 'la decisión registrada', 600)
    const errorMotivo = exigeMotivo ? validarTextoRequerido(motivo, 'el motivo de la decisión', 1000) : null
    setErrores({
      estado: errorEstado ?? undefined,
      decision: errorDecision ?? undefined,
      motivo: errorMotivo ?? undefined,
    })
    if (errorEstado || errorDecision || errorMotivo) return

    const datosDecision: DecisionRevision = {
      estado,
      decision: decision.trim(),
      motivo: motivo.trim() || null,
      alcance: alcance.trim() || null,
      proximaRevision: inputAFechaIso(proxima, true),
    }

    setProcesando(true)
    setErrorAccion(null)
    try {
      await decidirRevision(revision.id, datosDecision)
      // El trigger de revisiones sincroniza la versión y crea el aviso al abogado: la web no
      // los duplica. Al actualizar se refrescan el detalle y la cola.
      toaster.create({
        title: 'Decisión registrada',
        description:
          estado === 'aprobada'
            ? 'La versión quedó aprobada; el sistema fijó la verificación vigente y avisó al abogado.'
            : 'La decisión quedó registrada con su motivo y fecha; el aviso al abogado y la sincronización de la versión se registraron automáticamente.',
        type: 'success',
      })
      alInformar(
        estado === 'aprobada'
          ? 'Decisión de aprobación registrada. El perfil conserva su visibilidad y actividad; la publicación depende de ambas.'
          : `Decisión registrada como «${ETIQUETA_ESTADO_REVISION[estado]}».`,
      )
      alActualizar()
    } catch (fallo: unknown) {
      setErrorAccion(
        esErrorDePermiso(fallo)
          ? 'Solo la administración puede registrar la decisión de una revisión profesional.'
          : mensajeDeError(fallo, 'No se pudo registrar la decisión.'),
      )
    } finally {
      setProcesando(false)
    }
  }

  return (
    <Card.Root>
      <Card.Header gap="1">
        <Flex align="center" gap="2">
          <ShieldCheck aria-hidden size={18} />
          <Card.Title>Paso 3 · Decisión</Card.Title>
        </Flex>
        <Text textStyle="body-sm" color="fg.muted">
          Registra el estado, el motivo y el alcance de la verificación. La aprobación exige cumplir los criterios
          aplicables: no sustituye la comprobación en la fuente oficial.
        </Text>
      </Card.Header>
      <Card.Body gap="4">
        {!revision ? (
          <Text color="fg.muted">Inicia la revisión para registrar la decisión.</Text>
        ) : revision.decidida_en ? (
          <Alert.Root status="success" role="status">
            <Alert.Indicator>
              <ShieldCheck aria-hidden size={18} />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>Revisión decidida el {textoFechaHora(revision.decidida_en)}</Alert.Title>
              <Alert.Description>
                {ETIQUETA_ESTADO_REVISION[revision.estado]}
                {revision.motivo ? ` · ${revision.motivo}` : ''}
              </Alert.Description>
            </Alert.Content>
          </Alert.Root>
        ) : (
          <>
            {!consultaRegistrada && (
              <Alert.Root status="warning" role="alert">
                <Alert.Indicator>
                  <CalendarClock aria-hidden size={18} />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Falta la consulta oficial</Alert.Title>
                  <Alert.Description>
                    Registra la fuente, el resultado y la fecha de consulta antes de decidir. Si la consulta no pudo
                    completarse, documéntalo en el resultado: no se presupone un resultado favorable.
                  </Alert.Description>
                </Alert.Content>
              </Alert.Root>
            )}

            <Field.Root invalid={Boolean(errores.estado)}>
              <Field.Label>Estado de la decisión</Field.Label>
              <NativeSelect.Root>
                <NativeSelect.Field
                  value={estado}
                  onChange={(evento) => setEstado(evento.target.value as EstadoRevisionProf)}
                >
                  {ESTADOS_DECISION.map((opcion) => (
                    <option key={opcion} value={opcion}>
                      {ETIQUETA_ESTADO_REVISION[opcion]}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
              <Field.ErrorText>{errores.estado}</Field.ErrorText>
            </Field.Root>

            {estado === 'aprobada' && (
              <Alert.Root status="warning" role="status">
                <Alert.Indicator>
                  <ShieldAlert aria-hidden size={18} />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Efecto de la aprobación</Alert.Title>
                  <Alert.Description>
                    La aprobación fija esta versión como la verificada vigente del perfil y avisa al abogado. El perfil
                    solo se publica si además está activo y visible. El sistema no actualiza el alcance registrado en el
                    perfil: escribe el alcance verificable en el motivo y en el campo de alcance de esta decisión.
                  </Alert.Description>
                </Alert.Content>
              </Alert.Root>
            )}

            <Field.Root invalid={Boolean(errores.decision)}>
              <Field.Label>Decisión registrada</Field.Label>
              <Textarea
                value={decision}
                rows={3}
                maxLength={600}
                onChange={(evento) => {
                  setDecision(evento.target.value)
                  setErrores((actuales) => ({ ...actuales, decision: undefined }))
                }}
                placeholder="Resume la decisión adoptada con base en la consulta oficial."
              />
              <Field.ErrorText>{errores.decision}</Field.ErrorText>
            </Field.Root>

            <Field.Root invalid={Boolean(errores.motivo)}>
              <Field.Label>{exigeMotivo ? 'Motivo (obligatorio)' : 'Motivo'}</Field.Label>
              <Textarea
                value={motivo}
                rows={3}
                maxLength={1000}
                onChange={(evento) => {
                  setMotivo(evento.target.value)
                  setErrores((actuales) => ({ ...actuales, motivo: undefined }))
                }}
                placeholder={
                  exigeMotivo
                    ? 'Detalla qué información falta o qué criterio no se cumple.'
                    : 'Fundamenta la decisión para dejar la trazabilidad completa.'
                }
              />
              <Field.ErrorText>{errores.motivo}</Field.ErrorText>
            </Field.Root>

            <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap="4">
              <Field.Root>
                <Field.Label>Alcance de la verificación</Field.Label>
                <Input
                  value={alcance}
                  maxLength={300}
                  onChange={(evento) => setAlcance(evento.target.value)}
                  placeholder="Qué se verificó y con qué límites"
                />
                <Field.HelperText>Se conserva en la decisión, no modifica el perfil.</Field.HelperText>
              </Field.Root>

              <Field.Root>
                <Field.Label>Próxima revisión</Field.Label>
                <Input
                  type="date"
                  value={proxima}
                  onChange={(evento) => setProxima(evento.target.value)}
                />
                <Field.HelperText>Opcional. Orienta la revalidación conforme a la política vigente.</Field.HelperText>
              </Field.Root>
            </Grid>

            <Flex>
              <Button onClick={() => void registrar()} loading={procesando} disabled={!puedeDecidir}>
                <ShieldCheck aria-hidden size={16} />
                Registrar decisión
              </Button>
            </Flex>
          </>
        )}

        {errorAccion && (
          <Alert.Root status="error" role="alert">
            <Alert.Indicator>
              <CircleAlert aria-hidden size={18} />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>No se pudo registrar la decisión</Alert.Title>
              <Alert.Description>{errorAccion}</Alert.Description>
            </Alert.Content>
          </Alert.Root>
        )}
      </Card.Body>
    </Card.Root>
  )
}

/** Historial trazable de revisiones de la versión. */
function TarjetaHistorial({ revisiones }: { revisiones: RevisionProfesional[] }) {
  const decisionRegistrada = (estado: string): EstadoRevisionProf | null =>
    ESTADOS_DECISION.includes(estado as EstadoRevisionProf) ? (estado as EstadoRevisionProf) : null

  return (
    <Card.Root>
      <Card.Header gap="1">
        <Card.Title>Historial de revisiones</Card.Title>
        <Text textStyle="body-sm" color="fg.muted">
          Cada revisión conserva su tipo, estado, responsable y decisión.
        </Text>
      </Card.Header>
      <Card.Body>
        {revisiones.length === 0 ? (
          <Text color="fg.muted">Esta versión no tiene revisiones registradas.</Text>
        ) : (
          <Stack gap="4" as="ul" listStyleType="none" p="0">
            {revisiones.map((revision) => {
              const estadoMostrado = decisionRegistrada(revision.estado)
              return (
                <Box as="li" key={revision.id} borderTopWidth="1px" pt="4" _first={{ borderTopWidth: 0, pt: 0 }}>
                  <Stack gap="3">
                    <Flex gap="2" wrap="wrap" align="center">
                      {estadoMostrado ? (
                        <EstadoRevisionBadge estado={estadoMostrado} />
                      ) : (
                        <Badge variant="subtle" size="sm">{revision.estado}</Badge>
                      )}
                      <Badge variant="outline" size="sm">{ETIQUETA_TIPO_REVISION[revision.tipo]}</Badge>
                    </Flex>
                    <ListaDatos
                      items={[
                        { etiqueta: 'Programada', valor: textoFechaHora(revision.programada_en) },
                        { etiqueta: 'Consultada', valor: textoFechaHora(revision.consultada_en) },
                        { etiqueta: 'Fuente oficial', valor: revision.fuente_oficial },
                        { etiqueta: 'Resultado de la consulta', valor: revision.resultado_consulta },
                        { etiqueta: 'Decisión', valor: revision.decision },
                        { etiqueta: 'Motivo', valor: revision.motivo },
                        { etiqueta: 'Alcance', valor: revision.alcance },
                        { etiqueta: 'Decidida', valor: textoFechaHora(revision.decidida_en) },
                        { etiqueta: 'Próxima revisión', valor: textoFechaHora(revision.proxima_revision) },
                      ]}
                    />
                  </Stack>
                </Box>
              )
            })}
          </Stack>
        )}
      </Card.Body>
    </Card.Root>
  )
}
