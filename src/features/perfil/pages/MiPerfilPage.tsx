import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Field,
  Fieldset,
  FileUpload,
  Flex,
  Heading,
  Input,
  Link as ChakraLink,
  NativeSelect,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from '@chakra-ui/react'
import {
  BadgeCheck,
  FileCheck2,
  History,
  Info,
  Save,
  ScrollText,
  Send,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { EstadoRevisionBadge, VerificacionBadge, VisibilidadBadge } from '../../../components/shared/EstadoBadge'
import { FeedbackState } from '../../../components/shared/FeedbackState'
import { ListaDatos } from '../../../components/shared/ListaDatos'
import { PageHeader } from '../../../components/shared/PageHeader'
import { toaster } from '../../../components/ui/toaster-store'
import { useConsulta } from '../../../hooks/useConsulta'
import { ETIQUETA_TIPO_REVISION, etiquetaTipoEvidencia } from '../../../utils/etiquetas'
import { formatearFechaHora } from '../../../utils/fechas'
import { mensajeDeError } from '../../../utils/errores'
import { AvatarProfesional } from '../../../components/shared/AvatarProfesional'
import {
  LIMITES_REGISTRO,
  MODALIDADES_ATENCION,
  validarArchivoEvidencia,
  validarIdentificacion,
  validarPractica,
} from '../../../utils/validaciones'
import { useSesion } from '../../auth/hooks/useSesion'
import {
  listarAreas,
  listarRelacionesAreaTipoCaso,
  listarTiposCaso,
  type AreaJuridica,
  type RelacionAreaTipoCaso,
  type TipoCaso,
} from '../../catalogo/services/catalogo'
import { completarAltaProfesional, type MediosContactoAlta } from '../services/altaProfesional'
import { adjuntarEvidenciaProfesional, type TipoEvidenciaProfesional } from '../services/almacenamiento'
import { AdjuntarEvidencias } from '../components/AdjuntarEvidencias'
import { SelectorEspecialidades } from '../components/SelectorEspecialidades'
import { catalogoDeEspecialidades, descomponerEspecialidades, especialidadesDesdeConjuntos, type Especialidad } from '../utils'
import { AceptacionesLegales } from '../../privacidad/components/AceptacionesLegales'
import { useDocumentosLegales } from '../../privacidad/hooks/useDocumentosLegales'
import {
  actualizarAreasYTipos,
  actualizarDatosOrdinarios,
  actualizarFotoPublica,
  cargarAreasDePerfil,
  cargarEvidenciasDeVersiones,
  cargarMiPerfil,
  cargarRevisionesDeVersiones,
  cargarTiposCasoDePerfil,
  cargarVersionesProfesionales,
  prepararVersionProfesional,
  recuperarPerfilProfesional,
  type EvidenciaPrivada,
  type PerfilAbogado,
  type RevisionProfesional,
  type VersionProfesional,
} from '../services/perfil'

/** Marca visual de campo obligatorio; el atributo `required` lo aporta cada control. */
function Obligatorio() {
  return (
    <Text as="span" color="fg.error" aria-hidden>
      {' '}
      *
    </Text>
  )
}

/** Leyenda común de los formularios: qué significa el asterisco. */
function NotaCamposObligatorios() {
  return (
    <Text textStyle="body-sm" color="fg.muted">
      Los campos con <Obligatorio /> son obligatorios.
    </Text>
  )
}

type OpcionesCatalogo = {
  areas: AreaJuridica[]
  tipos: TipoCaso[]
  relaciones: RelacionAreaTipoCaso[]
}

const MEDIOS_VACIOS: MediosContactoAlta = { correo: '', telefono: '', whatsapp: '', sitio_web: '', direccion: '' }

/** Clave del error de `validarPractica` para cada medio de contacto. */
function claveErrorMedio(clave: keyof MediosContactoAlta): string {
  return clave === 'sitio_web' ? 'sitioWeb' : clave
}

/** Límite de formulario de cada medio de contacto, alineado con `validarPractica`. */
function maximoMedio(clave: keyof MediosContactoAlta): number {
  if (clave === 'sitio_web') return LIMITES_REGISTRO.sitioWeb
  if (clave === 'direccion') return LIMITES_REGISTRO.ciudad
  return clave === 'correo' ? LIMITES_REGISTRO.correo : LIMITES_REGISTRO.telefonoFormatoMax
}

/**
 * CU 02 y CU 12: información profesional del abogado autenticado.
 * - Datos ordinarios: se editan y se guardan sin revisión administrativa.
 * - Datos verificables: se presentan como una versión nueva, privada y pendiente de revisión.
 * - La versión aprobada vigente y la visibilidad no se alteran desde aquí, y ninguna evidencia
 *   se muestra como pública ni se convierte en enlace público.
 * - Si la cuenta profesional todavía no tiene perfil (alta interrumpida por la confirmación
 *   de correo), el alta se completa aquí con la sesión ya confirmada, nunca creando otra cuenta.
 */
export function MiPerfilPage() {
  const { estado, cuenta, error: errorSesion, recargar: recargarSesion } = useSesion()
  // Una sola recuperación automática por carga y cuenta; el botón de reintento la habilita
  // de nuevo, de modo que nunca hay un bucle de llamadas al servidor.
  const recuperacionHecha = useRef<{ cuentaId: string; hecha: boolean }>({ cuentaId: '', hecha: false })
  // Cuenta vigente en el último render: descarta respuestas de una sesión anterior.
  const cuentaActual = useRef<string | null>(cuenta?.id ?? null)
  const [recuperacion, setRecuperacion] = useState<
    { estado: 'ninguna' } | { estado: 'formulario' } | { estado: 'error'; mensaje: string }
  >({ estado: 'ninguna' })

  useEffect(() => {
    cuentaActual.current = cuenta?.id ?? null
  }, [cuenta?.id])

  const consulta = useConsulta(
    async () => {
      if (!cuenta) return null
      const perfil = await cargarMiPerfil(cuenta.id)
      if (perfil || cuenta.rol !== 'abogado') return perfil

      if (recuperacionHecha.current.cuentaId !== cuenta.id) {
        recuperacionHecha.current = { cuentaId: cuenta.id, hecha: false }
      }
      if (recuperacionHecha.current.hecha) return perfil
      recuperacionHecha.current.hecha = true

      try {
        const resultado = await recuperarPerfilProfesional()
        // La respuesta solo se aplica si la sesión sigue siendo la que inició la carga.
        const sesionVigente = cuentaActual.current === cuenta.id
        if (resultado.tipo === 'requiere-formulario') {
          // Dato faltante, no un fallo: el formulario reúne perfil y consentimiento.
          if (sesionVigente) setRecuperacion({ estado: 'formulario' })
          return perfil
        }
        // UUID: el perfil existe; se relee el perfil privado y sus relaciones. Si esta
        // lectura falla, el error se muestra y NO se vuelve a intentar la recuperación.
        if (sesionVigente) setRecuperacion({ estado: 'ninguna' })
        return await cargarMiPerfil(cuenta.id)
      } catch (fallo: unknown) {
        if (cuentaActual.current === cuenta.id) {
          setRecuperacion({
            estado: 'error',
            mensaje: mensajeDeError(fallo, 'No se pudo recuperar el perfil profesional.'),
          })
        }
        return perfil
      }
    },
    `mi-perfil:${cuenta?.id ?? 'sin-cuenta'}`,
  )

  const catalogo = useConsulta(async () => {
    const [areas, tipos, relaciones] = await Promise.all([
      listarAreas({ soloActivas: true }),
      listarTiposCaso({ soloActivos: true }),
      listarRelacionesAreaTipoCaso(),
    ])
    return { areas, tipos, relaciones }
  }, 'catalogo-perfil-activo')

  const perfil = consulta.datos ?? null

  const historial = useConsulta(
    async () => {
      if (!perfil) return null
      const versiones = await cargarVersionesProfesionales(perfil.id)
      const versionIds = versiones.map((version) => version.id)
      const [revisiones, evidencias, areaIds, tipoCasoIds] = await Promise.all([
        cargarRevisionesDeVersiones(versionIds),
        cargarEvidenciasDeVersiones(versionIds),
        cargarAreasDePerfil(perfil.id),
        cargarTiposCasoDePerfil(perfil.id),
      ])
      return { versiones, revisiones, evidencias, areaIds, tipoCasoIds }
    },
    `historial-perfil:${perfil?.id ?? 'sin-perfil'}`,
  )

  const recargar = useCallback(async () => {
    // El reintento del usuario habilita una nueva recuperación (una por intento).
    recuperacionHecha.current.hecha = false
    consulta.recargar()
    historial.recargar()
    await recargarSesion()
  }, [consulta, historial, recargarSesion])

  const revisionesPorVersion = useMemo(() => {
    const mapa = new Map<string, RevisionProfesional[]>()
    for (const revision of historial.datos?.revisiones ?? []) {
      const lista = mapa.get(revision.version_id) ?? []
      lista.push(revision)
      mapa.set(revision.version_id, lista)
    }
    return mapa
  }, [historial.datos])

  const evidenciasPorVersion = useMemo(() => {
    const mapa = new Map<string, EvidenciaPrivada[]>()
    for (const evidencia of historial.datos?.evidencias ?? []) {
      const lista = mapa.get(evidencia.version_id) ?? []
      lista.push(evidencia)
      mapa.set(evidencia.version_id, lista)
    }
    return mapa
  }, [historial.datos])

  if (estado === 'cargando') {
    return <FeedbackState kind="loading" title="Cargando tu perfil profesional" />
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

  if (cuenta.rol !== 'abogado') {
    return (
      <FeedbackState
        kind="empty"
        title="Esta vista corresponde a las cuentas profesionales"
        description="El perfil profesional, sus áreas declaradas y la verificación se gestionan con una cuenta de abogado."
      />
    )
  }

  if (consulta.cargando) {
    return <FeedbackState kind="loading" title="Cargando tu perfil profesional" />
  }

  if (consulta.error) {
    return (
      <FeedbackState
        kind="error"
        title="No pudimos cargar tu perfil"
        description={consulta.error}
        action={<Button onClick={() => consulta.recargar()}>Reintentar</Button>}
      />
    )
  }

  if (!perfil) {
    if (cuenta.rol !== 'abogado') {
      return (
        <Stack gap="6">
          <PageHeader
            etiqueta="Mi perfil profesional"
            titulo="Tu cuenta no es profesional"
            descripcion="Solo las cuentas de abogado tienen perfil en el directorio. La conversión de rol no se hace desde la aplicación."
          />
          <FeedbackState
            kind="empty"
            title="No hay un perfil profesional asociado"
            description="Si eres abogado y crees que se trata de un error, contacta con la administración de la plataforma."
            action={
              <Button asChild variant="outline">
                <Link to="/">Volver al panel</Link>
              </Button>
            }
          />
        </Stack>
      )
    }

    if (recuperacion.estado === 'error') {
      return (
        <Stack gap="6">
          <PageHeader
            etiqueta="Mi perfil profesional"
            titulo="No se pudo recuperar tu perfil"
            descripcion="La cuenta existe, pero el perfil profesional no pudo reconstruirse en este intento."
          />
          <FeedbackState
            kind="error"
            title="La recuperación no se completó"
            description={recuperacion.mensaje}
            action={
              <Flex gap="3" wrap="wrap">
                <Button onClick={() => void recargar()}>Reintentar</Button>
                <Button asChild variant="ghost">
                  <Link to="/">Volver al panel</Link>
                </Button>
              </Flex>
            }
          />
        </Stack>
      )
    }

    return (
      <Stack gap="6">
        <PageHeader
          etiqueta="Mi perfil profesional"
          titulo="Recupera tu perfil profesional"
          descripcion="Tu cuenta existe, pero todavía no tiene perfil profesional registrado. Revisa los datos, acepta los documentos vigentes y preséntalos a revisión administrativa."
        />
        <Alert.Root status="info">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Sin perfil no apareces en el directorio</Alert.Title>
            <Alert.Description>
              {recuperacion.estado === 'formulario'
                ? 'No se pudo reconstruir automáticamente: faltan datos válidos del registro o el consentimiento de los documentos vigentes. Completa el formulario para continuar.'
                : 'La inscripción queda pendiente de revisión. Mientras no exista una verificación aprobada, tu perfil permanece oculto.'}
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
        <FormularioAltaProfesional
          key={cuenta.id}
          cuentaId={cuenta.id}
          modo="recuperacion"
          catalogo={catalogo.datos}
          cargandoCatalogo={catalogo.cargando}
          errorCatalogo={catalogo.error}
          alCompletar={recargar}
        />
      </Stack>
    )
  }

  const suspendido = Boolean(perfil.suspendido_en || perfil.motivo_suspension)
  const versiones = historial.datos?.versiones ?? []

  return (
    <Stack gap="8">
      <PageHeader
        etiqueta="Mi perfil profesional"
        titulo={perfil.nombre_profesional}
        descripcion="Gestiona los datos ordinarios de tu práctica, tus declaraciones del catálogo y la información verificable que presentas a revisión."
      />

      <Card.Root>
        <Card.Header>
          <Flex align="center" gap="2">
            <BadgeCheck aria-hidden size={20} />
            <Card.Title>Estado del perfil</Card.Title>
          </Flex>
        </Card.Header>
        <Card.Body gap="5">
          <Flex gap="3" wrap="wrap">
            <VisibilidadBadge visibilidad={perfil.visibilidad} />
            <VerificacionBadge fechaVerificacion={perfil.fecha_verificacion_vigente} />
          </Flex>

          <ListaDatos
            items={[
              {
                etiqueta: 'Verificación vigente desde',
                valor: formatearFechaHora(perfil.fecha_verificacion_vigente),
              },
              { etiqueta: 'Alcance de la verificación', valor: perfil.alcance_verificacion_vigente },
              { etiqueta: 'Motivo de suspensión', valor: perfil.motivo_suspension },
              { etiqueta: 'Perfil suspendido el', valor: formatearFechaHora(perfil.suspendido_en) },
            ]}
          />

          {perfil.version_aprobada_id === null && (
            <Text color="fg.muted">
              Aún no hay una versión aprobada. La visibilidad pública y el alcance de la verificación los registra
              la administración al decidir sobre la versión presentada.
            </Text>
          )}

          {suspendido && (
            <Alert.Root status="warning">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Tu perfil dejó de mostrarse en el directorio</Alert.Title>
                <Alert.Description>
                  La suspensión se registra con su motivo y su fecha. Presenta la información actualizada para una
                  nueva revisión.
                </Alert.Description>
              </Alert.Content>
            </Alert.Root>
          )}
        </Card.Body>
      </Card.Root>

      <FormularioDatosOrdinarios
        key={`datos-${perfil.id}-${perfil.nombre_profesional}-${perfil.descripcion}-${perfil.experiencia_anios}-${perfil.ciudad_atencion}`}
        perfil={perfil}
        cuentaId={cuenta.id}
        catalogo={catalogo.datos}
        cargandoCatalogo={catalogo.cargando}
        errorCatalogo={catalogo.error}
        areaIdsIniciales={historial.datos?.areaIds ?? []}
        tipoCasoIdsIniciales={historial.datos?.tipoCasoIds ?? []}
        alGuardar={recargar}
      />

      <Card.Root>
        <Card.Header>
          <Flex align="center" gap="2">
            <ShieldCheck aria-hidden size={20} />
            <Card.Title>Información verificable</Card.Title>
          </Flex>
        </Card.Header>
        <Card.Body gap="5">
          <Alert.Root status="info">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Material privado, no público</Alert.Title>
              <Alert.Description>
                La identificación, la tarjeta profesional y las evidencias se conservan en un almacén privado. No se
                publican ni se convierten en enlaces públicos: solo la revisión administrativa las consulta.
              </Alert.Description>
            </Alert.Content>
          </Alert.Root>

          <Text color="fg.muted">
            Presentar una versión nueva no sustituye la aprobada: mientras la revisión está pendiente, la versión
            aprobada vigente y la visibilidad permanecen intactas.
          </Text>

          <FormularioNuevaVersion
          key={versiones[0]?.id ?? 'sin-version'}
          perfilId={perfil.id}
          cuentaId={cuenta.id}
          ultimaVersion={versiones[0] ?? null}
          alPresentar={recargar}
        />
        </Card.Body>
      </Card.Root>

      <Card.Root>
        <Card.Header>
          <Flex align="center" gap="2">
            <History aria-hidden size={20} />
            <Card.Title>Historial de versiones y revisiones</Card.Title>
          </Flex>
        </Card.Header>
        <Card.Body>
          {historial.cargando && <Text color="fg.muted">Cargando el historial…</Text>}

          {!historial.cargando && historial.error && (
            <Stack gap="3">
              <Text color="fg.error" role="alert">{historial.error}</Text>
              <Flex>
                <Button variant="outline" onClick={() => historial.recargar()}>Reintentar</Button>
              </Flex>
            </Stack>
          )}

          {!historial.cargando && !historial.error && versiones.length === 0 && (
            <Text color="fg.muted">Todavía no has presentado ninguna versión de información verificable.</Text>
          )}

          {!historial.cargando && !historial.error && versiones.length > 0 && (
            <Stack gap="6">
              {versiones.map((version) => {
                const revisiones = revisionesPorVersion.get(version.id) ?? []
                const esAprobadaVigente = perfil.version_aprobada_id === version.id
                const evidenciasVersion = evidenciasPorVersion.get(version.id) ?? []
                // La consulta llega por fecha descendente: el primer soporte de cada tipo es
                // el más reciente y el resto se conserva como histórico.
                const soportesMasRecientes = new Set<string>()
                const tiposVistos = new Set<string>()
                for (const evidencia of [...evidenciasVersion].sort(
                  (a, b) => new Date(b.aportada_en).getTime() - new Date(a.aportada_en).getTime(),
                )) {
                  if (tiposVistos.has(evidencia.tipo)) continue
                  tiposVistos.add(evidencia.tipo)
                  soportesMasRecientes.add(evidencia.id)
                }
                // registrar_evidencia_profesional solo admite versiones pendientes.
                const puedeAdjuntar = version.estado_revision === 'pendiente'
                return (
                  <Stack key={version.id} gap="3">
                    <Flex justify="space-between" align="center" gap="3" wrap="wrap">
                      <Flex align="center" gap="2" wrap="wrap">
                        <Heading as="h3" textStyle="title-sm">
                          Versión {version.numero_version}
                        </Heading>
                        <EstadoRevisionBadge estado={version.estado_revision} />
                        {esAprobadaVigente && (
                          <Text as="span" textStyle="label-sm" color="fg.success">
                            Versión aprobada vigente
                          </Text>
                        )}
                      </Flex>
                      <Text textStyle="body-sm" color="fg.muted">
                        Presentada el {formatearFechaHora(version.presentada_en) ?? 'sin fecha registrada'}
                      </Text>
                    </Flex>

                    <ListaDatos
                      orientacion="horizontal"
                      items={[
                        { etiqueta: 'Identificación privada', valor: version.identificacion_privada },
                        { etiqueta: 'Tarjeta profesional', valor: version.tarjeta_profesional },
                      ]}
                    />

                    {evidenciasVersion.length > 0 && (
                      <Stack gap="1">
                        <Text textStyle="label-sm" color="fg.muted">
                          Soportes registrados ({evidenciasVersion.length})
                        </Text>
                        {evidenciasVersion.map((evidencia) => {
                          const esMasReciente = soportesMasRecientes.has(evidencia.id)
                          return (
                            <Text key={evidencia.id} textStyle="body-sm">
                              {etiquetaTipoEvidencia(evidencia.tipo)} ·{' '}
                              {formatearFechaHora(evidencia.aportada_en) ?? 'sin fecha registrada'} ·{' '}
                              <Text as="span" fontWeight="600" color={esMasReciente ? 'fg.success' : 'fg.muted'}>
                                {esMasReciente ? 'Más reciente' : 'Anterior, conservado en historial'}
                              </Text>
                            </Text>
                          )
                        })}
                      </Stack>
                    )}

                    {puedeAdjuntar && (
                      <AdjuntarEvidencias
                        versionId={version.id}
                        numeroVersion={version.numero_version}
                        cuentaId={cuenta.id}
                        evidencias={evidenciasVersion}
                        alTerminar={() => historial.recargar()}
                      />
                    )}

                    {revisiones.length === 0 ? (
                      <Text textStyle="body-sm" color="fg.muted">
                        Sin decisiones registradas todavía. La revisión se realiza con la fuente oficial definida.
                      </Text>
                    ) : (
                      <Stack gap="3">
                        {revisiones.map((revision) => (
                          <Stack key={revision.id} gap="1" borderLeftWidth="2px" borderColor="border" pl="4">
                            <Text textStyle="title-sm">{ETIQUETA_TIPO_REVISION[revision.tipo]}</Text>
                            <Text textStyle="body-sm" color="fg.muted">
                              {revision.decidida_en
                                ? `Decidida el ${formatearFechaHora(revision.decidida_en)}`
                                : 'Decisión pendiente de registro'}
                            </Text>
                            {revision.decision && <Text textStyle="body-sm">Decisión: {revision.decision}</Text>}
                            {revision.motivo && <Text textStyle="body-sm">Motivo: {revision.motivo}</Text>}
                            {revision.alcance && <Text textStyle="body-sm">Alcance: {revision.alcance}</Text>}
                          </Stack>
                        ))}
                      </Stack>
                    )}
                  </Stack>
                )
              })}
            </Stack>
          )}
        </Card.Body>
      </Card.Root>

      <Card.Root>
        <Card.Body gap="3">
          <Flex align="center" gap="2">
            <Info aria-hidden size={18} />
            <Text textStyle="title-sm">Publicación de datos</Text>
          </Flex>
          <Text color="fg.muted">
            Qué campos opcionales se publican y si el perfil aparece en el directorio se configura en privacidad.
            Un campo no autorizado se excluye de la presentación pública.
          </Text>
          <ChakraLink asChild color="primary" fontWeight="600" alignSelf="flex-start">
            <Link to="/privacidad">Configurar la publicación de mis datos</Link>
          </ChakraLink>
        </Card.Body>
      </Card.Root>
    </Stack>
  )
}

/** Campos opcionales de contacto declarados en el perfil; se muestran en su pestaña de privacidad. */
function mediosDesdeJson(valor: PerfilAbogado['medios_contacto']): MediosContactoAlta {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return { ...MEDIOS_VACIOS }
  const resultado: MediosContactoAlta = { ...MEDIOS_VACIOS }
  const claves: (keyof MediosContactoAlta)[] = ['correo', 'telefono', 'whatsapp', 'sitio_web', 'direccion']
  for (const clave of claves) {
    const contenido = valor[clave]
    if (typeof contenido === 'string') resultado[clave] = contenido
  }
  return resultado
}

/** Datos ordinarios del perfil, áreas declaradas y tipos de caso atendidos (CU 06, 07 y 12). */
function FormularioDatosOrdinarios({
  perfil,
  cuentaId,
  catalogo,
  cargandoCatalogo,
  errorCatalogo,
  areaIdsIniciales,
  tipoCasoIdsIniciales,
  alGuardar,
}: {
  perfil: PerfilAbogado
  cuentaId: string
  catalogo: OpcionesCatalogo | null
  cargandoCatalogo: boolean
  errorCatalogo: string | null
  areaIdsIniciales: string[]
  tipoCasoIdsIniciales: string[]
  alGuardar: () => Promise<void>
}) {
  const [nombreProfesional, setNombreProfesional] = useState(perfil.nombre_profesional)
  const [descripcion, setDescripcion] = useState(perfil.descripcion)
  const [experiencia, setExperiencia] = useState(String(perfil.experiencia_anios))
  const [ciudad, setCiudad] = useState(perfil.ciudad_atencion)
  const [formacion, setFormacion] = useState(perfil.formacion_declarada ?? '')
  const [modalidad, setModalidad] = useState(perfil.modalidad ?? '')
  const [horarios, setHorarios] = useState(perfil.horarios ?? '')
  const [tarifas, setTarifas] = useState(perfil.tarifas_orientativas ?? '')
  const [medios, setMedios] = useState<MediosContactoAlta>(() => mediosDesdeJson(perfil.medios_contacto))

  // Las declaraciones vigentes llegan del contrato; el componente se remonta con `key`
  // cuando el perfil cambia, así que el estado inicial siempre refleja lo guardado.
  // La lista de especialidades se deriva de las declaraciones guardadas hasta que el
  // usuario la edita; así el catálogo puede llegar después sin perder relaciones.
  const [cambiosEspecialidades, setCambiosEspecialidades] = useState<Especialidad[] | null>(null)
  const especialidades =
    cambiosEspecialidades ??
    especialidadesDesdeConjuntos(catalogoDeEspecialidades(catalogo), areaIdsIniciales, tipoCasoIdsIniciales)
  const declaraciones = descomponerEspecialidades(especialidades)

  const [errores, setErrores] = useState<Record<string, string | undefined>>({})
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  function validar(): boolean {
    const problemas: Record<string, string | undefined> = {
      ...validarPractica({
        nombreProfesional,
        ciudadAtencion: ciudad,
        experienciaAnios: experiencia,
        descripcion,
        formacionDeclarada: formacion,
        horarios,
        tarifasOrientativas: tarifas,
        modalidad,
        mediosContacto: medios,
      }),
    }
    if (declaraciones.areaIds.length === 0 || declaraciones.tipoCasoIds.length === 0) {
      problemas.especialidades = 'Añade al menos una especialidad: área jurídica y tipo de caso.'
    }
    setErrores(problemas)
    return Object.values(problemas).every((problema) => !problema)
  }

  async function guardar() {
    if (!validar()) return

    setGuardando(true)
    setErrorGuardado(null)
    try {
      await actualizarDatosOrdinarios(perfil.id, {
        nombreProfesional,
        descripcion,
        experienciaAnios: Number(experiencia.trim()),
        ciudadAtencion: ciudad,
        formacionDeclarada: formacion,
        modalidad,
        horarios,
        tarifasOrientativas: tarifas,
        mediosContacto: medios,
      })
      await actualizarAreasYTipos(perfil.id, declaraciones.areaIds, declaraciones.tipoCasoIds)
      await alGuardar()
      toaster.create({
        title: 'Perfil actualizado',
        description:
          'Guardamos tus datos ordinarios y tus declaraciones. Los datos verificables no cambian hasta que la revisión decida.',
        type: 'success',
      })
    } catch (fallo: unknown) {
      setErrorGuardado(mensajeDeError(fallo, 'No se pudieron guardar los cambios del perfil.'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Card.Root>
      <Card.Header>
        <Flex align="center" gap="2">
          <ScrollText aria-hidden size={20} />
          <Card.Title>Datos de la práctica</Card.Title>
        </Flex>
      </Card.Header>
      <Card.Body>
        <form
          noValidate
          onSubmit={(evento) => {
            evento.preventDefault()
            void guardar()
          }}
        >
          <Stack gap="6">
            <NotaCamposObligatorios />
            <SimpleGrid columns={{ base: 1, md: 2 }} gap="5">
              <Field.Root invalid={Boolean(errores.nombre)}>
                <Field.Label>
                  Nombre profesional <Obligatorio />
                </Field.Label>
                <Input
                  value={nombreProfesional}
                  onChange={(evento) => setNombreProfesional(evento.target.value)}
                  maxLength={LIMITES_REGISTRO.nombreProfesional}
                  required
                />
                <Field.HelperText>Hasta {LIMITES_REGISTRO.nombreProfesional} caracteres.</Field.HelperText>
                <Field.ErrorText>{errores.nombre}</Field.ErrorText>
              </Field.Root>

              <Field.Root invalid={Boolean(errores.ciudad)}>
                <Field.Label>
                  Ciudad de atención <Obligatorio />
                </Field.Label>
                <Input
                  value={ciudad}
                  onChange={(evento) => setCiudad(evento.target.value)}
                  maxLength={LIMITES_REGISTRO.ciudad}
                  required
                />
                <Field.HelperText>Hasta {LIMITES_REGISTRO.ciudad} caracteres.</Field.HelperText>
                <Field.ErrorText>{errores.ciudad}</Field.ErrorText>
              </Field.Root>

              <Field.Root invalid={Boolean(errores.experiencia)}>
                <Field.Label>
                  Años de experiencia <Obligatorio />
                </Field.Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={999}
                  value={experiencia}
                  onChange={(evento) => setExperiencia(evento.target.value)}
                  required
                />
                <Field.HelperText>Incluye cero si aún no tienes experiencia.</Field.HelperText>
                <Field.ErrorText>{errores.experiencia}</Field.ErrorText>
              </Field.Root>

              <Field.Root invalid={Boolean(errores.modalidad)}>
                <Field.Label>Modalidad de atención</Field.Label>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    value={modalidad}
                    onChange={(evento) => setModalidad(evento.target.value)}
                    aria-label="Modalidad de atención"
                  >
                    <option value="">Sin especificar</option>
                    {MODALIDADES_ATENCION.map((opcion) => (
                      <option key={opcion} value={opcion}>
                        {opcion}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
                <Field.HelperText>Información descriptiva; no habilita agendas ni videollamadas.</Field.HelperText>
                <Field.ErrorText>{errores.modalidad}</Field.ErrorText>
              </Field.Root>
            </SimpleGrid>

            <Field.Root invalid={Boolean(errores.descripcion)}>
              <Field.Label>
                Descripción profesional <Obligatorio />
              </Field.Label>
              <Textarea
                value={descripcion}
                onChange={(evento) => setDescripcion(evento.target.value)}
                rows={5}
                maxLength={LIMITES_REGISTRO.descripcionMax}
                required
              />
              <Field.HelperText>
                {descripcion.trim().length} / {LIMITES_REGISTRO.descripcionMax} caracteres. Mínimo{' '}
                {LIMITES_REGISTRO.descripcionMin}.
              </Field.HelperText>
              <Field.ErrorText>{errores.descripcion}</Field.ErrorText>
            </Field.Root>

            <SimpleGrid columns={{ base: 1, md: 2 }} gap="5">
              <Field.Root invalid={Boolean(errores.horarios)}>
                <Field.Label>Horarios de atención</Field.Label>
                <Input
                  value={horarios}
                  onChange={(evento) => setHorarios(evento.target.value)}
                  maxLength={LIMITES_REGISTRO.horarios}
                />
                <Field.ErrorText>{errores.horarios}</Field.ErrorText>
              </Field.Root>

              <Field.Root invalid={Boolean(errores.tarifas)}>
                <Field.Label>Tarifas orientativas</Field.Label>
                <Input
                  value={tarifas}
                  onChange={(evento) => setTarifas(evento.target.value)}
                  maxLength={LIMITES_REGISTRO.tarifas}
                />
                <Field.HelperText>Información descriptiva; no es una funcionalidad de cobro.</Field.HelperText>
                <Field.ErrorText>{errores.tarifas}</Field.ErrorText>
              </Field.Root>
            </SimpleGrid>

            <Field.Root invalid={Boolean(errores.formacion)}>
              <Field.Label>Formación declarada</Field.Label>
              <Input
                value={formacion}
                onChange={(evento) => setFormacion(evento.target.value)}
                maxLength={LIMITES_REGISTRO.formacion}
              />
              <Field.HelperText>Lo que declaras no acredita un título de especialización.</Field.HelperText>
              <Field.ErrorText>{errores.formacion}</Field.ErrorText>
            </Field.Root>

            <Fieldset.Root>
              <Fieldset.Legend>Medios de contacto</Fieldset.Legend>
              <Fieldset.HelperText>
                Solo se muestran públicamente si autorizas «Medios de contacto» en privacidad.
              </Fieldset.HelperText>
              <Fieldset.Content>
                <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
                  {(Object.keys(MEDIOS_VACIOS) as (keyof MediosContactoAlta)[]).map((clave) => (
                    <Field.Root key={clave} invalid={Boolean(errores[claveErrorMedio(clave)])}>
                      <Field.Label textTransform="capitalize">{clave.replace('_', ' ')}</Field.Label>
                      <Input
                        type={clave === 'correo' ? 'email' : clave === 'sitio_web' ? 'url' : clave === 'direccion' ? 'text' : 'tel'}
                        value={medios[clave] ?? ''}
                        onChange={(evento) => {
                          setMedios({ ...medios, [clave]: evento.target.value })
                          setErrores((actual) => ({ ...actual, [claveErrorMedio(clave)]: undefined }))
                        }}
                        maxLength={maximoMedio(clave)}
                      />
                      <Field.ErrorText>{errores[claveErrorMedio(clave)]}</Field.ErrorText>
                    </Field.Root>
                  ))}
                </SimpleGrid>
              </Fieldset.Content>
            </Fieldset.Root>

            <SeccionFotoPublica perfil={perfil} cuentaId={cuentaId} alGuardar={alGuardar} />

            <SelectorEspecialidades
              catalogo={catalogoDeEspecialidades(catalogo)}
              cargandoCatalogo={cargandoCatalogo}
              errorCatalogo={errorCatalogo}
              especialidades={especialidades}
              alCambiar={(lista) => {
                setCambiosEspecialidades(lista)
                setErrores((actual) => ({ ...actual, especialidades: undefined }))
              }}
              error={errores.especialidades}
              deshabilitado={guardando}
              requerido
            />

            {errorGuardado && (
              <Field.Root invalid>
                <Field.ErrorText role="alert">{errorGuardado}</Field.ErrorText>
              </Field.Root>
            )}

            <Text textStyle="body-sm" color="fg.muted">
              Cuenta {cuentaId.slice(0, 8)}… · Los cambios afectan a la información pública cuando exista una
              verificación aprobada y el perfil esté visible.
            </Text>

            <Flex justify="flex-end">
              <Button type="submit" loading={guardando}>
                <Save aria-hidden size={16} />
                Guardar cambios
              </Button>
            </Flex>
          </Stack>
        </form>
      </Card.Body>
    </Card.Root>
  )
}

/**
 * Fotografía del perfil: se guarda como ruta en el almacén privado y solo se muestra
 * públicamente si el titular autorizó el campo «Fotografía» en privacidad.
 */
function SeccionFotoPublica({
  perfil,
  cuentaId,
  alGuardar,
}: {
  perfil: PerfilAbogado
  cuentaId: string
  alGuardar: () => Promise<void>
}) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function reemplazar() {
    if (!archivo) {
      setError('Selecciona una imagen para reemplazar la fotografía actual.')
      return
    }
    const problema = validarArchivoEvidencia(archivo)
    if (problema) {
      setError(`Fotografía: ${problema}`)
      return
    }

    setGuardando(true)
    setError(null)
    try {
      await actualizarFotoPublica(perfil.id, cuentaId, archivo)
      setArchivo(null)
      await alGuardar()
      toaster.create({
        title: 'Fotografía actualizada',
        description: 'Se guardó en el almacén privado. Solo se publica si autorizas ese campo en privacidad.',
        type: 'success',
      })
    } catch (fallo: unknown) {
      setError(mensajeDeError(fallo, 'No se pudo actualizar la fotografía.'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Fieldset.Root invalid={Boolean(error)}>
      <Fieldset.Legend>Fotografía del perfil</Fieldset.Legend>
      <Fieldset.HelperText>
        Imagen en un almacén privado: se muestra solo a quien autoriza la política de lectura (perfil publicado y
        consensuado). No se generan enlaces públicos. Se publica solo si autorizas «Fotografía» desde privacidad.
      </Fieldset.HelperText>
      <Fieldset.Content>
        <Flex gap="4" align="center">
          <AvatarProfesional fotoPublica={perfil.foto_publica} nombre={perfil.nombre_profesional} size="lg" />
          <Text textStyle="body-sm" color="fg.muted">
            {perfil.foto_publica
              ? 'Tienes una fotografía registrada para tu perfil.'
              : 'Todavía no has registrado una fotografía.'}
          </Text>
        </Flex>
        <FileUpload.Root
          accept=".jpg,.jpeg,.png"
          maxFiles={1}
          onFileChange={(detalles) => setArchivo(detalles.acceptedFiles[0] ?? null)}
        >
          <FileUpload.HiddenInput aria-label="Nueva fotografía del perfil" />
          <FileUpload.Trigger asChild>
            <Button variant="outline" alignSelf="flex-start">
              <Upload aria-hidden size={16} />
              {perfil.foto_publica ? 'Reemplazar fotografía' : 'Añadir fotografía'}
            </Button>
          </FileUpload.Trigger>
          {archivo && (
            <FileUpload.ItemGroup mt="2">
              <FileUpload.Items showSize clearable />
            </FileUpload.ItemGroup>
          )}
        </FileUpload.Root>
      </Fieldset.Content>
      <Fieldset.ErrorText>{error ?? undefined}</Fieldset.ErrorText>
      <Flex>
        <Button size="sm" variant="subtle" onClick={() => void reemplazar()} loading={guardando} disabled={!archivo}>
          <Save aria-hidden size={14} />
          Guardar fotografía
        </Button>
      </Flex>
    </Fieldset.Root>
  )
}

/** Presentación de una versión nueva de información verificable, con evidencias privadas. */
function FormularioNuevaVersion({
  perfilId,
  cuentaId,
  ultimaVersion,
  alPresentar,
}: {
  perfilId: string
  cuentaId: string
  /** Última versión privada: de ella se precargan ambos números. */
  ultimaVersion: VersionProfesional | null
  alPresentar: () => Promise<void>
}) {
  const [identificacion, setIdentificacion] = useState(ultimaVersion?.identificacion_privada ?? '')
  const [tarjeta, setTarjeta] = useState(ultimaVersion?.tarjeta_profesional ?? '')
  const [soporteIdentificacion, setSoporteIdentificacion] = useState<File | null>(null)
  const [soporteTarjeta, setSoporteTarjeta] = useState<File | null>(null)
  const [errores, setErrores] = useState<Record<string, string | undefined>>({})
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const identificacionCorregida = identificacion.trim() !== (ultimaVersion?.identificacion_privada ?? '')
  const tarjetaCorregida = tarjeta.trim() !== (ultimaVersion?.tarjeta_profesional ?? '')

  async function presentar() {
    const problemas: Record<string, string | undefined> = {
      identificacion: validarIdentificacion(identificacion, 'tu número de identificación') ?? undefined,
      tarjeta: validarIdentificacion(tarjeta, 'el número de tu tarjeta profesional') ?? undefined,
    }

    const archivos = [
      ...(soporteIdentificacion ? [soporteIdentificacion] : []),
      ...(soporteTarjeta ? [soporteTarjeta] : []),
    ]
    for (const archivo of archivos) {
      const problema = validarArchivoEvidencia(archivo)
      if (problema) problemas.archivos = `«${archivo.name}»: ${problema}`
    }
    if (identificacionCorregida && !soporteIdentificacion) {
      problemas.soporteIdentificacion = 'Adjunta el soporte de la identificación corregida.'
    }
    if (tarjetaCorregida && !soporteTarjeta) {
      problemas.soporteTarjeta = 'Adjunta el soporte de la tarjeta corregida.'
    }
    if (archivos.length === 0) {
      problemas.archivos = 'Adjunta al menos un archivo de soporte.'
    }

    setErrores(problemas)
    if (Object.values(problemas).some((problema) => problema)) return

    setEnviando(true)
    setErrorEnvio(null)
    try {
      // La RPC valida los dos números y devuelve el UUID de la versión, reutilizando la
      // pendiente si ambos coinciden. Ese UUID se usa para todos los soportes.
      const versionId = await prepararVersionProfesional({
        perfilId,
        tarjetaProfesional: tarjeta,
        identificacionPrivada: identificacion,
      })

      const pendientes: { archivo: File; tipo: TipoEvidenciaProfesional }[] = []
      if (soporteIdentificacion) pendientes.push({ archivo: soporteIdentificacion, tipo: 'identificacion' })
      if (soporteTarjeta) pendientes.push({ archivo: soporteTarjeta, tipo: 'tarjeta_profesional' })

      // Subida individual: un fallo no revierte la versión ni los soportes ya registrados.
      const fallidos: File[] = []
      const detalleFallos: string[] = []
      for (const { archivo, tipo } of pendientes) {
        try {
          await adjuntarEvidenciaProfesional(versionId, cuentaId, archivo, tipo)
        } catch (fallo: unknown) {
          fallidos.push(archivo)
          detalleFallos.push(`«${archivo.name}»: ${mensajeDeError(fallo, 'no se pudo adjuntar')}`)
        }
      }

      // Se descartan del formulario solo los archivos registrados: un reintento envía
      // únicamente lo que falta y nunca reenvía de forma automática.
      if (soporteIdentificacion && !fallidos.includes(soporteIdentificacion)) setSoporteIdentificacion(null)
      if (soporteTarjeta && !fallidos.includes(soporteTarjeta)) setSoporteTarjeta(null)

      await alPresentar()

      if (detalleFallos.length > 0) {
        setErrorEnvio(
          `La versión quedó registrada, pero no se pudieron adjuntar: ${detalleFallos.join(' ')} Los soportes ya registrados se conservan; adjunta de nuevo solo los que faltan.`,
        )
        toaster.create({
          title: 'Versión presentada con incidencias',
          description: 'Consulta el historial y vuelve a adjuntar los soportes pendientes.',
          type: 'warning',
        })
        return
      }

      setErrores({})
      toaster.create({
        title: 'Versión presentada',
        description:
          'Queda pendiente de revisión administrativa. La aprobación vigente sigue refiriéndose a la versión revisada hasta que se decida esta.',
        type: 'success',
      })
    } catch (fallo: unknown) {
      setErrorEnvio(mensajeDeError(fallo, 'No se pudo presentar la versión.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form
      noValidate
      onSubmit={(evento) => {
        evento.preventDefault()
        void presentar()
      }}
    >
      <Stack gap="5">
        <Text textStyle="body-sm" color="fg.muted">
          Presentar una versión no cambia la aprobación vigente: la revisión se refiere a la versión presentada.
          {identificacionCorregida || tarjetaCorregida
            ? ' Corregiste un número: se exige su soporte y no se modifica ninguna versión anterior.'
            : ' Si corriges un número, adjunta su soporte.'}
        </Text>

        <Field.Root invalid={Boolean(errores.identificacion || errores.soporteIdentificacion)}>
          <Field.Label>Identificación privada</Field.Label>
          <Input
            value={identificacion}
            onChange={(evento) => setIdentificacion(evento.target.value)}
            maxLength={LIMITES_REGISTRO.identificacionMax}
            required
          />
          <Field.HelperText>
            Dato privado: no se publica ni forma parte de tu perfil público. Entre 3 y 40 letras, números, espacios,
            puntos o guiones.
            {ultimaVersion ? ` Último número presentado: ${ultimaVersion.identificacion_privada}.` : ''}
          </Field.HelperText>
          <FileUpload.Root
            accept=".pdf,.jpg,.jpeg,.png"
            maxFiles={1}
            onFileChange={(detalles) => setSoporteIdentificacion(detalles.acceptedFiles[0] ?? null)}
          >
            <FileUpload.HiddenInput aria-label="Soporte de la identificación" />
            <FileUpload.Trigger asChild>
              <Button variant="outline" width="full">
                <Upload aria-hidden size={16} />
                {soporteIdentificacion ? 'Cambiar soporte de identificación' : 'Soporte de la identificación'}
              </Button>
            </FileUpload.Trigger>
            {soporteIdentificacion && (
              <FileUpload.ItemGroup mt="2">
                <FileUpload.Items showSize clearable />
              </FileUpload.ItemGroup>
            )}
          </FileUpload.Root>
          <Field.ErrorText>{errores.identificacion ?? errores.soporteIdentificacion}</Field.ErrorText>
        </Field.Root>

        <Field.Root invalid={Boolean(errores.tarjeta || errores.soporteTarjeta)}>
          <Field.Label>Tarjeta profesional</Field.Label>
          <Input
            value={tarjeta}
            onChange={(evento) => setTarjeta(evento.target.value)}
            maxLength={LIMITES_REGISTRO.identificacionMax}
            required
          />
          <Field.HelperText>
            Entre 3 y 40 letras, números, espacios, puntos o guiones.
          </Field.HelperText>
          <FileUpload.Root
            accept=".pdf,.jpg,.jpeg,.png"
            maxFiles={1}
            onFileChange={(detalles) => setSoporteTarjeta(detalles.acceptedFiles[0] ?? null)}
          >
            <FileUpload.HiddenInput aria-label="Soporte de la tarjeta profesional" />
            <FileUpload.Trigger asChild>
              <Button variant="outline" width="full">
                <Upload aria-hidden size={16} />
                {soporteTarjeta ? 'Cambiar soporte de tarjeta' : 'Soporte de la tarjeta profesional'}
              </Button>
            </FileUpload.Trigger>
            {soporteTarjeta && (
              <FileUpload.ItemGroup mt="2">
                <FileUpload.Items showSize clearable />
              </FileUpload.ItemGroup>
            )}
          </FileUpload.Root>
          <Field.ErrorText>{errores.tarjeta ?? errores.soporteTarjeta}</Field.ErrorText>
        </Field.Root>

        {errorEnvio && (
          <Field.Root invalid>
            <Field.ErrorText role="alert">{errorEnvio}</Field.ErrorText>
          </Field.Root>
        )}

        <Flex justify="flex-end">
          <Button type="submit" loading={enviando}>
            <Send aria-hidden size={16} />
            Presentar versión para revisión
          </Button>
        </Flex>
      </Stack>
    </form>
  )
}

/**
 * Documentos legales que exige la recuperación.
 *
 * La RPC pide exactamente los tres documentos vigentes, así que las casillas salen de
 * `documentosVigentes` (última versión publicada de cada tipo). Si no hay tres, no se
 * puede completar y se dice sin ofrecer un envío que el servidor rechazaría.
 */
function DocumentosDeRecuperacion({
  seleccionados,
  alCambiar,
  error,
  deshabilitado,
}: {
  seleccionados: string[]
  alCambiar: (documentoIds: string[]) => void
  error?: string
  deshabilitado: boolean
}) {
  const documentos = useDocumentosLegales()

  return (
    <Fieldset.Root invalid={Boolean(error)}>
      <Fieldset.Legend>
        Documentos legales vigentes <Obligatorio />
      </Fieldset.Legend>
      <Fieldset.HelperText>
        Para recuperar el perfil hay que aceptar las tres versiones vigentes. La aceptación se registra con su fecha y
        el documento aceptado.
      </Fieldset.HelperText>
      <Fieldset.Content>
        {documentos.cargando && <Text color="fg.muted">Cargando los documentos legales…</Text>}
        {documentos.error && (
          <Stack gap="2">
            <Text color="fg.error" role="alert">
              No se pudieron cargar los documentos legales: {documentos.error}
            </Text>
            <Button size="sm" variant="outline" alignSelf="flex-start" onClick={() => documentos.recargar()}>
              Reintentar
            </Button>
          </Stack>
        )}
        {!documentos.cargando && !documentos.error && documentos.documentos.length !== 3 && (
          <Text color="fg.warning">
            No hay tres documentos vigentes publicados, así que la recuperación no puede completarse ahora. Se
            reintentará cuando la administración publique las versiones que falten.
          </Text>
        )}
        {documentos.documentos.length > 0 && (
          <AceptacionesLegales
            documentos={documentos.documentos}
            seleccionados={seleccionados}
            alCambiar={alCambiar}
            deshabilitado={deshabilitado}
          />
        )}
      </Fieldset.Content>
      <Fieldset.ErrorText>{error}</Fieldset.ErrorText>
    </Fieldset.Root>
  )
}

/**
 * Alta o recuperación del perfil profesional de una cuenta autenticada (CU 02).
 *
 * En `recuperacion` el envío va por `recuperar_perfil_profesional` con `p_perfil` y los
 * identificadores de los tres documentos vigentes: no se suben archivos, no se indica
 * cuenta destino y la validación replica las longitudes y límites que impone el servidor.
 */
function FormularioAltaProfesional({
  cuentaId,
  catalogo,
  cargandoCatalogo,
  errorCatalogo,
  alCompletar,
  modo = 'alta',
}: {
  cuentaId: string
  catalogo: OpcionesCatalogo | null
  cargandoCatalogo: boolean
  errorCatalogo: string | null
  alCompletar: () => Promise<void>
  modo?: 'alta' | 'recuperacion'
}) {
  const esRecuperacion = modo === 'recuperacion'
  const { cuenta } = useSesion()
  const [nombreProfesional, setNombreProfesional] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [experiencia, setExperiencia] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [formacion, setFormacion] = useState('')
  const [modalidad, setModalidad] = useState('')
  const [horarios, setHorarios] = useState('')
  const [tarifas, setTarifas] = useState('')
  const [medios, setMedios] = useState<MediosContactoAlta>({ ...MEDIOS_VACIOS })
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([])
  const declaraciones = descomponerEspecialidades(especialidades)
  const [identificacion, setIdentificacion] = useState('')
  const [tarjeta, setTarjeta] = useState('')
  const [soporteIdentificacion, setSoporteIdentificacion] = useState<File | null>(null)
  const [soporteTarjeta, setSoporteTarjeta] = useState<File | null>(null)
  const [archivos, setArchivos] = useState<File[]>([])
  const [documentosAceptados, setDocumentosAceptados] = useState<string[]>([])
  const [errores, setErrores] = useState<Record<string, string | undefined>>({})
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  /**
   * Borrador en memoria: identificación y tarjeta son datos privados, así que no se
   * persisten. Se limpia al completar con éxito (el cambio de cuenta remonta el formulario
   * porque la página lo monta con `key`).
   */
  function limpiarBorrador() {
    setNombreProfesional('')
    setDescripcion('')
    setExperiencia('')
    setCiudad('')
    setFormacion('')
    setModalidad('')
    setHorarios('')
    setTarifas('')
    setMedios({ ...MEDIOS_VACIOS })
    setEspecialidades([])
    setIdentificacion('')
    setTarjeta('')
    setSoporteIdentificacion(null)
    setSoporteTarjeta(null)
    setArchivos([])
    setDocumentosAceptados([])
    setErrores({})
  }

  /** Cuerpo de `p_perfil`: solo claves admitidas por la RPC, con nombres del esquema. */
  function perfilParaRecuperar() {
    return {
      nombre_profesional: nombreProfesional.trim(),
      descripcion: descripcion.trim(),
      ciudad_atencion: ciudad.trim(),
      experiencia_anios: Number(experiencia.trim()),
      formacion_declarada: formacion.trim() || null,
      modalidad: modalidad.trim() || null,
      horarios: horarios.trim() || null,
      tarifas_orientativas: tarifas.trim() || null,
      identificacion_privada: identificacion.trim(),
      tarjeta_profesional: tarjeta.trim(),
      areas: declaraciones.areaIds,
      tipos_caso: declaraciones.tipoCasoIds,
      medios_contacto: { ...medios },
      // Nada se publica hasta que el titular autorice campos desde privacidad.
      campos_opcionales_publicos: {},
    }
  }

  async function completar() {
    const problemas: Record<string, string | undefined> = {
      ...validarPractica({
        nombreProfesional,
        ciudadAtencion: ciudad,
        experienciaAnios: experiencia,
        descripcion,
        formacionDeclarada: formacion,
        horarios,
        tarifasOrientativas: tarifas,
        modalidad,
        mediosContacto: medios,
      }),
      identificacion: validarIdentificacion(identificacion, 'tu número de identificación') ?? undefined,
      tarjeta: validarIdentificacion(tarjeta, 'el número de tu tarjeta profesional') ?? undefined,
    }

    const sinEspecialidad = declaraciones.areaIds.length === 0 || declaraciones.tipoCasoIds.length === 0
    if (sinEspecialidad) {
      problemas.especialidades = 'Añade al menos una especialidad: área jurídica y tipo de caso.'
    } else if (
      declaraciones.areaIds.length > LIMITES_REGISTRO.especialidadesMax ||
      declaraciones.tipoCasoIds.length > LIMITES_REGISTRO.especialidadesMax
    ) {
      problemas.especialidades = 'El perfil admite como máximo 8 áreas y 8 tipos de caso distintos.'
    }

    if (esRecuperacion) {
      for (const [nombre, archivo] of [
        ['identificación', soporteIdentificacion],
        ['tarjeta', soporteTarjeta],
      ] as const) {
        if (!archivo) continue
        const problemaSoporte = validarArchivoEvidencia(archivo)
        if (problemaSoporte) problemas.soporte = `Soporte de la ${nombre}: ${problemaSoporte}`
      }
      if (documentosAceptados.length !== 3) {
        problemas.documentos = 'Revisa y acepta los tres documentos vigentes.'
      }
    } else {
      for (const archivo of archivos) {
        const problema = validarArchivoEvidencia(archivo)
        if (problema) problemas.archivos = `«${archivo.name}»: ${problema}`
      }
    }

    setErrores(problemas)
    if (Object.values(problemas).some((problema) => problema)) return

    // La identidad de la petición se fija aquí: el servidor escribe para `auth.uid()`, así
    // que si la sesión ya no es la del formulario no se envía nada.
    if (!cuenta || cuenta.id !== cuentaId) {
      setErrorEnvio('La sesión cambió mientras completabas el formulario. Vuelve a entrar para continuar.')
      return
    }

    setEnviando(true)
    setErrorEnvio(null)
    try {
      if (esRecuperacion) {
        const resultado = await recuperarPerfilProfesional({
          perfil: perfilParaRecuperar(),
          documentos: documentosAceptados,
        })
        if (resultado.tipo !== 'recuperado') {
          throw new Error('El servidor no confirmó la recuperación del perfil. Revisa los datos e inténtalo de nuevo.')
        }

        // Los soportes (identificación y tarjeta) se adjuntan después de crear el perfil, a su versión
        // pendiente: así la recuperación no depende de la subida del archivo. Si falla, el
        // perfil se conserva y se indica cómo continuar desde el panel.
        const soportes: { archivo: File; tipo: TipoEvidenciaProfesional; etiqueta: string }[] = []
        if (soporteIdentificacion) {
          soportes.push({ archivo: soporteIdentificacion, tipo: 'identificacion', etiqueta: 'la identificación' })
        }
        if (soporteTarjeta) {
          soportes.push({ archivo: soporteTarjeta, tipo: 'tarjeta_profesional', etiqueta: 'la tarjeta profesional' })
        }

        const avisosSoporte: string[] = []
        if (soportes.length > 0) {
          try {
            const versiones = await cargarVersionesProfesionales(resultado.perfilId)
            const pendiente = versiones.find((version) => version.estado_revision === 'pendiente')
            if (!pendiente) throw new Error('El perfil no tiene una versión pendiente de revisión.')
            for (const { archivo, tipo, etiqueta } of soportes) {
              try {
                // Mismo UUID para todos los soportes; el tipo distingue el número.
                await adjuntarEvidenciaProfesional(pendiente.id, cuentaId, archivo, tipo)
              } catch (fallo: unknown) {
                avisosSoporte.push(
                  `no se pudo adjuntar el soporte de ${etiqueta}: ${mensajeDeError(fallo, 'error al subir el archivo')}`,
                )
              }
            }
          } catch (fallo: unknown) {
            avisosSoporte.push(mensajeDeError(fallo, 'no se pudo preparar la versión para los soportes'))
          }
        }

        limpiarBorrador()
        await alCompletar()
        toaster.create({
          title: 'Perfil recuperado',
          description:
            avisosSoporte.length > 0
              ? `Tu perfil quedó pendiente de revisión, pero ${avisosSoporte.join('; ')}. Puedes adjuntarlo desde Mi perfil profesional.`
              : 'Tu perfil quedó pendiente de revisión administrativa y permanece oculto mientras no exista verificación aprobada.',
          type: avisosSoporte.length > 0 ? 'warning' : 'success',
        })
        return
      }

      const resultado = await completarAltaProfesional(cuentaId, {
        nombreProfesional,
        descripcion,
        experienciaAnios: Number(experiencia.trim()),
        ciudadAtencion: ciudad,
        formacionDeclarada: formacion,
        modalidad,
        horarios,
        tarifasOrientativas: tarifas,
        mediosContacto: medios,
        areaIds: declaraciones.areaIds,
        tipoCasoIds: declaraciones.tipoCasoIds,
        identificacionPrivada: identificacion,
        tarjetaProfesional: tarjeta,
        archivos,
      })
      await alCompletar()
      toaster.create({
        title: 'Alta profesional registrada',
        description:
          resultado.avisos.length > 0
            ? `Tu perfil quedó pendiente de revisión. ${resultado.avisos.join(' ')}`
            : 'Tu perfil quedó pendiente de revisión administrativa y permanece oculto mientras no exista verificación aprobada.',
        type: resultado.avisos.length > 0 ? 'warning' : 'success',
      })
    } catch (fallo: unknown) {
      setErrorEnvio(mensajeDeError(fallo, 'No se pudo completar el alta profesional.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Card.Root>
      <Card.Header>
        <Flex align="center" gap="2">
          <FileCheck2 aria-hidden size={20} />
          <Card.Title>{esRecuperacion ? 'Recupera tu perfil profesional' : 'Alta profesional'}</Card.Title>
        </Flex>
      </Card.Header>
      <Card.Body>
        <form
          noValidate
          onSubmit={(evento) => {
            evento.preventDefault()
            void completar()
          }}
        >
          <Stack gap="6">
            <NotaCamposObligatorios />
            <SimpleGrid columns={{ base: 1, md: 2 }} gap="5">
              <Field.Root invalid={Boolean(errores.nombre)}>
                <Field.Label>
                  Nombre profesional <Obligatorio />
                </Field.Label>
                <Input
                  value={nombreProfesional}
                  onChange={(evento) => setNombreProfesional(evento.target.value)}
                  maxLength={LIMITES_REGISTRO.nombreProfesional}
                  required
                />
                <Field.HelperText>Hasta {LIMITES_REGISTRO.nombreProfesional} caracteres.</Field.HelperText>
                <Field.ErrorText>{errores.nombre}</Field.ErrorText>
              </Field.Root>

              <Field.Root invalid={Boolean(errores.ciudad)}>
                <Field.Label>
                  Ciudad de atención <Obligatorio />
                </Field.Label>
                <Input
                  value={ciudad}
                  onChange={(evento) => setCiudad(evento.target.value)}
                  maxLength={LIMITES_REGISTRO.ciudad}
                  required
                />
                <Field.HelperText>Hasta {LIMITES_REGISTRO.ciudad} caracteres.</Field.HelperText>
                <Field.ErrorText>{errores.ciudad}</Field.ErrorText>
              </Field.Root>

              <Field.Root invalid={Boolean(errores.experiencia)}>
                <Field.Label>
                  Años de experiencia <Obligatorio />
                </Field.Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={999}
                  value={experiencia}
                  onChange={(evento) => setExperiencia(evento.target.value)}
                  required
                />
                <Field.HelperText>Incluye cero si aún no tienes experiencia.</Field.HelperText>
                <Field.ErrorText>{errores.experiencia}</Field.ErrorText>
              </Field.Root>

              <Field.Root invalid={Boolean(errores.modalidad)}>
                <Field.Label>Modalidad de atención</Field.Label>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    value={modalidad}
                    onChange={(evento) => setModalidad(evento.target.value)}
                    aria-label="Modalidad de atención"
                  >
                    <option value="">Sin especificar</option>
                    {MODALIDADES_ATENCION.map((opcion) => (
                      <option key={opcion} value={opcion}>
                        {opcion}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
                <Field.HelperText>Información descriptiva; no habilita agendas ni videollamadas.</Field.HelperText>
                <Field.ErrorText>{errores.modalidad}</Field.ErrorText>
              </Field.Root>
            </SimpleGrid>

            <Field.Root invalid={Boolean(errores.descripcion)}>
              <Field.Label>
                Descripción profesional <Obligatorio />
              </Field.Label>
              <Textarea
                value={descripcion}
                onChange={(evento) => setDescripcion(evento.target.value)}
                rows={5}
                maxLength={LIMITES_REGISTRO.descripcionMax}
                required
              />
              <Field.HelperText>
                {descripcion.trim().length} / {LIMITES_REGISTRO.descripcionMax} caracteres. Mínimo{' '}
                {LIMITES_REGISTRO.descripcionMin}.
              </Field.HelperText>
              <Field.ErrorText>{errores.descripcion}</Field.ErrorText>
            </Field.Root>

            <SimpleGrid columns={{ base: 1, md: 2 }} gap="5">
              <Field.Root invalid={Boolean(errores.horarios)}>
                <Field.Label>Horarios de atención</Field.Label>
                <Input
                  value={horarios}
                  onChange={(evento) => setHorarios(evento.target.value)}
                  maxLength={LIMITES_REGISTRO.horarios}
                />
                <Field.ErrorText>{errores.horarios}</Field.ErrorText>
              </Field.Root>

              <Field.Root invalid={Boolean(errores.tarifas)}>
                <Field.Label>Tarifas orientativas</Field.Label>
                <Input
                  value={tarifas}
                  onChange={(evento) => setTarifas(evento.target.value)}
                  maxLength={LIMITES_REGISTRO.tarifas}
                />
                <Field.HelperText>Información descriptiva; no es una funcionalidad de cobro.</Field.HelperText>
                <Field.ErrorText>{errores.tarifas}</Field.ErrorText>
              </Field.Root>
            </SimpleGrid>

            <Field.Root invalid={Boolean(errores.formacion)}>
              <Field.Label>Formación declarada</Field.Label>
              <Input
                value={formacion}
                onChange={(evento) => setFormacion(evento.target.value)}
                maxLength={LIMITES_REGISTRO.formacion}
              />
              <Field.HelperText>Lo que declaras no acredita un título de especialización.</Field.HelperText>
              <Field.ErrorText>{errores.formacion}</Field.ErrorText>
            </Field.Root>

            <Fieldset.Root>
              <Fieldset.Legend>Medios de contacto</Fieldset.Legend>
              <Fieldset.HelperText>
                Se publican en tu perfil solo si autorizas ese campo desde privacidad.
              </Fieldset.HelperText>
              <Fieldset.Content>
                <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
                  {(Object.keys(MEDIOS_VACIOS) as (keyof MediosContactoAlta)[]).map((clave) => (
                    <Field.Root key={clave} invalid={Boolean(errores[claveErrorMedio(clave)])}>
                      <Field.Label textTransform="capitalize">{clave.replace('_', ' ')}</Field.Label>
                      <Input
                        type={clave === 'correo' ? 'email' : clave === 'sitio_web' ? 'url' : clave === 'direccion' ? 'text' : 'tel'}
                        value={medios[clave] ?? ''}
                        onChange={(evento) => {
                          setMedios({ ...medios, [clave]: evento.target.value })
                          setErrores((actual) => ({ ...actual, [claveErrorMedio(clave)]: undefined }))
                        }}
                        maxLength={maximoMedio(clave)}
                      />
                      <Field.ErrorText>{errores[claveErrorMedio(clave)]}</Field.ErrorText>
                    </Field.Root>
                  ))}
                </SimpleGrid>
              </Fieldset.Content>
            </Fieldset.Root>

            <SelectorEspecialidades
              catalogo={catalogoDeEspecialidades(catalogo)}
              cargandoCatalogo={cargandoCatalogo}
              errorCatalogo={errorCatalogo}
              especialidades={especialidades}
              alCambiar={setEspecialidades}
              limitePorConjunto={LIMITES_REGISTRO.especialidadesMax}
              error={errores.especialidades}
              deshabilitado={enviando}
              requerido
            />

            <Alert.Root status="info">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Información verificable</Alert.Title>
                <Alert.Description>
                  {esRecuperacion
                    ? 'La identificación y la tarjeta profesional quedan en un almacén privado, sin publicación. Las evidencias podrás adjuntarlas después desde tu perfil. La revisión administrativa decide sobre tu inscripción.'
                    : 'La identificación, la tarjeta profesional y las evidencias quedan en un almacén privado, sin publicación. La revisión administrativa decide sobre tu inscripción.'}
                </Alert.Description>
              </Alert.Content>
            </Alert.Root>

            <Field.Root invalid={Boolean(errores.identificacion)}>
              <Field.Label>
                Identificación privada <Obligatorio />
              </Field.Label>
              <Input
                value={identificacion}
                onChange={(evento) => setIdentificacion(evento.target.value)}
                maxLength={LIMITES_REGISTRO.identificacionMax}
                required
              />
              <Field.HelperText>
                Entre 3 y 40 letras, números, espacios, puntos o guiones.
              </Field.HelperText>
              <Field.ErrorText>{errores.identificacion}</Field.ErrorText>
            </Field.Root>

            <Field.Root invalid={Boolean(errores.tarjeta)}>
              <Field.Label>
                Tarjeta profesional <Obligatorio />
              </Field.Label>
              <Input
                value={tarjeta}
                onChange={(evento) => setTarjeta(evento.target.value)}
                maxLength={LIMITES_REGISTRO.identificacionMax}
                required
              />
              <Field.ErrorText>{errores.tarjeta}</Field.ErrorText>
            </Field.Root>

            {esRecuperacion ? (
              <>
                <Field.Root invalid={Boolean(errores.soporte)}>
                  <Field.Label>Soporte de la identificación (opcional)</Field.Label>
                  <FileUpload.Root
                    accept=".pdf,.jpg,.jpeg,.png"
                    maxFiles={1}
                    onFileChange={(detalles) => setSoporteIdentificacion(detalles.acceptedFiles[0] ?? null)}
                  >
                    <FileUpload.HiddenInput aria-label="Soporte de la identificación privada" />
                    <FileUpload.Trigger asChild>
                      <Button variant="outline" width="full">
                        <Upload aria-hidden size={16} />
                        {soporteIdentificacion ? 'Cambiar soporte de identificación' : 'Seleccionar soporte'}
                      </Button>
                    </FileUpload.Trigger>
                    {soporteIdentificacion && (
                      <FileUpload.ItemGroup mt="2">
                        <FileUpload.Items showSize clearable />
                      </FileUpload.ItemGroup>
                    )}
                  </FileUpload.Root>
                  <Field.HelperText>
                    La identificación y la tarjeta profesional se conservan en un repositorio privado bajo tu
                    identificador y no se publican en el directorio. Como tu sesión ya está activa, puedes adjuntar ahora
                    el soporte de tu identificación o hacerlo después desde el panel. PDF, JPEG o PNG de hasta 10 MB.
                  </Field.HelperText>
                  <Field.ErrorText>{errores.soporte}</Field.ErrorText>
                </Field.Root>

                <Field.Root invalid={Boolean(errores.soporte)}>
                  <Field.Label>Soporte de la tarjeta profesional (opcional)</Field.Label>
                  <FileUpload.Root
                    accept=".pdf,.jpg,.jpeg,.png"
                    maxFiles={1}
                    onFileChange={(detalles) => setSoporteTarjeta(detalles.acceptedFiles[0] ?? null)}
                  >
                    <FileUpload.HiddenInput aria-label="Soporte de la tarjeta profesional" />
                    <FileUpload.Trigger asChild>
                      <Button variant="outline" width="full">
                        <Upload aria-hidden size={16} />
                        {soporteTarjeta ? 'Cambiar soporte' : 'Seleccionar soporte'}
                      </Button>
                    </FileUpload.Trigger>
                    {soporteTarjeta && (
                      <FileUpload.ItemGroup mt="2">
                        <FileUpload.Items showSize clearable />
                      </FileUpload.ItemGroup>
                    )}
                  </FileUpload.Root>
                  <Field.HelperText>
                    La identificación y la tarjeta profesional se conservan en un repositorio privado bajo tu
                    identificador y no se publican en el directorio. Como tu sesión ya está activa, puedes adjuntar ahora
                    el soporte de tu tarjeta profesional o hacerlo después desde el panel. PDF, JPEG o PNG de hasta 10 MB.
                  </Field.HelperText>
                  <Field.ErrorText>{errores.soporte}</Field.ErrorText>
                </Field.Root>
                <DocumentosDeRecuperacion
                  seleccionados={documentosAceptados}
                  alCambiar={setDocumentosAceptados}
                  error={errores.documentos}
                  deshabilitado={enviando}
                />
              </>
            ) : (
              <>
                <Fieldset.Root invalid={Boolean(errores.archivos)}>
                  <Fieldset.Legend>Evidencias de la información verificable</Fieldset.Legend>
                  <Fieldset.HelperText>
                    PDF, JPEG o PNG de hasta 10 MB por archivo. Material privado: no se publica.
                  </Fieldset.HelperText>
                  <Fieldset.Content>
                    <FileUpload.Root
                      accept=".pdf,.jpg,.jpeg,.png"
                      maxFiles={6}
                      onFileChange={(detalles) => setArchivos(detalles.acceptedFiles)}
                    >
                      <FileUpload.HiddenInput aria-label="Evidencias del alta profesional" />
                      <FileUpload.Trigger asChild>
                        <Button variant="outline" width="full" minH="20" borderStyle="dashed">
                          <Stack align="center" gap="1">
                            <Upload aria-hidden size={18} />
                            <Text textStyle="label-md">Seleccionar evidencias</Text>
                            <Text textStyle="body-sm" color="fg.muted">PDF, JPEG o PNG · hasta 10 MB cada uno</Text>
                          </Stack>
                        </Button>
                      </FileUpload.Trigger>
                      {archivos.length > 0 && (
                        <FileUpload.ItemGroup mt="3">
                          <FileUpload.Items showSize clearable />
                        </FileUpload.ItemGroup>
                      )}
                    </FileUpload.Root>
                  </Fieldset.Content>
                  <Fieldset.ErrorText>{errores.archivos}</Fieldset.ErrorText>
                </Fieldset.Root>
              </>
            )}

            {errorEnvio && (
              <Field.Root invalid>
                <Field.ErrorText role="alert">{errorEnvio}</Field.ErrorText>
              </Field.Root>
            )}

            <Flex justify="flex-end">
              <Button type="submit" loading={enviando}>
                <Send aria-hidden size={16} />
                {esRecuperacion ? 'Recuperar perfil y presentar a revisión' : 'Registrar alta y presentar a revisión'}
              </Button>
            </Flex>
          </Stack>
        </form>
      </Card.Body>
    </Card.Root>
  )
}
