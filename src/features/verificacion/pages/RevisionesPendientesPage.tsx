// CU 03 — Verificación profesional: cola administrativa de versiones presentadas.
// Solo la administración accede a esta ruta; las políticas RLS de versiones_profesionales,
// evidencias_privadas y revisiones_profesionales aplican el permiso real.

import { Badge, Button, Card, Flex, Link as ChakraLink, Stack, Table, Text } from '@chakra-ui/react'
import { ArrowUpRight, BadgeCheck, ClipboardCheck, Info } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EstadoRevisionBadge, VisibilidadBadge } from '../../../components/shared/EstadoBadge'
import { FeedbackState } from '../../../components/shared/FeedbackState'
import { PageHeader } from '../../../components/shared/PageHeader'
import { useConsulta } from '../../../hooks/useConsulta'
import { ETIQUETA_ESTADO_CUENTA } from '../../../utils/etiquetas'
import { listarVersionesEnRevision, type FilaRevisionPendiente } from '../services/verificacion'
import { SIN_REGISTRO, tieneAprobadaPrevia, textoFecha } from '../utils'

export function RevisionesPendientesPage() {
  const { datos, cargando, error, recargar } = useConsulta(listarVersionesEnRevision, 'versiones-en-revision')

  return (
    <Stack gap="6">
      <PageHeader
        titulo="Verificación de credenciales"
        descripcion="Versiones profesionales presentadas que esperan la revisión administrativa. La identificación, la tarjeta profesional y las evidencias privadas solo se consultan en esta ruta autorizada."
        etiqueta="CU 03 · Verificación inicial"
        acciones={
          <Button variant="outline" onClick={recargar} disabled={cargando}>
            <ClipboardCheck aria-hidden size={16} />
            Actualizar cola
          </Button>
        }
      />

      <Card.Root bg="bg.subtle">
        <Card.Body gap="3">
          <Flex align="center" gap="2">
            <Info aria-hidden size={18} />
            <Text textStyle="title-sm">Alcance de la aprobación</Text>
          </Flex>
          <Text textStyle="body-sm" color="fg.muted">
            La aprobación de una versión no publica el perfil por sí sola: el perfil debe además estar activo, visible y
            conservar una verificación vigente. Una versión aprobada previa permanece publicada mientras se revisan
            modificaciones verificables.
          </Text>
        </Card.Body>
      </Card.Root>

      {cargando && <FeedbackState kind="loading" title="Cargando versiones en revisión" />}

      {!cargando && error && (
        <FeedbackState
          kind="error"
          title="No se pudo cargar la cola de verificación"
          description={error}
          action={<Button onClick={recargar}>Reintentar</Button>}
        />
      )}

      {!cargando && !error && datos && datos.length === 0 && (
        <FeedbackState
          kind="empty"
          title="No hay versiones pendientes de revisión"
          description="Cuando un abogado presente su información profesional aparecerá aquí para consultar sus evidencias y registrar la decisión administrativa."
          action={<Button onClick={recargar}>Volver a consultar</Button>}
        />
      )}

      {!cargando && !error && datos && datos.length > 0 && (
        <Card.Root>
          <Card.Header>
            <Card.Title>
              {datos.length === 1 ? '1 versión en revisión' : `${datos.length} versiones en revisión`}
            </Card.Title>
          </Card.Header>
          <Card.Body p="0">
            <Table.ScrollArea>
              <Table.Root size="md" interactive>
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Profesional</Table.ColumnHeader>
                    <Table.ColumnHeader>Ciudad de atención</Table.ColumnHeader>
                    <Table.ColumnHeader>Presentada</Table.ColumnHeader>
                    <Table.ColumnHeader>Estado de la versión</Table.ColumnHeader>
                    <Table.ColumnHeader>Verificación previa</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">Acciones</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {datos.map((fila) => (
                    <FilaVersion key={fila.version.id} fila={fila} />
                  ))}
                </Table.Body>
              </Table.Root>
            </Table.ScrollArea>
          </Card.Body>
        </Card.Root>
      )}
    </Stack>
  )
}

function FilaVersion({ fila }: { fila: FilaRevisionPendiente }) {
  const aprobadaPrevia = tieneAprobadaPrevia(fila.perfil, fila.version.id)

  return (
    <Table.Row>
      <Table.Cell>
        <Stack gap="1">
          <Text textStyle="title-sm">{fila.perfil.nombre_profesional}</Text>
          <Text textStyle="body-sm" color="fg.muted">
            {fila.cuenta ? `${fila.cuenta.nombre_completo} · ${fila.cuenta.correo}` : SIN_REGISTRO}
          </Text>
          {fila.cuenta && fila.cuenta.estado !== 'activa' && (
            <Text textStyle="body-sm" color="fg.error">
              {ETIQUETA_ESTADO_CUENTA[fila.cuenta.estado]}
            </Text>
          )}
        </Stack>
      </Table.Cell>
      <Table.Cell>{fila.perfil.ciudad_atencion}</Table.Cell>
      <Table.Cell>
        <Stack gap="1">
          <Text>{textoFecha(fila.version.presentada_en)}</Text>
          <Text textStyle="body-sm" color="fg.muted">Versión {fila.version.numero_version}</Text>
        </Stack>
      </Table.Cell>
      <Table.Cell>
        <Stack gap="2" align="start">
          <EstadoRevisionBadge estado={fila.version.estado_revision} />
          <VisibilidadBadge visibilidad={fila.perfil.visibilidad} />
        </Stack>
      </Table.Cell>
      <Table.Cell>
        <Stack gap="2" align="start">
          {aprobadaPrevia ? (
            <>
              <Badge colorPalette="green" variant="subtle" size="sm">
                <BadgeCheck aria-hidden size={14} />
                Versión aprobada previa
              </Badge>
              <Text textStyle="body-sm" color="fg.muted">
                Verificada el {textoFecha(fila.perfil.fecha_verificacion_vigente)}
              </Text>
            </>
          ) : (
            <Text textStyle="body-sm" color="fg.muted">Sin versión aprobada previa</Text>
          )}
          {!fila.perfil.activo && <Text textStyle="body-sm" color="fg.error">Perfil marcado como inactivo</Text>}
        </Stack>
      </Table.Cell>
      <Table.Cell textAlign="end">
        <ChakraLink asChild color="primary" fontWeight="600">
          <Link to={`/admin/verificacion/${fila.version.id}`}>
            Revisar
            <ArrowUpRight aria-hidden size={16} style={{ display: 'inline', marginLeft: 4 }} />
          </Link>
        </ChakraLink>
      </Table.Cell>
    </Table.Row>
  )
}
