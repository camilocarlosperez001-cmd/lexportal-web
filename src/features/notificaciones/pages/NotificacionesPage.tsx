// CU 15 — Avisos internos y preferencia de correo.
// Los avisos los generan los triggers de la base de datos; el cliente solo los consulta,
// los marca como leídos en su propia bandeja y configura si desea avisos por correo.

import { useState } from 'react'
import { Badge, Button, Card, Field, Flex, Separator, Stack, Switch, Text } from '@chakra-ui/react'
import { Bell, Mail } from 'lucide-react'
import { Link as RouterLink } from 'react-router-dom'
import { FeedbackState } from '../../../components/shared/FeedbackState'
import { PageHeader } from '../../../components/shared/PageHeader'
import { toaster } from '../../../components/ui/toaster-store'
import { useConsulta } from '../../../hooks/useConsulta'
import { mensajeDeError } from '../../../utils/errores'
import {
  DESCRIPCION_EVENTO,
  ETIQUETA_ESTADO_ENVIO,
  ETIQUETA_EVENTO,
  type EstadoEnvioCorreo,
  type RolCuenta,
} from '../../../utils/etiquetas'
import { formatearFechaHora } from '../../../utils/fechas'
import { useSesion } from '../../auth/hooks/useSesion'
import {
  LIMITE_AVISOS,
  actualizarAvisosCorreo,
  avisosConEnlace,
  conversacionesDeAvisos,
  listarNotificaciones,
  marcarComoLeida,
  marcarTodasComoLeidas,
  recursoDelAviso,
  type Notificacion,
} from '../services/notificaciones'

/** Identificadores de los mensajes citados por los avisos de mensaje nuevo. */
function mensajesDeAvisos(notificaciones: Notificacion[]): string[] {
  const ids = new Set<string>()
  for (const notificacion of notificaciones) {
    const aviso = recursoDelAviso(notificacion)
    if (aviso.evento === 'nuevo_mensaje' && aviso.recurso_id) ids.add(aviso.recurso_id)
  }
  return [...ids]
}

/** Etiqueta de la preferencia según el estado del último aviso por correo. */
function etiquetaEstadoCorreo(estado: EstadoEnvioCorreo | null): string {
  if (!estado) return 'Todavía no se ha registrado un aviso por correo.'
  if (estado === 'pendiente') return `Último aviso por correo: ${ETIQUETA_ESTADO_ENVIO.pendiente}.`
  if (estado === 'enviado') return `Último aviso por correo: ${ETIQUETA_ESTADO_ENVIO.enviado}.`
  if (estado === 'fallido') {
    return `Último aviso por correo: ${ETIQUETA_ESTADO_ENVIO.fallido}. El aviso interno se conserva igualmente.`
  }
  return 'El último aviso no requirió correo.'
}

