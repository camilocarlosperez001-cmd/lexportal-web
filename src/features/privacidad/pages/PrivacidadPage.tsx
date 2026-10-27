import { useCallback, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Field,
  Flex,
  Heading,
  Link as ChakraLink,
  NativeSelect,
  SimpleGrid,
  Stack,
  Switch,
  Text,
} from '@chakra-ui/react'
import { BookOpenCheck, ExternalLink, Lock, Save, Send, ShieldAlert, SlidersHorizontal } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EstadoPeticionBadge } from '../../../components/shared/EstadoBadge'
import { FeedbackState } from '../../../components/shared/FeedbackState'
import { PageHeader } from '../../../components/shared/PageHeader'
import { toaster } from '../../../components/ui/toaster-store'
import { useConsulta } from '../../../hooks/useConsulta'
import {
  CAMPOS_OPCIONALES,
  campoPublicoAutorizado,
  leerCamposPublicos,
  leerMediosContacto,
  type ClaveCampoOpcional,
} from '../../../utils/contrato'
import { ETIQUETA_TIPO_DOCUMENTO, ETIQUETA_TIPO_PETICION, type TipoPeticionPriv } from '../../../utils/etiquetas'
import { formatearFechaHora } from '../../../utils/fechas'
import { mensajeDeError } from '../../../utils/errores'
import { useSesion } from '../../auth/hooks/useSesion'
import { AceptacionesLegales } from '../components/AceptacionesLegales'
import { registrarAceptaciones } from '../services/legales'
import { useAceptaciones } from '../hooks/useAceptaciones'
import {
  actualizarCamposPublicos,
  actualizarVisibilidad,
  cargarMiPerfil,
  type PerfilAbogado,
} from '../../perfil/services/perfil'
import { crearPeticion, listarPeticionesPropias } from '../services/privacidad'

const TIPOS_PETICION: TipoPeticionPriv[] = [
  'acceso',
  'rectificacion',
  'cancelacion',
  'oposicion',
  'desactivacion',
  'supresion',
]

/** Un campo opcional solo puede publicarse si tiene contenido declarado en el perfil. */
function tieneContenido(perfil: PerfilAbogado, clave: ClaveCampoOpcional): boolean {
  if (clave === 'medios_contacto') return leerMediosContacto(perfil.medios_contacto).length > 0
  if (clave === 'formacion_declarada') return Boolean(perfil.formacion_declarada?.trim())
  if (clave === 'modalidad') return Boolean(perfil.modalidad?.trim())
  if (clave === 'horarios') return Boolean(perfil.horarios?.trim())
  if (clave === 'tarifas_orientativas') return Boolean(perfil.tarifas_orientativas?.trim())
  return Boolean(perfil.foto_publica?.trim())
}

/** Claves que el perfil tiene autorizadas para publicación, leídas defensivamente del jsonb. */
function clavesPublicadas(perfil: PerfilAbogado | null): ClaveCampoOpcional[] {
  if (!perfil) return []
  const autorizados = leerCamposPublicos(perfil.campos_opcionales_publicos)
  return CAMPOS_OPCIONALES.filter((campo) => campoPublicoAutorizado(autorizados, campo.clave)).map(
    (campo) => campo.clave,
  )
}

/**
 * CU 19: aceptaciones legales del titular, publicación de campos opcionales y visibilidad
 * del perfil del abogado, y peticiones de privacidad con su estado y resolución.
 * La supresión no es inmediata ni automática: la administración evalúa la política aplicable
 * y la petición queda trazable con su estado, sus medidas y su respuesta.
 */
