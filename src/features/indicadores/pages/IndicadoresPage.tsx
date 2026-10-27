import { useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Field,
  Flex,
  Heading,
  Input,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'
import { CalendarRange, Database, Info } from 'lucide-react'
import { FeedbackState } from '../../../components/shared/FeedbackState'
import { PageHeader } from '../../../components/shared/PageHeader'
import { useConsulta } from '../../../hooks/useConsulta'
import { esErrorDePermiso } from '../../../utils/errores'
import { ETIQUETA_ESTADO_CUENTA, ETIQUETA_ESTADO_SOLICITUD, ETIQUETA_ROL, ETIQUETA_VISIBILIDAD } from '../../../utils/etiquetas'
import { fechaParaInput, formatearFechaHora, formatearPeriodo, inicioDeMes, inputAFechaIso } from '../../../utils/fechas'
import {
  listarIndicadores,
  totalDelPeriodo,
  type Indicadores,
  type IndicadoresPeriodo,
} from '../services/indicadores'

type RangoAplicado = { desde: string; hasta: string; clave: string }

/** Periodo inicial: desde el primer día del mes en curso hasta hoy. */
function rangoInicial(): RangoAplicado {
  const desde = inputAFechaIso(inicioDeMes(), false)
  const hasta = inputAFechaIso(fechaParaInput(), true)
  if (!desde || !hasta) {
    const ahora = new Date().toISOString()
    return { desde: ahora, hasta: ahora, clave: `${ahora}|${ahora}` }
  }
  return { desde, hasta, clave: `${desde}|${hasta}` }
}

/** Valida que el texto del input sea una fecha real en formato YYYY-MM-DD. */
function fechaDeInput(valor: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null
  const [anio, mes, dia] = valor.split('-').map(Number)
  const fecha = new Date(anio, mes - 1, dia)
  if (
    Number.isNaN(fecha.getTime()) ||
    fecha.getFullYear() !== anio ||
    fecha.getMonth() !== mes - 1 ||
    fecha.getDate() !== dia
  ) {
    return null
  }
  return valor
}

function TarjetaTotal({ etiqueta, valor, nota }: { etiqueta: string; valor: number; nota?: string }) {
  return (
    <Card.Root>
      <Card.Body>
        <Text textStyle="label-caps" color="fg.muted">
          {etiqueta}
        </Text>
        <Heading as="p" textStyle="headline-md" color="primary">
          {valor}
        </Heading>
        {nota && (
          <Text textStyle="body-sm" color="fg.muted">
            {nota}
          </Text>
        )}
      </Card.Body>
    </Card.Root>
  )
}

function BloqueTotales({
  titulo,
  descripcion,
  items,
  sinDatos,
  etiquetaSinDatos,
}: {
  titulo: string
  descripcion: string
  items: { etiqueta: string; valor: number }[]
  sinDatos: boolean
  etiquetaSinDatos: string
}) {
  if (sinDatos) {
    return (
      <Card.Root>
        <Card.Header>
          <Card.Title textStyle="title-sm">{titulo}</Card.Title>
          <Text textStyle="body-sm" color="fg.muted" mt="1">
            {descripcion}
          </Text>
        </Card.Header>
        <Card.Body>
          <FeedbackState title={etiquetaSinDatos} description="No es un error de conexión: la consulta se completó y no devolvió registros." />
        </Card.Body>
      </Card.Root>
    )
  }
  return (
    <Stack gap="3">
      <Box>
        <Heading as="h2" textStyle="title-sm">
          {titulo}
        </Heading>
        <Text textStyle="body-sm" color="fg.muted">
          {descripcion}
        </Text>
      </Box>
      <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap="4">
        {items.map((item) => (
          <TarjetaTotal key={item.etiqueta} etiqueta={item.etiqueta} valor={item.valor} />
        ))}
      </SimpleGrid>
    </Stack>
  )
}

/**
 * CU 14 — Consulta de indicadores administrativos.
 *
 * Reporte agregado del periodo seleccionado: cuentas por rol y estado, solicitudes de contacto
 * por estado (incluidas las no clasificadas) y la foto actual de perfiles profesionales. Todos
 * los valores son conteos reales; no se muestran series, porcentajes ni comparativas que el
 * contrato no permita calcular.
 */
export function IndicadoresPage() {
  const [desdeTexto, setDesdeTexto] = useState(() => inicioDeMes())
  const [hastaTexto, setHastaTexto] = useState(() => fechaParaInput())
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null)
  const [rango, setRango] = useState<RangoAplicado>(rangoInicial)

  const consulta = useConsulta<Indicadores>(
    () => listarIndicadores(rango.desde, rango.hasta),
    rango.clave,
  )

  const resumen = useMemo(() => {
    if (!consulta.datos) return null
    const { delPeriodo, perfiles } = consulta.datos
    return {
      totalPeriodo: totalDelPeriodo(delPeriodo),
      totalCuentas: Object.values(delPeriodo.cuentasPorRol).reduce((total, valor) => total + valor, 0),
      totalSolicitudes: Object.values(delPeriodo.solicitudesPorEstado).reduce((total, valor) => total + valor, 0),
      totalPerfiles:
        perfiles.porVisibilidad.publico +
        perfiles.porVisibilidad.oculto,
    }
  }, [consulta.datos])

  function consultar() {
    const desde = fechaDeInput(desdeTexto)
    const hasta = fechaDeInput(hastaTexto)
    if (!desde || !hasta) {
      setErrorValidacion('Ingresa una fecha de inicio y una fecha de fin válidas para consultar el periodo.')
      return
    }
    if (desde > hasta) {
      setErrorValidacion('La fecha de inicio no puede ser posterior a la fecha de fin.')
      return
    }
    const desdeIso = inputAFechaIso(desde, false)
    const hastaIso = inputAFechaIso(hasta, true)
    if (!desdeIso || !hastaIso) {
      setErrorValidacion('No pudimos interpretar el periodo seleccionado. Vuelve a elegir las fechas.')
      return
    }
    setErrorValidacion(null)
    setRango({ desde: desdeIso, hasta: hastaIso, clave: `${desdeIso}|${hastaIso}` })
  }

  const errorDePermiso = consulta.error !== null && esErrorDePermiso(consulta.error)
  const periodoAplicado: IndicadoresPeriodo | null = consulta.datos?.delPeriodo ?? null

  return (
    <Box>
      <PageHeader
        titulo="Indicadores administrativos"
        descripcion="Reporte agregado del periodo seleccionado: cuentas por rol y estado, solicitudes de contacto por estado y foto actual de perfiles profesionales."
        etiqueta="CU 14 · Consulta de indicadores"
      />

      <Card.Root mb="6">
        <Card.Body>
          <Stack gap="4">
            <Flex align="center" gap="2">
              <CalendarRange aria-hidden size={18} />
              <Heading as="h2" textStyle="title-sm">
                Periodo de consulta
              </Heading>
            </Flex>
            <Flex gap="4" direction={{ base: 'column', sm: 'row' }} align={{ base: 'stretch', sm: 'end' }}>
              <Field.Root invalid={Boolean(errorValidacion)}>
                <Field.Label>Fecha de inicio</Field.Label>
                <Input
                  type="date"
                  value={desdeTexto}
                  max={hastaTexto}
                  onChange={(evento) => setDesdeTexto(evento.target.value)}
                />
              </Field.Root>
              <Field.Root invalid={Boolean(errorValidacion)}>
                <Field.Label>Fecha de fin</Field.Label>
                <Input
                  type="date"
                  value={hastaTexto}
                  min={desdeTexto}
                  onChange={(evento) => setHastaTexto(evento.target.value)}
                />
              </Field.Root>
              <Button onClick={consultar} loading={consulta.cargando} alignSelf={{ base: 'stretch', sm: 'flex-end' }}>
                Consultar periodo
              </Button>
            </Flex>
            {errorValidacion && (
              <Field.Root invalid>
                <Field.ErrorText role="alert">{errorValidacion}</Field.ErrorText>
              </Field.Root>
            )}
            <Text textStyle="body-sm" color="fg.muted">
              El reporte es agregado: no incluye relatos de casos, contenido de conversaciones ni datos
              identificables de los titulares.
            </Text>
          </Stack>
        </Card.Body>
      </Card.Root>

      {consulta.cargando && !consulta.datos && (
        <FeedbackState kind="loading" title="Consultando los indicadores del periodo" />
      )}

      {consulta.error !== null && (
        <FeedbackState
          kind="error"
          title={errorDePermiso ? 'No tienes permiso para consultar indicadores' : 'No se pudieron obtener los indicadores'}
          description={
            errorDePermiso
              ? 'La consulta agregada requiere una cuenta con rol administrativo. Los contadores no se muestran en cero para no confundir un error de permiso con un periodo sin registros.'
              : `${consulta.error} Los contadores no se muestran en cero: un error de red no equivale a un periodo sin registros.`
          }
          action={
            <Button variant="outline" onClick={consulta.recargar}>
              Reintentar
            </Button>
          }
        />
      )}

      {consulta.datos && consulta.error === null && periodoAplicado && (
        <Stack gap="6">
          <Alert.Root status="info">
            <Alert.Indicator>
              <Info aria-hidden size={18} />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>{`Periodo aplicado: ${formatearPeriodo(periodoAplicado.periodo.desde, periodoAplicado.periodo.hasta)}`}</Alert.Title>
              <Alert.Description>
                Los totales de cuentas y de solicitudes se filtran por la fecha de alta de la cuenta
                (<Text as="span" fontFamily="mono">creada_en</Text>) y por la fecha de envío de la solicitud
                (<Text as="span" fontFamily="mono">enviada_en</Text>). La foto de perfiles no se filtra por periodo.
              </Alert.Description>
            </Alert.Content>
          </Alert.Root>

          {resumen && resumen.totalPeriodo === 0 && (
            <FeedbackState
              title="Sin registros en el periodo"
              description="La consulta se completó correctamente y no hay cuentas creadas ni solicitudes enviadas entre las fechas seleccionadas. Prueba con un periodo más amplio."
            />
          )}

          <BloqueTotales
            titulo="Cuentas creadas en el periodo, por rol"
            descripcion="Cuentas registradas dentro del periodo seleccionado."
            items={[
              { etiqueta: ETIQUETA_ROL.ciudadano, valor: periodoAplicado.cuentasPorRol.ciudadano },
              { etiqueta: ETIQUETA_ROL.abogado, valor: periodoAplicado.cuentasPorRol.abogado },
              { etiqueta: ETIQUETA_ROL.administrador, valor: periodoAplicado.cuentasPorRol.administrador },
            ]}
            sinDatos={resumen !== null && resumen.totalCuentas === 0}
            etiquetaSinDatos="Sin cuentas creadas en el periodo"
          />

          <BloqueTotales
            titulo="Cuentas creadas en el periodo, por estado"
            descripcion="Estado actual de las cuentas registradas dentro del periodo."
            items={[
              { etiqueta: ETIQUETA_ESTADO_CUENTA.activa, valor: periodoAplicado.cuentasPorEstado.activa },
              { etiqueta: ETIQUETA_ESTADO_CUENTA.suspendida, valor: periodoAplicado.cuentasPorEstado.suspendida },
              { etiqueta: ETIQUETA_ESTADO_CUENTA.inactiva, valor: periodoAplicado.cuentasPorEstado.inactiva },
            ]}
            sinDatos={resumen !== null && resumen.totalCuentas === 0}
            etiquetaSinDatos="Sin cuentas creadas en el periodo"
          />

          <BloqueTotales
            titulo="Solicitudes de contacto enviadas en el periodo"
            descripcion="Solicitudes enviadas dentro del periodo, según su estado vigente."
            items={[
              { etiqueta: ETIQUETA_ESTADO_SOLICITUD.pendiente, valor: periodoAplicado.solicitudesPorEstado.pendiente },
              { etiqueta: ETIQUETA_ESTADO_SOLICITUD.aceptada, valor: periodoAplicado.solicitudesPorEstado.aceptada },
              { etiqueta: ETIQUETA_ESTADO_SOLICITUD.rechazada, valor: periodoAplicado.solicitudesPorEstado.rechazada },
              { etiqueta: ETIQUETA_ESTADO_SOLICITUD.cancelada, valor: periodoAplicado.solicitudesPorEstado.cancelada },
              {
                etiqueta: 'Sin clasificar',
                valor: periodoAplicado.solicitudesSinClasificar,
              },
            ]}
            sinDatos={resumen !== null && resumen.totalSolicitudes === 0}
            etiquetaSinDatos="Sin solicitudes enviadas en el periodo"
          />

          <Box>
            <Flex align="center" gap="2" mb="1">
              <Database aria-hidden size={18} />
              <Heading as="h2" textStyle="title-sm">
                Perfiles profesionales (foto actual)
              </Heading>
            </Flex>
            <Alert.Root status="warning" mb="4">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Foto actual; el esquema no registra la fecha de alta del perfil</Alert.Title>
                <Alert.Description>
                  La tabla <Text as="span" fontFamily="mono">perfiles_abogados</Text> no tiene una columna de fecha de
                  alta, así que estos totales no pueden filtrarse por periodo: corresponden a todos los perfiles
                  existentes en el momento de la consulta
                  {consulta.datos.consultadoEn ? ` (${formatearFechaHora(consulta.datos.consultadoEn) ?? ''})` : ''}.
                  No equivalen a las cuentas creadas en el periodo.
                </Alert.Description>
              </Alert.Content>
            </Alert.Root>

            {resumen !== null && resumen.totalPerfiles === 0 ? (
              <FeedbackState
                title="Sin perfiles profesionales registrados"
                description="La consulta se completó y todavía no existe ningún perfil profesional en el sistema."
              />
            ) : (
              <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap="4">
                <TarjetaTotal
                  etiqueta={ETIQUETA_VISIBILIDAD.publico}
                  valor={consulta.datos.perfiles.porVisibilidad.publico}
                  nota="Perfiles con visibilidad pública declarada."
                />
                <TarjetaTotal
                  etiqueta={ETIQUETA_VISIBILIDAD.oculto}
                  valor={consulta.datos.perfiles.porVisibilidad.oculto}
                  nota="Perfiles que no se muestran en el directorio."
                />
                <TarjetaTotal
                  etiqueta="Perfiles activos"
                  valor={consulta.datos.perfiles.activos}
                  nota="Marcados como activos por su titular."
                />
                <TarjetaTotal
                  etiqueta="Perfiles inactivos"
                  valor={consulta.datos.perfiles.inactivos}
                  nota="Marcados como inactivos: no se ofrecen al público."
                />
                <TarjetaTotal
                  etiqueta="Con verificación aprobada"
                  valor={consulta.datos.perfiles.conVerificacionAprobada}
                  nota="Con una versión profesional aprobada vigente."
                />
                <TarjetaTotal
                  etiqueta="Sin verificación aprobada"
                  valor={consulta.datos.perfiles.sinVerificacionAprobada}
                  nota="Pendientes de decisión administrativa o rechazados."
                />
              </SimpleGrid>
            )}
          </Box>

          <Alert.Root status="info">
            <Alert.Indicator>
              <Info aria-hidden size={18} />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>Alcance del reporte</Alert.Title>
              <Alert.Description>
                Los valores provienen de conteos exactos sobre las tablas base. No se calculan porcentajes de éxito,
                comparativas entre periodos ni series temporales que el contrato actual no permita verificar, y no se
                expone ninguna clasificación individual de contactos.
              </Alert.Description>
            </Alert.Content>
          </Alert.Root>

          <Badge colorPalette="gray" variant="subtle" alignSelf="flex-start">
            {`Consultado el ${formatearFechaHora(consulta.datos.consultadoEn) ?? ''}`}
          </Badge>
        </Stack>
      )}
    </Box>
  )
}