export function NotificacionesPage() {
  const { estado, cuenta } = useSesion()
  const cuentaId = cuenta?.id ?? null
  const rol: RolCuenta = cuenta?.rol ?? 'ciudadano'

  const consulta = useConsulta(
    () => (cuentaId ? listarNotificaciones(cuentaId) : Promise.resolve([])),
    `notificaciones:${cuentaId ?? 'sin-cuenta'}`,
  )
  const notificaciones = consulta.datos ?? []

  const conversaciones = useConsulta(
    async () => {
      if (!cuentaId) return new Set<string>()
      return conversacionesDeAvisos(cuentaId, mensajesDeAvisos(notificaciones))
    },
    `conversaciones-avisos:${notificaciones.map((notificacion) => notificacion.id).join(',')}`,
  )

  const [marcando, setMarcando] = useState<string | null>(null)
  const [marcandoTodas, setMarcandoTodas] = useState(false)
  const [guardandoPreferencia, setGuardandoPreferencia] = useState(false)

  const avisos = avisosConEnlace(notificaciones, rol, conversaciones.datos ?? new Set<string>())
  const sinLeer = notificaciones.filter((notificacion) => notificacion.leida_en === null)
  const ultimoEstadoCorreo = notificaciones[0]?.estado_aviso_correo ?? null

  async function marcarUna(notificacionId: string) {
    if (marcando) return
    setMarcando(notificacionId)
    try {
      await marcarComoLeida(notificacionId)
      consulta.recargar()
    } catch (fallo: unknown) {
      toaster.create({
        title: 'No se pudo marcar el aviso como leído',
        description: mensajeDeError(fallo),
        type: 'error',
      })
    } finally {
      setMarcando(null)
    }
  }

  async function marcarTodas() {
    if (!cuentaId || marcandoTodas || sinLeer.length === 0) return
    setMarcandoTodas(true)
    try {
      await marcarTodasComoLeidas(cuentaId)
      toaster.create({
        title: 'Avisos marcados como leídos',
        description: `Se actualizaron ${sinLeer.length} ${sinLeer.length === 1 ? 'aviso' : 'avisos'}.`,
        type: 'success',
      })
      consulta.recargar()
    } catch (fallo: unknown) {
      toaster.create({
        title: 'No se pudieron marcar los avisos como leídos',
        description: mensajeDeError(fallo),
        type: 'error',
      })
    } finally {
      setMarcandoTodas(false)
    }
  }

  async function cambiarPreferencia(avisosCorreo: boolean) {
    if (!cuentaId) return
    setGuardandoPreferencia(true)
    try {
      await actualizarAvisosCorreo(cuentaId, avisosCorreo)
      toaster.create({
        title: avisosCorreo ? 'Avisos por correo activados' : 'Avisos por correo desactivados',
        description: 'La preferencia quedó guardada en tu cuenta. Los avisos internos se registran siempre.',
        type: 'success',
      })
    } catch (fallo: unknown) {
      toaster.create({
        title: 'No se pudo guardar la preferencia',
        description: mensajeDeError(fallo),
        type: 'error',
      })
    } finally {
      setGuardandoPreferencia(false)
    }
  }

  return (
    <Stack gap="6">
      <PageHeader
        titulo="Notificaciones"
        etiqueta="Avisos internos"
        descripcion="Avisos generados por la actividad de tu cuenta: solicitudes, decisiones, mensajes y resultados de revisión."
        acciones={
          <Button
            variant="outline"
            onClick={() => void marcarTodas()}
            loading={marcandoTodas}
            disabled={sinLeer.length === 0}
          >
            <Bell aria-hidden size={16} />
            Marcar todas como leídas
          </Button>
        }
      />

      <Card.Root>
        <Card.Body gap="3">
          <Text textStyle="title-sm">Avisos por correo</Text>
          <Switch.Root
            key={cuentaId ?? 'sin-cuenta'}
            checked={cuenta?.avisos_correo ?? true}
            disabled={guardandoPreferencia || !cuentaId}
            onCheckedChange={(detalles) => {
              if (detalles.checked === true || detalles.checked === false) void cambiarPreferencia(detalles.checked)
            }}
          >
            <Switch.HiddenInput aria-label="Recibir avisos por correo" />
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Switch.Label>Recibir avisos por correo</Switch.Label>
          </Switch.Root>
          <Field.Root>
            <Field.HelperText>
              Los avisos por correo son genéricos: no incluyen el relato del caso, las evidencias ni el contenido de
              los mensajes. El aviso interno se conserva aunque el envío del correo falle.
            </Field.HelperText>
          </Field.Root>
          <Flex gap="2" align="center" color="fg.muted">
            <Mail aria-hidden size={16} />
            <Text textStyle="body-sm">{etiquetaEstadoCorreo(ultimoEstadoCorreo)}</Text>
          </Flex>
        </Card.Body>
      </Card.Root>

      <Separator />

      {estado === 'error' && (
        <FeedbackState
          kind="error"
          title="No pudimos comprobar tu sesión"
          description="Vuelve a intentarlo en unos segundos para consultar tus avisos."
        />
      )}

      {estado !== 'error' && consulta.cargando && <FeedbackState kind="loading" title="Cargando tus avisos" />}

      {estado !== 'error' && !consulta.cargando && consulta.error && (
        <FeedbackState
          kind="error"
          title="No se pudieron cargar tus avisos"
          description={consulta.error}
          action={
            <Button variant="outline" onClick={consulta.recargar}>
              Reintentar
            </Button>
          }
        />
      )}

      {estado !== 'error' && !consulta.cargando && !consulta.error && notificaciones.length === 0 && (
        <FeedbackState
          title="No tienes avisos por ahora"
          description="Los avisos los genera el sistema al registrar una solicitud, una decisión, un mensaje o el resultado de una revisión. No se crean manualmente."
        />
      )}

      {estado !== 'error' && !consulta.cargando && !consulta.error && notificaciones.length > 0 && (
        <Stack gap="4">
          {avisos.map((aviso) => {
            const notificacion = notificaciones.find((fila) => fila.id === aviso.id)
            if (!notificacion) return null
            const leida = notificacion.leida_en !== null
            const fecha = formatearFechaHora(notificacion.creada_en)
            return (
              <Card.Root key={notificacion.id}>
                <Card.Body gap="3">
                  <Flex justify="space-between" align="start" gap="3" wrap="wrap">
                    <Stack gap="1">
                      <Text textStyle="title-sm">{ETIQUETA_EVENTO[notificacion.evento]}</Text>
                      <Text textStyle="body-sm" color="fg.muted">
                        {DESCRIPCION_EVENTO[notificacion.evento]}
                      </Text>
                    </Stack>
                    <Stack gap="2" align="end">
                      <Badge colorPalette={leida ? 'gray' : 'blue'} variant="subtle" size="sm">
                        {leida ? 'Leída' : 'No leída'}
                      </Badge>
                      {fecha && (
                        <Text textStyle="body-sm" color="fg.muted">
                          {fecha}
                        </Text>
                      )}
                    </Stack>
                  </Flex>

                  {aviso.exigeParticipacion && (
                    <Text textStyle="body-sm" color="fg.muted">
                      El acceso al contenido del chat exige ser participante de la solicitud aceptada.
                    </Text>
                  )}

                  <Flex gap="3" wrap="wrap" align="center">
                    {aviso.url && (
                      <Button asChild size="sm" variant="outline">
                        <RouterLink to={aviso.url}>Abrir el recurso</RouterLink>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={leida}
                      loading={marcando === notificacion.id}
                      onClick={() => void marcarUna(notificacion.id)}
                    >
                      Marcar como leída
                    </Button>
                  </Flex>
                </Card.Body>
              </Card.Root>
            )
          })}

          {notificaciones.length >= LIMITE_AVISOS && (
            <Text textStyle="body-sm" color="fg.muted">
              Se muestran los {LIMITE_AVISOS} avisos más recientes.
            </Text>
          )}
        </Stack>
      )}
    </Stack>
  )
}