export function PrivacidadPage() {
  const { estado, cuenta, error: errorSesion, recargar: recargarSesion } = useSesion()

  const [tipo, setTipo] = useState<TipoPeticionPriv>('acceso')
  const [errorPeticion, setErrorPeticion] = useState<string | null>(null)
  const [creandoPeticion, setCreandoPeticion] = useState(false)

  const peticiones = useConsulta(
    async () => {
      if (!cuenta) return []
      return listarPeticionesPropias(cuenta.id)
    },
    `peticiones-privacidad:${cuenta?.id ?? 'sin-cuenta'}`,
  )

  const perfil = useConsulta(
    async () => {
      if (!cuenta || cuenta.rol !== 'abogado') return null
      return cargarMiPerfil(cuenta.id)
    },
    `perfil-privacidad:${cuenta?.id ?? 'sin-cuenta'}`,
  )

  const registrarPeticion = useCallback(async () => {
    if (!cuenta) return
    setCreandoPeticion(true)
    setErrorPeticion(null)
    try {
      await crearPeticion(cuenta.id, tipo)
      peticiones.recargar()
      toaster.create({
        title: 'Petición registrada',
        description:
          'Queda en estado pendiente y la evalúa la administración. La respuesta y las medidas aplicadas se registran en esta misma vista.',
        type: 'success',
      })
    } catch (fallo: unknown) {
      setErrorPeticion(mensajeDeError(fallo, 'No se pudo registrar la petición.'))
    } finally {
      setCreandoPeticion(false)
    }
  }, [cuenta, peticiones, tipo])

  if (estado === 'cargando') {
    return <FeedbackState kind="loading" title="Cargando tu configuración de privacidad" />
  }

  if (estado === 'error' || !cuenta) {
    return (
      <FeedbackState
        kind="error"
        title="No pudimos comprobar tu sesión"
        description={errorSesion ?? 'Vuelve a intentarlo en unos segundos.'}
        action={<Button onClick={() => void recargarSesion()}>Reintentar</Button>}
      />
    )
  }

  const esAbogado = cuenta.rol === 'abogado'

  return (
    <Stack gap="8">
      <PageHeader
        etiqueta="Privacidad"
        titulo="Privacidad y datos personales"
        descripcion="Consulta tus aceptaciones legales, decide qué información se publica y registra peticiones sobre tus datos."
      />

      <SeccionAceptaciones cuentaId={cuenta.id} />

      {/* El componente se remonta si cambia el perfil: la autorización vigente se lee al montar. */}
      {esAbogado && (
        <ConfiguracionPublicacion
          key={`publicacion-${perfil.datos?.id ?? 'sin-perfil'}`}
          perfil={perfil.datos ?? null}
          cargando={perfil.cargando}
          error={perfil.error}
          alRecargar={perfil.recargar}
          iniciales={clavesPublicadas(perfil.datos ?? null)}
        />
      )}

      <Card.Root>
        <Card.Header>
          <Flex align="center" gap="2">
            <SlidersHorizontal aria-hidden size={20} />
            <Card.Title>Peticiones sobre tus datos</Card.Title>
          </Flex>
        </Card.Header>
        <Card.Body gap="6">
          <Alert.Root status="info">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>La supresión no es inmediata</Alert.Title>
              <Alert.Description>
                Registrar una petición no borra automáticamente todo tu historial. La administración evalúa la
                política aplicable, registra las medidas aplicadas y responde. La petición queda trazable con su
                estado y su fecha.
              </Alert.Description>
            </Alert.Content>
          </Alert.Root>

          <form
            noValidate
            onSubmit={(evento) => {
              evento.preventDefault()
              void registrarPeticion()
            }}
          >
            <Stack gap="4">
              <Field.Root invalid={Boolean(errorPeticion)}>
                <Field.Label>Tipo de petición</Field.Label>
                <NativeSelect.Root disabled={creandoPeticion}>
                  <NativeSelect.Field
                    value={tipo}
                    onChange={(evento) => setTipo(evento.target.value as TipoPeticionPriv)}
                  >
                    {TIPOS_PETICION.map((opcion) => (
                      <option key={opcion} value={opcion}>
                        {ETIQUETA_TIPO_PETICION[opcion]}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
                <Field.HelperText>
                  Elige el derecho que quieres ejercer. La respuesta queda registrada en tu cuenta.
                </Field.HelperText>
                <Field.ErrorText role="alert">{errorPeticion}</Field.ErrorText>
              </Field.Root>

              <Flex justify="flex-end">
                <Button type="submit" loading={creandoPeticion}>
                  <Send aria-hidden size={16} />
                  Registrar petición
                </Button>
              </Flex>
            </Stack>
          </form>

          {peticiones.cargando && <Text color="fg.muted">Cargando tus peticiones…</Text>}

          {!peticiones.cargando && peticiones.error && (
            <Stack gap="3">
              <Text color="fg.error" role="alert">{peticiones.error}</Text>
              <Flex>
                <Button variant="outline" onClick={() => peticiones.recargar()}>Reintentar</Button>
              </Flex>
            </Stack>
          )}

          {!peticiones.cargando && !peticiones.error && (peticiones.datos ?? []).length === 0 && (
            <Text color="fg.muted">No has registrado peticiones de privacidad.</Text>
          )}

          {!peticiones.cargando && !peticiones.error && (peticiones.datos ?? []).length > 0 && (
            <Stack gap="5">
              {(peticiones.datos ?? []).map((peticion) => (
                <Stack key={peticion.id} gap="2" borderLeftWidth="2px" borderColor="border" pl="4">
                  <Flex justify="space-between" align="center" gap="3" wrap="wrap">
                    <Heading as="h3" textStyle="title-sm">
                      {ETIQUETA_TIPO_PETICION[peticion.tipo]}
                    </Heading>
                    <EstadoPeticionBadge estado={peticion.estado} />
                  </Flex>
                  <Text textStyle="body-sm" color="fg.muted">
                    Registrada el {formatearFechaHora(peticion.solicitada_en) ?? 'sin fecha registrada'}
                  </Text>
                  {peticion.resuelta_en && (
                    <Text textStyle="body-sm">
                      Resolución registrada el {formatearFechaHora(peticion.resuelta_en)}
                    </Text>
                  )}
                  {peticion.medidas_aplicadas && (
                    <Text textStyle="body-sm">Medidas aplicadas: {peticion.medidas_aplicadas}</Text>
                  )}
                  {peticion.respuesta && <Text textStyle="body-sm">Respuesta: {peticion.respuesta}</Text>}
                  {peticion.estado === 'pendiente' && !peticion.respuesta && (
                    <Text textStyle="body-sm" color="fg.muted">
                      Pendiente de evaluación administrativa. La resolución se registrará aquí.
                    </Text>
                  )}
                </Stack>
              ))}
            </Stack>
          )}
        </Card.Body>
      </Card.Root>

      <Card.Root>
        <Card.Body gap="2">
          <Text textStyle="title-sm">Alcance de esta gestión</Text>
          <Text color="fg.muted">
            La gestión de privacidad no otorga acceso al contenido de tus conversaciones ni lo elimina por sí sola.
            Para los datos de tu perfil profesional, consulta también «Mi perfil profesional».
          </Text>
          {esAbogado && (
            <ChakraLink asChild color="primary" fontWeight="600" alignSelf="flex-start">
              <Link to="/mi-perfil">Ir a Mi perfil profesional</Link>
            </ChakraLink>
          )}
        </Card.Body>
      </Card.Root>
    </Stack>
  )
}

/** Aceptaciones registradas y registro de las pendientes (CU 01, 02 y 19). */
function SeccionAceptaciones({ cuentaId }: { cuentaId: string }) {
  const aceptaciones = useAceptaciones(cuentaId)
  const [seleccion, setSeleccion] = useState<string[]>(() =>
    aceptaciones.pendientes.map((documento) => documento.id),
  )
  const [errorRegistro, setErrorRegistro] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const registrar = useCallback(async () => {
    setGuardando(true)
    setErrorRegistro(null)
    try {
      await registrarAceptaciones(cuentaId, seleccion)
      aceptaciones.recargar()
      setSeleccion([])
      toaster.create({
        title: 'Aceptaciones registradas',
        description: 'Se conserva la fecha y la versión de cada documento aceptado.',
        type: 'success',
      })
    } catch (fallo: unknown) {
      setErrorRegistro(mensajeDeError(fallo, 'No se pudieron registrar las aceptaciones.'))
    } finally {
      setGuardando(false)
    }
  }, [aceptaciones, cuentaId, seleccion])

  const pendientes = aceptaciones.pendientes
  const etiquetasPorDocumento = new Map(
    aceptaciones.documentos.map((documento) => [documento.id, documento] as const),
  )

  return (
    <>
      <Card.Root>
        <Card.Header>
          <Flex align="center" gap="2">
            <BookOpenCheck aria-hidden size={20} />
            <Card.Title>Aceptaciones registradas</Card.Title>
          </Flex>
        </Card.Header>
        <Card.Body gap="5">
          {aceptaciones.cargando && <Text color="fg.muted">Cargando tus aceptaciones…</Text>}

          {!aceptaciones.cargando && aceptaciones.error && (
            <Stack gap="3">
              <Text color="fg.error" role="alert">{aceptaciones.error}</Text>
              <Flex>
                <Button variant="outline" onClick={() => aceptaciones.recargar()}>Reintentar</Button>
              </Flex>
            </Stack>
          )}

          {!aceptaciones.cargando && !aceptaciones.error && aceptaciones.aceptaciones.length === 0 && (
            <Text color="fg.muted">
              Todavía no hay aceptaciones registradas en tu cuenta. Las aceptaciones que falten aparecen abajo.
            </Text>
          )}

          {!aceptaciones.cargando && !aceptaciones.error && aceptaciones.aceptaciones.length > 0 && (
            <Stack gap="3">
              {aceptaciones.aceptaciones.map((aceptacion) => {
                const documento = etiquetasPorDocumento.get(aceptacion.documento_id)
                return (
                  <Flex key={aceptacion.documento_id} justify="space-between" gap="4" wrap="wrap">
                    <Stack gap="0">
                      <Text textStyle="title-sm">
                        {documento ? ETIQUETA_TIPO_DOCUMENTO[documento.tipo] : 'Documento legal'}
                      </Text>
                      <Text textStyle="body-sm" color="fg.muted">
                        Versión {documento?.version ?? 'sin identificar'} ·{' '}
                        {formatearFechaHora(aceptacion.aceptada_en) ?? 'fecha sin registrar'}
                      </Text>
                    </Stack>
                    {documento && (
                      <ChakraLink
                        href={documento.referencia_contenido}
                        target="_blank"
                        rel="noopener noreferrer"
                        color="primary"
                        fontWeight="600"
                        alignSelf="center"
                      >
                        Consultar
                        <ExternalLink aria-hidden size={14} style={{ display: 'inline', marginLeft: 4 }} />
                      </ChakraLink>
                    )}
                  </Flex>
                )
              })}
            </Stack>
          )}
        </Card.Body>
      </Card.Root>

      {pendientes.length > 0 && (
        <Card.Root borderColor="border.emphasized">
          <Card.Header>
            <Flex align="center" gap="2">
              <ShieldAlert aria-hidden size={20} />
              <Card.Title>Documentos vigentes sin aceptar</Card.Title>
            </Flex>
          </Card.Header>
          <Card.Body gap="5">
            <Alert.Root status="warning">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>
                  Tienes {pendientes.length} documento(s) pendiente(s) de aceptación
                </Alert.Title>
                <Alert.Description>
                  Hay versiones vigentes sin aceptación registrada en tu cuenta. Revísalas y registra tu
                  aceptación para conservar la trazabilidad.
                </Alert.Description>
              </Alert.Content>
            </Alert.Root>

            <AceptacionesLegales
              documentos={pendientes}
              seleccionados={seleccion}
              alCambiar={setSeleccion}
              error={errorRegistro ?? undefined}
              deshabilitado={guardando}
            />

            <Flex justify="flex-end">
              <Button onClick={() => void registrar()} loading={guardando} disabled={seleccion.length === 0}>
                <Save aria-hidden size={16} />
                Registrar aceptaciones
              </Button>
            </Flex>
          </Card.Body>
        </Card.Root>
      )}
    </>
  )
}

/** Campos opcionales publicados y visibilidad del perfil del abogado (CU 08 y 19). */
function ConfiguracionPublicacion({
  perfil,
  cargando,
  error,
  alRecargar,
  iniciales,
}: {
  perfil: PerfilAbogado | null
  cargando: boolean
  error: string | null
  alRecargar: () => void
  iniciales: ClaveCampoOpcional[]
}) {
  // La selección de campos se deriva del contrato y el componente se remonta con `key`
  // cuando cambia el perfil: el estado editable arranca del valor autorizado sin efectos.
  const [claves, setClaves] = useState<ClaveCampoOpcional[]>(iniciales)
  const [visibilidadEditada, setVisibilidadEditada] = useState<PerfilAbogado['visibilidad'] | null>(null)
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)
  const [guardandoCampos, setGuardandoCampos] = useState(false)
  const [guardandoVisibilidad, setGuardandoVisibilidad] = useState(false)

  if (cargando) {
    return <FeedbackState kind="loading" title="Cargando tu configuración de publicación" />
  }

  if (error) {
    return (
      <FeedbackState
        kind="error"
        title="No pudimos cargar tu perfil profesional"
        description={error}
        action={<Button onClick={() => alRecargar()}>Reintentar</Button>}
      />
    )
  }

  if (!perfil) {
    return (
      <FeedbackState
        kind="empty"
        title="Todavía no tienes perfil profesional"
        description="La publicación de campos opcionales y la visibilidad se configuran cuando exista tu perfil."
      />
    )
  }

  const perfilActual = perfil
  const visibilidad = visibilidadEditada ?? perfil.visibilidad

  function alternarClave(clave: ClaveCampoOpcional, marcado: boolean) {
    setClaves((actuales) => (marcado ? [...actuales, clave] : actuales.filter((fila) => fila !== clave)))
  }

  async function guardarCampos() {
    setGuardandoCampos(true)
    setErrorGuardado(null)
    try {
      await actualizarCamposPublicos(perfilActual.id, claves)
      alRecargar()
      toaster.create({
        title: 'Campos publicables guardados',
        description: 'Un campo no autorizado se excluye de la presentación pública de tu perfil.',
        type: 'success',
      })
    } catch (fallo: unknown) {
      setErrorGuardado(mensajeDeError(fallo, 'No se pudieron guardar los campos publicables.'))
    } finally {
      setGuardandoCampos(false)
    }
  }

  async function cambiarVisibilidad(valor: 'publico' | 'oculto') {
    setVisibilidadEditada(valor)
    setGuardandoVisibilidad(true)
    setErrorGuardado(null)
    try {
      await actualizarVisibilidad(perfilActual.id, valor)
      alRecargar()
      toaster.create({
        title: valor === 'publico' ? 'Perfil visible' : 'Perfil oculto',
        description:
          valor === 'publico'
            ? 'Tu perfil se ofrece en el directorio cuando cumple las condiciones de verificación y actividad.'
            : 'Tu perfil deja de ofrecerse en el directorio público.',
        type: 'success',
      })
    } catch (fallo: unknown) {
      setVisibilidadEditada(null)
      setErrorGuardado(mensajeDeError(fallo, 'No se pudo guardar la visibilidad del perfil.'))
    } finally {
      setGuardandoVisibilidad(false)
    }
  }

  return (
    <Card.Root>
      <Card.Header>
        <Flex align="center" gap="2">
          <Lock aria-hidden size={20} />
          <Card.Title>Publicación de mi perfil</Card.Title>
        </Flex>
      </Card.Header>
      <Card.Body gap="6">
        <Alert.Root status="info">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Solo se publica lo que autorizas</Alert.Title>
            <Alert.Description>
              Un campo opcional no autorizado se excluye de la presentación pública, aunque su contenido exista en
              tu perfil. La identificación, la tarjeta profesional y las evidencias nunca se publican.
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>

        <Switch.Root
          checked={visibilidad === 'publico'}
          disabled={guardandoVisibilidad}
          onCheckedChange={(detalles) => void cambiarVisibilidad(detalles.checked === true ? 'publico' : 'oculto')}
        >
          <Switch.HiddenInput />
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <Switch.Label>Ofrecer mi perfil en el directorio</Switch.Label>
        </Switch.Root>

        <Text textStyle="body-sm" color="fg.muted">
          Aunque actives esta opción, tu perfil solo se ofrece en el directorio cuando cuenta con una verificación
          aprobada y está activo.
        </Text>

        <Stack gap="4">
          <Text textStyle="title-sm">Campos opcionales publicados</Text>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
            {CAMPOS_OPCIONALES.map((campo) => (
              <Checkbox.Root
                key={campo.clave}
                checked={claves.includes(campo.clave)}
                onCheckedChange={(detalles) => alternarClave(campo.clave, detalles.checked === true)}
                alignItems="start"
              >
                <Checkbox.HiddenInput />
                <Checkbox.Control mt="0.5" />
                <Checkbox.Label fontWeight="400">
                  <Text as="span" fontWeight="600">{campo.etiqueta}</Text>
                  <Text as="span" display="block" textStyle="body-sm" color="fg.muted">
                    {campo.ayuda}
                  </Text>
                  {!tieneContenido(perfilActual, campo.clave) && (
                    <Text as="span" display="block" textStyle="body-sm" color="fg.warning">
                      Sin contenido declarado: aunque lo autorices, no hay nada que publicar.
                    </Text>
                  )}
                  {tieneContenido(perfilActual, campo.clave) && !claves.includes(campo.clave) && (
                    <Text as="span" display="block" textStyle="body-sm" color="fg.info">
                      Tienes este dato declarado y ahora mismo no se publica: márcalo si quieres mostrarlo en tu perfil
                      público.
                    </Text>
                  )}
                </Checkbox.Label>
              </Checkbox.Root>
            ))}
          </SimpleGrid>

          {errorGuardado && (
            <Field.Root invalid>
              <Field.ErrorText role="alert">{errorGuardado}</Field.ErrorText>
            </Field.Root>
          )}

          <Flex justify="flex-end">
            <Button onClick={() => void guardarCampos()} loading={guardandoCampos}>
              <Save aria-hidden size={16} />
              Guardar campos publicables
            </Button>
          </Flex>
        </Stack>
      </Card.Body>
    </Card.Root>
  )
}
