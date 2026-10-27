// CU 02: registro de abogado en cinco pasos. El alta tiene dos momentos y el asistente
// recoge solo lo que puede persistirse: la cuenta, el perfil, las declaraciones y la
// presentación verificable de texto viajan en los metadatos y los guarda el trigger
// `handle_new_user`. Los soportes en archivo exigen la sesión del titular, así que se
// adjuntan al activar la cuenta, desde «Mi perfil profesional».
//
// La clasificación declarada se construye como relaciones área–tipo de caso: el abogado
// elige un área y un tipo de caso asociado, los añade a una lista de hasta ocho
// especialidades sin repeticiones y el envío descompone esa lista en las dos tablas del
// contrato (`perfil_area` y `perfil_tipo_caso`).

import { Fragment, useMemo, useState, type FormEvent } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Field,
  Fieldset,
  Flex,
  Heading,
  Input,
  Link as ChakraLink,
  List,
  NativeSelect,
  Stack,
  Tag,
  Text,
  Textarea,
} from '@chakra-ui/react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  Circle,
  Info,
  Lock,
  MailCheck,
  Plus,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react'
import { FeedbackState } from '../../../components/shared/FeedbackState'
import { ListaDatos } from '../../../components/shared/ListaDatos'
import { RequisitosContrasena } from '../../../components/shared/RequisitosContrasena'
import { useConsulta } from '../../../hooks/useConsulta'
import { CAMPOS_OPCIONALES } from '../../../utils/contrato'
import { esCorreoDuplicado, mensajeDeError } from '../../../utils/errores'
import { LIMITES_REGISTRO } from '../../../utils/validaciones'
import { listarAreas, listarRelacionesAreaTipoCaso, listarTiposCaso, tiposCasoDeAreas } from '../../catalogo/services/catalogo'
import { AceptacionesLegales } from '../../privacidad/components/AceptacionesLegales'
import { TIPOS_DOCUMENTO_REQUERIDOS } from '../../privacidad/services/legales'
import { useDocumentosLegales } from '../../privacidad/hooks/useDocumentosLegales'
import { crearPerfilAbogado, declararAreasYTipos, presentarVersionInicial } from '../../perfil/services/registroAbogado'
import { obtenerCuenta, registrarCuenta } from '../services/auth'
import {
  mediosContactoJson,
  validarCredenciales,
  validarDeclaraciones,
  validarPerfilPublico,
  validarVerificacion,
  type CamposCredenciales,
  type CamposDeclaraciones,
  type CamposPerfilPublico,
  type CamposVerificacion,
  type ErrorCredenciales,
  type ErrorDeclaraciones,
  type ErrorPerfilPublico,
  type ErrorVerificacion,
} from '../types'

const PASOS = ['Credenciales', 'Perfil público', 'Declaraciones', 'Verificación', 'Confirmación']
const TOTAL_PASOS = PASOS.length

/**
 * Máximo de relaciones área–tipo de caso que admite el constructor de especialidades.
 * Es una regla de presentación: el contrato guarda las áreas y los tipos declarados en
 * tablas separadas (`perfil_area` y `perfil_tipo_caso`) y no fija un máximo.
 */
const MAX_ESPECIALIDADES = LIMITES_REGISTRO.especialidadesMax
const MENSAJE_INFO_ESPECIALIDADES =
  'Puedes agregar hasta 8 tipos de casos para maximizar la precisión en el emparejamiento con clientes y expedientes judiciales compatibles.'
const MENSAJE_LIMITE_ESPECIALIDADES =
  'Alcanzaste el límite de 8 especialidades. Quita una para agregar otra.'

/** Relación declarada entre un área jurídica y un tipo de caso (CU 02). */
type Especialidad = { areaId: string; tipoCasoId: string }

/** Datos faltantes al intentar añadir una especialidad; se muestran como error del campo. */
type ErroresSeleccion = { area?: string; tipo?: string }

/** Campos del perfil público sin la clasificación, que se deriva de las especialidades. */
type CamposPerfilBase = Omit<CamposPerfilPublico, 'areaIds' | 'tipoCasoIds'>

const CREDENCIALES_VACIAS: CamposCredenciales = {
  nombreCompleto: '',
  correo: '',
  contrasena: '',
  confirmacion: '',
  telefono: '',
}

const PERFIL_VACIO: CamposPerfilBase = {
  nombreProfesional: '',
  ciudadAtencion: '',
  experienciaAnios: '',
  descripcion: '',
}

const DECLARACIONES_VACIAS: CamposDeclaraciones = {
  formacionDeclarada: '',
  modalidad: '',
  horarios: '',
  tarifasOrientativas: '',
  mediosContacto: { correo: '', telefono: '', whatsapp: '', sitioWeb: '' },
  camposPublicos: {},
  ofrecerEnDirectorio: false,
}

const VERIFICACION_VACIA: CamposVerificacion = {
  identificacionPrivada: '',
  tarjetaProfesional: '',
}

type EstadoFinal =
  | { tipo: 'pendiente-revision' }
  | { tipo: 'requiere-confirmacion'; correo: string; motivo: 'registro' | 'perfil-posterior' }

/**
 * Indicador de pasos horizontal: círculos en línea unidos por una línea que se completa
 * conforme avanza el registro. Cada paso sigue siendo un botón (navegación por teclado)
 * y el paso actual se anuncia. En móvil se ocultan los títulos para que los cinco
 * círculos quepan y se muestra debajo el nombre del paso en curso.
 */
function IndicadorPasos({ actual, irA }: { actual: number; irA: (indice: number) => void }) {
  return (
    <Box as="nav" aria-label="Pasos del registro profesional">
      <Flex align="flex-start" width="full">
        {PASOS.map((titulo, indice) => {
          const numero = indice + 1
          const completado = indice < actual
          const esActual = indice === actual
          return (
            <Fragment key={titulo}>
              {indice > 0 && (
                <Flex aria-hidden align="center" flex="1" minW="3" height="8" mt="1">
                  <Box height="2px" width="full" borderRadius="full" bg={indice <= actual ? 'success' : 'border'} />
                </Flex>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => irA(indice)}
                aria-current={esActual ? 'step' : undefined}
                aria-label={`Paso ${numero} de ${TOTAL_PASOS}: ${titulo}`}
                disabled={indice > actual}
                height="auto"
                px={{ base: '1', md: '2' }}
                py="1"
                flexShrink="0"
                color={esActual ? 'primary' : 'fg.muted'}
                fontWeight={esActual ? '600' : '500'}
                _disabled={{ opacity: 0.6, cursor: 'not-allowed' }}
                _hover={{ bg: 'bg.subtle' }}
              >
                <Stack gap="2" align="center" width={{ base: 'auto', md: '7rem' }} minW="0">
                  <Flex
                    align="center"
                    justify="center"
                    boxSize="8"
                    borderRadius="full"
                    flexShrink="0"
                    bg={esActual ? 'primary' : completado ? 'success' : 'bg.panel'}
                    color={esActual || completado ? 'on-primary' : 'fg.muted'}
                    borderWidth="1px"
                    borderColor={esActual ? 'primary' : completado ? 'success' : 'border'}
                    aria-hidden
                  >
                    {completado ? <Check size={16} /> : <Text textStyle="label-md" fontWeight="600">{numero}</Text>}
                  </Flex>
                  <Stack gap="0" align="center" display={{ base: 'none', md: 'flex' }} minW="0">
                    <Text textStyle="label-caps" color="fg.subtle">{`Paso 0${numero}`}</Text>
                    <Text textStyle="label-sm" color="inherit" textAlign="center">
                      {titulo}
                    </Text>
                  </Stack>
                </Stack>
              </Button>
            </Fragment>
          )
        })}
      </Flex>
      <Text display={{ base: 'block', md: 'none' }} mt="3" textStyle="label-md" color="primary" textAlign="center">
        {`Paso ${actual + 1} de ${TOTAL_PASOS}: ${PASOS[actual]}`}
      </Text>
      <Text srOnly aria-live="polite">
        {`Paso ${actual + 1} de ${TOTAL_PASOS}: ${PASOS[actual]}`}
      </Text>
    </Box>
  )
}

export function RegistroAbogadoPage() {
  const { documentos, cargando: cargandoDocumentos, error: errorDocumentos } = useDocumentosLegales()

  const catalogo = useConsulta(
    async () => {
      const [areas, tipos, relaciones] = await Promise.all([
        listarAreas({ soloActivas: true }),
        listarTiposCaso({ soloActivos: true }),
        listarRelacionesAreaTipoCaso(),
      ])
      return { areas, tipos, relaciones }
    },
    'catalogo-registro-abogado',
  )

  const [paso, setPaso] = useState(0)
  const [credenciales, setCredenciales] = useState<CamposCredenciales>(CREDENCIALES_VACIAS)
  const [perfil, setPerfil] = useState<CamposPerfilBase>(PERFIL_VACIO)
  const [declaraciones, setDeclaraciones] = useState<CamposDeclaraciones>(DECLARACIONES_VACIAS)
  const [verificacion, setVerificacion] = useState<CamposVerificacion>(VERIFICACION_VACIA)
  const [aceptados, setAceptados] = useState<string[]>([])

  // Constructor de especialidades del paso 2: la relación se arma con los dos selects y
  // se añade a una lista que no admite repeticiones ni supera MAX_ESPECIALIDADES.
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([])
  const [areaSeleccionada, setAreaSeleccionada] = useState('')
  const [tipoCasoSeleccionado, setTipoCasoSeleccionado] = useState('')
  const [erroresSeleccion, setErroresSeleccion] = useState<ErroresSeleccion>({})
  const [errorEspecialidad, setErrorEspecialidad] = useState<string | null>(null)

  const [erroresCredenciales, setErroresCredenciales] = useState<ErrorCredenciales>({})
  const [erroresPerfil, setErroresPerfil] = useState<ErrorPerfilPublico>({})
  const [erroresDeclaraciones, setErroresDeclaraciones] = useState<ErrorDeclaraciones>({})
  const [erroresVerificacion, setErroresVerificacion] = useState<ErrorVerificacion>({})
  const [errorAceptaciones, setErrorAceptaciones] = useState<string | null>(null)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [estadoFinal, setEstadoFinal] = useState<EstadoFinal | null>(null)

  const areas = useMemo(() => catalogo.datos?.areas ?? [], [catalogo.datos])
  const tipos = useMemo(() => catalogo.datos?.tipos ?? [], [catalogo.datos])
  const relaciones = useMemo(() => catalogo.datos?.relaciones ?? [], [catalogo.datos])

  // El contrato guarda áreas y tipos por separado: la lista de especialidades se
  // descompone en ambas listas, sin duplicados, para validar y para enviar.
  const areaIds = useMemo(() => [...new Set(especialidades.map((especialidad) => especialidad.areaId))], [especialidades])
  const tipoCasoIds = useMemo(
    () => [...new Set(especialidades.map((especialidad) => especialidad.tipoCasoId))],
    [especialidades],
  )
  // Solo se ofrecen los tipos de caso asociados al área elegida según area_tipo_caso.
  const tiposDelAreaElegida = useMemo(
    () => (areaSeleccionada ? tiposCasoDeAreas(relaciones, tipos, [areaSeleccionada]) : []),
    [relaciones, tipos, areaSeleccionada],
  )
  const alcanceLimite = especialidades.length >= MAX_ESPECIALIDADES
  const areaSinTipos = Boolean(areaSeleccionada) && tiposDelAreaElegida.length === 0

  if (estadoFinal?.tipo === 'pendiente-revision') {
    return (
      <Stack gap="8" maxW="3xl" mx="auto">
        <Card.Root>
          <Card.Body gap="5">
            <Flex align="center" gap="3">
              <Box color="primary" bg="bg.subtle" p="3" borderRadius="full">
                <BadgeCheck aria-hidden size={26} />
              </Box>
              <Stack gap="1">
                <Text textStyle="label-caps" color="secondary">INSCRIPCIÓN REGISTRADA</Text>
                <Heading as="h1" textStyle="headline-md" color="primary">
                  Tu perfil queda pendiente de revisión administrativa
                </Heading>
              </Stack>
            </Flex>
            <Text color="fg.muted">
              Registramos tu cuenta profesional, tu perfil y la primera presentación de información verificable. El perfil
              permanece <Text as="span" fontWeight="600">oculto</Text> para el público: solo se publicará si la revisión
              administrativa se aprueba y el perfil cumple las demás condiciones de actividad y visibilidad.
            </Text>
            <Alert.Root status="info">
              <Alert.Indicator>
                <Info aria-hidden size={18} />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>Sobre la revisión</Alert.Title>
                <Alert.Description>
                  La revisión consulta la fuente oficial correspondiente y registra la decisión, su fecha y su alcance.
                  Recibirás un aviso interno cuando exista una decisión. Una inscripción pendiente no equivale a una
                  verificación aprobada y un área declarada no acredita un título de especialización.
                </Alert.Description>
              </Alert.Content>
            </Alert.Root>
            <List.Root gap="2" textStyle="body-sm" color="fg.muted">
              <List.Item>Las evidencias aportadas quedan en un repositorio privado y no se publican.</List.Item>
              <List.Item>La modalidad, los horarios y las tarifas declaradas son información descriptiva.</List.Item>
              <List.Item>
                No habilitan agenda, citas, videollamadas ni cobros dentro de la plataforma.
              </List.Item>
            </List.Root>
            <Flex gap="3" wrap="wrap">
              <Button asChild>
                <Link to="/login">
                  <ArrowRight aria-hidden size={18} />
                  Ir a iniciar sesión
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/directorio">Ver el directorio público</Link>
              </Button>
            </Flex>
          </Card.Body>
        </Card.Root>
      </Stack>
    )
  }

  if (estadoFinal?.tipo === 'requiere-confirmacion') {
    return (
      <Stack gap="8" maxW="3xl" mx="auto">
        <Card.Root>
          <Card.Body gap="5" textAlign="center" alignItems="center">
            <Box color="primary" bg="bg.subtle" p="3" borderRadius="full">
              <MailCheck aria-hidden size={28} />
            </Box>
            <Heading as="h1" textStyle="headline-md" color="primary">
              Revisa tu correo para confirmar la cuenta
            </Heading>
            <Text color="fg.muted" maxW="2xl">
              Creamos la cuenta profesional de <Text as="span" fontWeight="600">{estadoFinal.correo}</Text> con tu perfil,
              tus declaraciones y la presentación de tus datos verificables. La confirmación por correo está activa: al
              abrir el enlace de confirmación podrás iniciar sesión y tu inscripción quedará pendiente de la revisión
              administrativa.
            </Text>
            <Alert.Root status="info" textAlign="left">
              <Alert.Indicator>
                <Info aria-hidden size={18} />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>Tu alta tiene dos momentos</Alert.Title>
                <Alert.Description>
                  {estadoFinal.motivo === 'registro' ? (
                    <List.Root gap="2" textStyle="body-sm">
                      <List.Item>
                        <Text as="span" fontWeight="600">1. Ahora:</Text> abre el enlace del correo para activar la cuenta y
                        entra con tu contraseña. Ya registramos tu perfil, tus áreas y tipos de caso y tus datos de
                        verificación; la inscripción queda pendiente de revisión administrativa.
                      </List.Item>
                      <List.Item>
                        <Text as="span" fontWeight="600">2. Al entrar:</Text> adjunta los soportes documentales desde «Mi perfil
                        profesional». Quedan en el almacén privado, junto a la versión que ya está pendiente, y sólo los
                        consulta la revisión administrativa.
                      </List.Item>
                    </List.Root>
                  ) : (
                    'La cuenta se creó, pero los datos profesionales no pudieron guardarse. Inicia sesión y completa el alta desde «Mi perfil profesional».'
                  )}
                </Alert.Description>
              </Alert.Content>
            </Alert.Root>
            <List.Root gap="2" textStyle="body-sm" color="fg.muted" textAlign="left" maxW="2xl">
              <List.Item>Tus aceptaciones quedan registradas con la fecha y la versión del documento aceptado.</List.Item>
              <List.Item>El enlace de confirmación es de un solo uso y caduca pasado un tiempo.</List.Item>
              <List.Item>Mientras no confirmes, tu cuenta no aparece en el directorio ni puede recibir solicitudes.</List.Item>
            </List.Root>
            <Flex gap="3" wrap="wrap" justifyContent="center">
              <Button asChild>
                <Link to="/login">
                  <ArrowRight aria-hidden size={18} />
                  Volver a iniciar sesión
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/registro">Ver otros tipos de cuenta</Link>
              </Button>
            </Flex>
          </Card.Body>
        </Card.Root>
      </Stack>
    )
  }

  function validarPaso(indice: number): boolean {
    if (indice === 0) {
      const errores = validarCredenciales(credenciales)
      setErroresCredenciales(errores)
      return Object.keys(errores).length === 0
    }
    if (indice === 1) {
      const errores = validarPerfilPublico({ ...perfil, areaIds, tipoCasoIds })
      setErroresPerfil(errores)
      return Object.keys(errores).length === 0
    }
    if (indice === 2) {
      const errores = validarDeclaraciones(declaraciones)
      setErroresDeclaraciones(errores)
      return Object.keys(errores).length === 0
    }
    if (indice === 3) {
      const errores = validarVerificacion(verificacion)
      setErroresVerificacion(errores)
      return Object.keys(errores).length === 0
    }
    return true
  }

  function irA(indice: number) {
    if (indice < 0 || indice >= TOTAL_PASOS || indice > paso) return
    setErrorGeneral(null)
    setPaso(indice)
  }

  function avanzar() {
    if (!validarPaso(paso)) return
    setErrorGeneral(null)
    setPaso((actual) => Math.min(actual + 1, TOTAL_PASOS - 1))
  }

  function retroceder() {
    setErrorGeneral(null)
    setPaso((actual) => Math.max(actual - 1, 0))
  }

  /**
   * Añade a la lista la relación elegida en los dos selects. Si falta uno de los dos
   * datos, se marca como error del campo correspondiente. La relación no se repite y la
   * lista se detiene en MAX_ESPECIALIDADES. El área elegida se conserva para poder
   * agregar varios tipos de caso de la misma área.
   */
  function agregarEspecialidad() {
    if (enviando) return

    const faltantes: ErroresSeleccion = {}
    if (!areaSeleccionada) {
      faltantes.area = 'Selecciona un área jurídica.'
    } else if (areaSinTipos) {
      faltantes.tipo = 'El área elegida no tiene tipos de caso activos. Elige otra área jurídica.'
    } else if (!tipoCasoSeleccionado) {
      faltantes.tipo = 'Selecciona un tipo de caso.'
    }
    setErroresSeleccion(faltantes)
    if (faltantes.area || faltantes.tipo) return

    if (alcanceLimite) {
      setErrorEspecialidad(MENSAJE_LIMITE_ESPECIALIDADES)
      return
    }
    if (
      especialidades.some(
        (especialidad) =>
          especialidad.areaId === areaSeleccionada && especialidad.tipoCasoId === tipoCasoSeleccionado,
      )
    ) {
      setErrorEspecialidad(
        `Esa especialidad ya está en tu lista: ${nombreArea(areaSeleccionada)} • ${nombreTipo(tipoCasoSeleccionado)}.`,
      )
      return
    }

    setEspecialidades((actual) => [...actual, { areaId: areaSeleccionada, tipoCasoId: tipoCasoSeleccionado }])
    setTipoCasoSeleccionado('')
    setErrorEspecialidad(null)
    setErroresPerfil((actual) => ({ ...actual, areaIds: undefined, tipoCasoIds: undefined }))
  }

  function quitarEspecialidad(indice: number) {
    setEspecialidades((actual) => actual.filter((_, posicion) => posicion !== indice))
    setErrorEspecialidad(null)
  }

  type ClaveDeclaracionTexto = 'formacionDeclarada' | 'horarios' | 'tarifasOrientativas' | 'modalidad'

  function actualizarDeclaracionTexto(clave: ClaveDeclaracionTexto, valor: string) {
    setDeclaraciones((actual) => ({ ...actual, [clave]: valor }))
    setErroresDeclaraciones((actual) => ({ ...actual, [clave]: undefined }))
  }

  function actualizarMedio(clave: keyof CamposDeclaraciones['mediosContacto'], valor: string) {
    setDeclaraciones((actual) => ({ ...actual, mediosContacto: { ...actual.mediosContacto, [clave]: valor } }))
    setErroresDeclaraciones((actual) => ({ ...actual, [clave]: undefined, mediosContacto: undefined }))
  }

  /** Escrituras posteriores al alta cuando el registro devolvió sesión. */
  async function completarPerfil(cuentaId: string) {
    const filaCuenta = await obtenerCuenta(cuentaId)
    if (filaCuenta.rol !== 'abogado') {
      throw new Error('La cuenta creada no tiene rol profesional. No es posible continuar con el alta.')
    }

    const perfilCreado = await crearPerfilAbogado(cuentaId, {
      nombreProfesional: perfil.nombreProfesional,
      descripcion: perfil.descripcion,
      experienciaAnios: Number(perfil.experienciaAnios.trim()),
      ciudadAtencion: perfil.ciudadAtencion,
      formacionDeclarada: declaraciones.formacionDeclarada,
      modalidad: declaraciones.modalidad,
      horarios: declaraciones.horarios,
      tarifasOrientativas: declaraciones.tarifasOrientativas,
      mediosContacto: mediosContactoJson(declaraciones.mediosContacto),
      camposPublicos: declaraciones.camposPublicos,
      visibilidad: declaraciones.ofrecerEnDirectorio ? 'publico' : 'oculto',
    })

    await declararAreasYTipos(perfilCreado.id, areaIds, tipoCasoIds)

    // La versión inicial se presenta con los datos privados; las evidencias en archivo
    // se adjuntan después desde «Mi perfil profesional», donde el titular tiene sesión.
    await presentarVersionInicial(perfilCreado.id, {
      identificacionPrivada: verificacion.identificacionPrivada,
      tarjetaProfesional: verificacion.tarjetaProfesional,
    })
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (enviando) return
    if (!validarPaso(0) || !validarPaso(1) || !validarPaso(2) || !validarPaso(3)) {
      setErrorGeneral('Revisa los pasos anteriores: hay datos que requieren corrección.')
      return
    }

    const faltantes = documentos.filter(
      (documento) => TIPOS_DOCUMENTO_REQUERIDOS.includes(documento.tipo) && !aceptados.includes(documento.id),
    )
    setErrorAceptaciones(faltantes.length > 0 ? 'Debes aceptar todos los documentos vigentes para completar el registro.' : null)
    if (faltantes.length > 0) return

    setEnviando(true)
    setErrorGeneral(null)
    try {
      const resultado = await registrarCuenta({
        rol: 'abogado',
        nombreCompleto: credenciales.nombreCompleto,
        correo: credenciales.correo,
        contrasena: credenciales.contrasena,
        telefono: credenciales.telefono,
        documentoIds: aceptados,
        // Con la confirmación por correo activa no habrá sesión: el trigger del alta
        // crea el perfil, las declaraciones y la versión inicial con estos datos.
        // Las claves son los nombres del esquema que lee ese trigger.
        perfilProfesional: {
          nombre_profesional: perfil.nombreProfesional.trim(),
          descripcion: perfil.descripcion.trim(),
          experiencia_anios: Number(perfil.experienciaAnios.trim()),
          ciudad_atencion: perfil.ciudadAtencion.trim(),
          formacion_declarada: declaraciones.formacionDeclarada,
          modalidad: declaraciones.modalidad,
          horarios: declaraciones.horarios,
          tarifas_orientativas: declaraciones.tarifasOrientativas,
          medios_contacto: mediosContactoJson(declaraciones.mediosContacto),
          campos_opcionales_publicos: declaraciones.camposPublicos,
          // Autorización expresa de publicación: el trigger la aplica como visibilidad.
          // No publica nada por sí sola (la búsqueda exige verificación aprobada).
          visibilidad: declaraciones.ofrecerEnDirectorio ? 'publico' : 'oculto',
          areas: areaIds,
          tipos_caso: tipoCasoIds,
          identificacion_privada: verificacion.identificacionPrivada.trim(),
          tarjeta_profesional: verificacion.tarjetaProfesional.trim(),
        },
      })

      if (resultado.requiereConfirmacion || !resultado.usuarioId) {
        setEstadoFinal({
          tipo: 'requiere-confirmacion',
          correo: credenciales.correo.trim().toLowerCase(),
          // Si el servidor no guardó los datos profesionales, el trigger no pudo crear
          // el perfil: se informa para completarlo desde «Mi perfil profesional».
          motivo: resultado.perfilRecibido ? 'registro' : 'perfil-posterior',
        })
        return
      }

      try {
        await completarPerfil(resultado.usuarioId)
        setEstadoFinal({ tipo: 'pendiente-revision' })
      } catch (falloPerfil: unknown) {
        setEstadoFinal({
          tipo: 'requiere-confirmacion',
          correo: credenciales.correo.trim().toLowerCase(),
          motivo: 'perfil-posterior',
        })
        setErrorGeneral(
          mensajeDeError(
            falloPerfil,
            'La cuenta se creó, pero no pudimos guardar tu perfil profesional. Inicia sesión y completa el alta desde tu perfil.',
          ),
        )
      }
    } catch (fallo: unknown) {
      setErrorGeneral(
        esCorreoDuplicado(fallo)
          ? 'Ya existe una cuenta registrada con este correo. Inicia sesión o recupera tu contraseña.'
          : mensajeDeError(fallo, 'No pudimos completar tu registro. Inténtalo de nuevo.'),
      )
    } finally {
      setEnviando(false)
    }
  }

  const nombreArea = (id: string) => areas.find((area) => area.id === id)?.nombre ?? id
  const nombreTipo = (id: string) => tipos.find((tipo) => tipo.id === id)?.nombre_cotidiano ?? id
  /** Etiqueta visible de una relación: «Área • Tipo de caso». */
  const etiquetaEspecialidad = (especialidad: Especialidad) =>
    `${nombreArea(especialidad.areaId)} • ${nombreTipo(especialidad.tipoCasoId)}`

  return (
    <Stack gap="8" maxW="4xl" mx="auto">
      <Stack gap="2">
        <Text textStyle="label-caps" color="secondary">REGISTRO PROFESIONAL</Text>
        <Heading as="h1" textStyle={{ base: 'headline-lg-mobile', md: 'headline-lg' }} color="primary">
          Crea tu cuenta de abogado
        </Heading>
        <Text color="fg.muted">
          Cinco pasos: credenciales, perfil público, declaraciones informativas, información de verificación y aceptaciones.
          La inscripción queda pendiente de revisión administrativa y no se publica automáticamente.
        </Text>
      </Stack>

      <IndicadorPasos actual={paso} irA={irA} />

      {errorGeneral && (
        <Alert.Root status="error" role="alert">
          <Alert.Indicator>
            <AlertCircle aria-hidden size={18} />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>No se pudo completar la operación</Alert.Title>
            <Alert.Description>{errorGeneral}</Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}

      <form onSubmit={enviar} noValidate>
        <Card.Root>
          <Card.Body gap="6">
            {paso === 0 && (
              <Stack gap="5">
                <Stack gap="1">
                  <Heading as="h2" textStyle="title-md">Credenciales de acceso</Heading>
                  <Text textStyle="body-sm" color="fg.muted">
                    Estos datos crean tu cuenta. Usaremos el correo para las comunicaciones y la confirmación del registro.
                  </Text>
                </Stack>

                <Field.Root invalid={Boolean(erroresCredenciales.nombreCompleto)}>
                  <Field.Label>Nombre completo</Field.Label>
                  <Input
                    value={credenciales.nombreCompleto}
                    autoComplete="name"
                    disabled={enviando}
                    maxLength={LIMITES_REGISTRO.nombre}
                    onChange={(evento) => {
                      setCredenciales((actual) => ({ ...actual, nombreCompleto: evento.target.value }))
                      setErroresCredenciales((actual) => ({ ...actual, nombreCompleto: undefined }))
                    }}
                    placeholder="Nombre y apellidos"
                  />
                  {erroresCredenciales.nombreCompleto ? (
                    <Field.ErrorText>{erroresCredenciales.nombreCompleto}</Field.ErrorText>
                  ) : (
                    <Field.HelperText>Escribe nombre y apellido, hasta 200 caracteres.</Field.HelperText>
                  )}
                </Field.Root>

                <Field.Root invalid={Boolean(erroresCredenciales.correo)}>
                  <Field.Label>Correo electrónico profesional</Field.Label>
                  <Input
                    type="email"
                    value={credenciales.correo}
                    autoComplete="email"
                    disabled={enviando}
                    maxLength={LIMITES_REGISTRO.correo}
                    onChange={(evento) => {
                      setCredenciales((actual) => ({ ...actual, correo: evento.target.value }))
                      setErroresCredenciales((actual) => ({ ...actual, correo: undefined }))
                    }}
                    placeholder="nombre@correo.com"
                  />
                  {erroresCredenciales.correo ? (
                    <Field.ErrorText>{erroresCredenciales.correo}</Field.ErrorText>
                  ) : (
                    <Field.HelperText>Recibirás aquí el enlace de confirmación de la cuenta.</Field.HelperText>
                  )}
                </Field.Root>

                <Field.Root invalid={Boolean(erroresCredenciales.contrasena)}>
                  <Field.Label>Contraseña</Field.Label>
                  <Input
                    type="password"
                    value={credenciales.contrasena}
                    autoComplete="new-password"
                    disabled={enviando}
                    onChange={(evento) => {
                      setCredenciales((actual) => ({ ...actual, contrasena: evento.target.value }))
                      setErroresCredenciales((actual) => ({ ...actual, contrasena: undefined }))
                    }}
                  />
                  {erroresCredenciales.contrasena && (
                    <Field.ErrorText>{erroresCredenciales.contrasena}</Field.ErrorText>
                  )}
                  <RequisitosContrasena valor={credenciales.contrasena} />
                </Field.Root>

                <Field.Root invalid={Boolean(erroresCredenciales.confirmacion)}>
                  <Field.Label>Confirmar contraseña</Field.Label>
                  <Input
                    type="password"
                    value={credenciales.confirmacion}
                    autoComplete="new-password"
                    disabled={enviando}
                    onChange={(evento) => {
                      setCredenciales((actual) => ({ ...actual, confirmacion: evento.target.value }))
                      setErroresCredenciales((actual) => ({ ...actual, confirmacion: undefined }))
                    }}
                  />
                  {erroresCredenciales.confirmacion && <Field.ErrorText>{erroresCredenciales.confirmacion}</Field.ErrorText>}
                </Field.Root>

                <Field.Root invalid={Boolean(erroresCredenciales.telefono)}>
                  <Field.Label>Teléfono (opcional)</Field.Label>
                  <Input
                    type="tel"
                    value={credenciales.telefono}
                    autoComplete="tel"
                    disabled={enviando}
                    maxLength={LIMITES_REGISTRO.telefonoFormatoMax}
                    onChange={(evento) => {
                      setCredenciales((actual) => ({ ...actual, telefono: evento.target.value }))
                      setErroresCredenciales((actual) => ({ ...actual, telefono: undefined }))
                    }}
                    placeholder="+57 300 000 0000"
                  />
                  {erroresCredenciales.telefono ? (
                    <Field.ErrorText>{erroresCredenciales.telefono}</Field.ErrorText>
                  ) : (
                    <Field.HelperText>Entre 7 y 15 dígitos; puedes dejarlo vacío.</Field.HelperText>
                  )}
                </Field.Root>
              </Stack>
            )}

            {paso === 1 && (
              <Stack gap="5">
                <Stack gap="1">
                  <Heading as="h2" textStyle="title-md">Perfil público</Heading>
                  <Text textStyle="body-sm" color="fg.muted">
                    Así te verán en el directorio cuando tu verificación sea aprobada y el perfil esté visible.
                  </Text>
                </Stack>

                <Field.Root invalid={Boolean(erroresPerfil.nombreProfesional)}>
                  <Field.Label>Nombre profesional</Field.Label>
                  <Input
                    value={perfil.nombreProfesional}
                    disabled={enviando}
                    maxLength={LIMITES_REGISTRO.nombreProfesional}
                    onChange={(evento) => {
                      setPerfil((actual) => ({ ...actual, nombreProfesional: evento.target.value }))
                      setErroresPerfil((actual) => ({ ...actual, nombreProfesional: undefined }))
                    }}
                    placeholder="Como quieres aparecer en el directorio"
                  />
                  {erroresPerfil.nombreProfesional && <Field.ErrorText>{erroresPerfil.nombreProfesional}</Field.ErrorText>}
                </Field.Root>

                <Field.Root invalid={Boolean(erroresPerfil.ciudadAtencion)}>
                  <Field.Label>Ciudad de atención</Field.Label>
                  <Input
                    value={perfil.ciudadAtencion}
                    disabled={enviando}
                    maxLength={LIMITES_REGISTRO.ciudad}
                    onChange={(evento) => {
                      setPerfil((actual) => ({ ...actual, ciudadAtencion: evento.target.value }))
                      setErroresPerfil((actual) => ({ ...actual, ciudadAtencion: undefined }))
                    }}
                    placeholder="Ciudad principal donde atiendes"
                  />
                  {erroresPerfil.ciudadAtencion && <Field.ErrorText>{erroresPerfil.ciudadAtencion}</Field.ErrorText>}
                </Field.Root>

                <Field.Root invalid={Boolean(erroresPerfil.experienciaAnios)}>
                  <Field.Label>Años de experiencia</Field.Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={999}
                    value={perfil.experienciaAnios}
                    disabled={enviando}
                    onChange={(evento) => {
                      setPerfil((actual) => ({ ...actual, experienciaAnios: evento.target.value }))
                      setErroresPerfil((actual) => ({ ...actual, experienciaAnios: undefined }))
                    }}
                  />
                  {erroresPerfil.experienciaAnios ? (
                    <Field.ErrorText>{erroresPerfil.experienciaAnios}</Field.ErrorText>
                  ) : (
                    <Field.HelperText>Incluye cero si aún no tienes experiencia.</Field.HelperText>
                  )}
                </Field.Root>

                <Field.Root invalid={Boolean(erroresPerfil.descripcion)}>
                  <Field.Label>Descripción profesional</Field.Label>
                  <Textarea
                    rows={5}
                    value={perfil.descripcion}
                    disabled={enviando}
                    maxLength={LIMITES_REGISTRO.descripcionMax}
                    onChange={(evento) => {
                      setPerfil((actual) => ({ ...actual, descripcion: evento.target.value }))
                      setErroresPerfil((actual) => ({ ...actual, descripcion: undefined }))
                    }}
                    placeholder="Describe tu práctica profesional sin prometer resultados."
                  />
                  {erroresPerfil.descripcion ? (
                    <Field.ErrorText>{erroresPerfil.descripcion}</Field.ErrorText>
                  ) : (
                    <Field.HelperText>
                      {`${perfil.descripcion.trim().length} de 500 caracteres. Mínimo 50.`}
                    </Field.HelperText>
                  )}
                </Field.Root>

                {catalogo.cargando ? (
                  <FeedbackState kind="loading" title="Cargando el catálogo jurídico" />
                ) : catalogo.error ? (
                  <FeedbackState
                    kind="error"
                    title="No pudimos cargar el catálogo"
                    description={catalogo.error}
                    action={<Button onClick={() => catalogo.recargar()}>Reintentar</Button>}
                  />
                ) : areas.length === 0 ? (
                  <FeedbackState
                    kind="empty"
                    title="No hay áreas jurídicas activas"
                    description="El catálogo no tiene áreas disponibles para nuevos registros."
                  />
                ) : relaciones.length === 0 ? (
                  <FeedbackState
                    kind="empty"
                    title="Sin tipos de caso asociados a las áreas"
                    description="El catálogo no relaciona las áreas activas con tipos de caso, así que no es posible declarar especialidades todavía."
                  />
                ) : (
                  <>
                    <Fieldset.Root invalid={Boolean(erroresPerfil.areaIds || erroresSeleccion.area)}>
                      <Fieldset.Legend>Áreas jurídicas que atiendes</Fieldset.Legend>
                      <NativeSelect.Root disabled={enviando}>
                        <NativeSelect.Field
                          value={areaSeleccionada}
                          onChange={(evento) => {
                            setAreaSeleccionada(evento.target.value)
                            // El tipo de caso pertenece al área: al cambiarla se descarta.
                            setTipoCasoSeleccionado('')
                            setErrorEspecialidad(null)
                            setErroresSeleccion({})
                            setErroresPerfil((actual) => ({ ...actual, areaIds: undefined }))
                          }}
                        >
                          <option value="">Selecciona un área jurídica</option>
                          {areas.map((area) => (
                            <option key={area.id} value={area.id}>{area.nombre}</option>
                          ))}
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                      </NativeSelect.Root>
                      {(erroresPerfil.areaIds || erroresSeleccion.area) && (
                        <Fieldset.ErrorText>{erroresPerfil.areaIds ?? erroresSeleccion.area}</Fieldset.ErrorText>
                      )}
                      <Fieldset.HelperText>
                        Un área declarada no acredita un título de especialización.
                      </Fieldset.HelperText>
                    </Fieldset.Root>

                    <Fieldset.Root invalid={Boolean(erroresPerfil.tipoCasoIds || erroresSeleccion.tipo)}>
                      <Fieldset.Legend>Tipos de caso que atiendes</Fieldset.Legend>
                      <NativeSelect.Root disabled={enviando || !areaSeleccionada || areaSinTipos}>
                        <NativeSelect.Field
                          value={tipoCasoSeleccionado}
                          onChange={(evento) => {
                            setTipoCasoSeleccionado(evento.target.value)
                            setErrorEspecialidad(null)
                            setErroresSeleccion((actual) => ({ ...actual, tipo: undefined }))
                            setErroresPerfil((actual) => ({ ...actual, tipoCasoIds: undefined }))
                          }}
                        >
                          <option value="">
                            {!areaSeleccionada
                              ? 'Elige primero un área jurídica'
                              : areaSinTipos
                                ? 'El área elegida no tiene tipos de caso activos'
                                : 'Selecciona un tipo de caso'}
                          </option>
                          {tiposDelAreaElegida.map((tipo) => (
                            <option key={tipo.id} value={tipo.id}>{tipo.nombre_cotidiano}</option>
                          ))}
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                      </NativeSelect.Root>
                      {(erroresPerfil.tipoCasoIds || erroresSeleccion.tipo) && (
                        <Fieldset.ErrorText>{erroresPerfil.tipoCasoIds ?? erroresSeleccion.tipo}</Fieldset.ErrorText>
                      )}
                      <Fieldset.HelperText>
                        {areaSeleccionada
                          ? 'Solo se ofrecen los tipos de caso asociados al área elegida.'
                          : 'Este campo permanece desactivado hasta que elijas un área jurídica.'}
                      </Fieldset.HelperText>
                    </Fieldset.Root>

                    <Stack gap="4" borderTopWidth="1px" pt="5">
                      <Alert.Root status="info">
                        <Alert.Indicator>
                          <Info aria-hidden size={18} />
                        </Alert.Indicator>
                        <Alert.Content>
                          <Alert.Description>{MENSAJE_INFO_ESPECIALIDADES}</Alert.Description>
                        </Alert.Content>
                      </Alert.Root>

                      <Flex gap="3" wrap="wrap" align="center">
                        <Button
                          type="button"
                          onClick={agregarEspecialidad}
                          disabled={enviando || alcanceLimite}
                        >
                          <Plus aria-hidden size={16} />
                          Añadir especialidad
                        </Button>
                        <Text textStyle="body-sm" color="fg.muted" aria-live="polite">
                          {`${especialidades.length} de ${MAX_ESPECIALIDADES} especialidades agregadas`}
                        </Text>
                      </Flex>

                      {errorEspecialidad && (
                        <Text textStyle="body-sm" color="fg.error" role="alert" fontWeight="500">
                          {errorEspecialidad}
                        </Text>
                      )}

                      {alcanceLimite && (
                        <Alert.Root status="warning" role="status">
                          <Alert.Indicator>
                            <Info aria-hidden size={18} />
                          </Alert.Indicator>
                          <Alert.Content>
                            <Alert.Title>Límite alcanzado</Alert.Title>
                            <Alert.Description>{MENSAJE_LIMITE_ESPECIALIDADES}</Alert.Description>
                          </Alert.Content>
                        </Alert.Root>
                      )}

                      {especialidades.length > 0 ? (
                        <Stack gap="2">
                          <Text textStyle="label-caps" color="fg.muted">ESPECIALIDADES AGREGADAS</Text>
                          <Flex gap="2" wrap="wrap">
                            {especialidades.map((especialidad, indice) => {
                              const etiqueta = etiquetaEspecialidad(especialidad)
                              return (
                                <Tag.Root
                                  key={`${especialidad.areaId}-${especialidad.tipoCasoId}`}
                                  colorPalette="brand"
                                  size="lg"
                                >
                                  <Tag.Label>{etiqueta}</Tag.Label>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="2xs"
                                    boxSize="5"
                                    minW="5"
                                    p="0"
                                    borderRadius="full"
                                    aria-label={`Quitar la especialidad ${etiqueta}`}
                                    disabled={enviando}
                                    onClick={() => quitarEspecialidad(indice)}
                                  >
                                    <X aria-hidden size={12} />
                                  </Button>
                                </Tag.Root>
                              )
                            })}
                          </Flex>
                        </Stack>
                      ) : (
                        <Text textStyle="body-sm" color="fg.muted">
                          Todavía no agregaste especialidades. Elige un área jurídica y un tipo de caso, y pulsa
                          «Añadir especialidad».
                        </Text>
                      )}
                    </Stack>
                  </>
                )}
              </Stack>
            )}

            {paso === 2 && (
              <Stack gap="5">
                <Stack gap="1">
                  <Heading as="h2" textStyle="title-md">Declaraciones informativas</Heading>
                  <Text textStyle="body-sm" color="fg.muted">
                    Estos datos son descriptivos. Se muestran solo si autorizas su publicación y no habilitan agenda, citas,
                    videollamadas ni cobros dentro de la plataforma.
                  </Text>
                </Stack>

                <Field.Root invalid={Boolean(erroresDeclaraciones.formacionDeclarada)}>
                  <Field.Label>Formación declarada (opcional)</Field.Label>
                  <Textarea
                    rows={3}
                    value={declaraciones.formacionDeclarada}
                    disabled={enviando}
                    maxLength={LIMITES_REGISTRO.formacion}
                    onChange={(evento) => actualizarDeclaracionTexto('formacionDeclarada', evento.target.value)}
                    placeholder="Formación que declaras. No acredita un título de especialización."
                  />
                  <Field.ErrorText>{erroresDeclaraciones.formacionDeclarada}</Field.ErrorText>
                </Field.Root>

                <Field.Root invalid={Boolean(erroresDeclaraciones.modalidad)}>
                  <Field.Label>Modalidad de atención (opcional)</Field.Label>
                  <NativeSelect.Root disabled={enviando}>
                    <NativeSelect.Field
                      value={declaraciones.modalidad}
                      onChange={(evento) => actualizarDeclaracionTexto('modalidad', evento.target.value)}
                    >
                      <option value="">Sin especificar</option>
                      <option value="Presencial">Presencial</option>
                      <option value="Virtual">Virtual</option>
                      <option value="Presencial y virtual">Presencial y virtual</option>
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                  <Field.HelperText>Información descriptiva; no habilita salas de videollamada.</Field.HelperText>
                  <Field.ErrorText>{erroresDeclaraciones.modalidad}</Field.ErrorText>
                </Field.Root>

                <Field.Root invalid={Boolean(erroresDeclaraciones.horarios)}>
                  <Field.Label>Horarios de atención (opcional)</Field.Label>
                  <Input
                    value={declaraciones.horarios}
                    disabled={enviando}
                    maxLength={LIMITES_REGISTRO.horarios}
                    onChange={(evento) => actualizarDeclaracionTexto('horarios', evento.target.value)}
                    placeholder="Por ejemplo: lunes a viernes de 8:00 a 17:00"
                  />
                  <Field.ErrorText>{erroresDeclaraciones.horarios}</Field.ErrorText>
                </Field.Root>

                <Field.Root invalid={Boolean(erroresDeclaraciones.tarifasOrientativas)}>
                  <Field.Label>Tarifas orientativas (opcional)</Field.Label>
                  <Input
                    value={declaraciones.tarifasOrientativas}
                    disabled={enviando}
                    maxLength={LIMITES_REGISTRO.tarifas}
                    onChange={(evento) => actualizarDeclaracionTexto('tarifasOrientativas', evento.target.value)}
                    placeholder="Información descriptiva; no es una funcionalidad de cobro"
                  />
                  <Field.ErrorText>{erroresDeclaraciones.tarifasOrientativas}</Field.ErrorText>
                </Field.Root>

                <Field.Root invalid={Boolean(erroresDeclaraciones.mediosContacto)} as="fieldset">
                  <Field.Label as="legend">Medios de contacto (opcional)</Field.Label>
                  <Stack gap="4">
                    <Field.Root invalid={Boolean(erroresDeclaraciones.correo)}>
                      <Field.Label>Correo</Field.Label>
                      <Input
                        type="email"
                        value={declaraciones.mediosContacto.correo}
                        disabled={enviando}
                        maxLength={LIMITES_REGISTRO.correo}
                        onChange={(evento) => actualizarMedio('correo', evento.target.value)}
                      />
                      <Field.ErrorText>{erroresDeclaraciones.correo}</Field.ErrorText>
                    </Field.Root>
                    <Field.Root invalid={Boolean(erroresDeclaraciones.telefono)}>
                      <Field.Label>Teléfono</Field.Label>
                      <Input
                        type="tel"
                        value={declaraciones.mediosContacto.telefono}
                        disabled={enviando}
                        maxLength={LIMITES_REGISTRO.telefonoFormatoMax}
                        onChange={(evento) => actualizarMedio('telefono', evento.target.value)}
                      />
                      <Field.ErrorText>{erroresDeclaraciones.telefono}</Field.ErrorText>
                    </Field.Root>
                    <Field.Root invalid={Boolean(erroresDeclaraciones.whatsapp)}>
                      <Field.Label>WhatsApp</Field.Label>
                      <Input
                        type="tel"
                        value={declaraciones.mediosContacto.whatsapp}
                        disabled={enviando}
                        maxLength={LIMITES_REGISTRO.telefonoFormatoMax}
                        onChange={(evento) => actualizarMedio('whatsapp', evento.target.value)}
                      />
                      <Field.ErrorText>{erroresDeclaraciones.whatsapp}</Field.ErrorText>
                    </Field.Root>
                    <Field.Root invalid={Boolean(erroresDeclaraciones.sitioWeb)}>
                      <Field.Label>Sitio web</Field.Label>
                      <Input
                        value={declaraciones.mediosContacto.sitioWeb}
                        disabled={enviando}
                        maxLength={LIMITES_REGISTRO.sitioWeb}
                        onChange={(evento) => actualizarMedio('sitioWeb', evento.target.value)}
                        placeholder="https://"
                      />
                      <Field.ErrorText>{erroresDeclaraciones.sitioWeb}</Field.ErrorText>
                    </Field.Root>
                  </Stack>
                  {erroresDeclaraciones.mediosContacto && (
                    <Field.ErrorText>{erroresDeclaraciones.mediosContacto}</Field.ErrorText>
                  )}
                </Field.Root>

                <Fieldset.Root>
                  <Fieldset.Legend>Publicación en el directorio</Fieldset.Legend>
                  <Fieldset.HelperText>
                    Aprobar la verificación no publica el perfil por sí solo: la búsqueda pública exige además que la
                    publicación esté activa y el perfil activo. Podrás ocultarlo o volver a mostrarlo cuando quieras desde
                    Privacidad.
                  </Fieldset.HelperText>
                  <Fieldset.Content>
                    <Checkbox.Root
                      checked={declaraciones.ofrecerEnDirectorio}
                      disabled={enviando}
                      onCheckedChange={(detalles) =>
                        setDeclaraciones((actual) => ({ ...actual, ofrecerEnDirectorio: detalles.checked === true }))
                      }
                      alignItems="start"
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control mt="0.5" />
                      <Checkbox.Label fontWeight="400">
                        Quiero que mi perfil se ofrezca en el directorio público cuando se apruebe mi verificación
                      </Checkbox.Label>
                    </Checkbox.Root>
                  </Fieldset.Content>
                </Fieldset.Root>

                <Fieldset.Root>
                  <Fieldset.Legend>Qué campos autorizas publicar</Fieldset.Legend>
                  <Text textStyle="body-sm" color="fg.muted">
                    Solo los campos marcados pueden mostrarse en tu perfil público. Los datos de verificación nunca se
                    publican.
                  </Text>
                  <Stack gap="3" pt="2">
                    {CAMPOS_OPCIONALES.map((campo) => (
                      <Checkbox.Root
                        key={campo.clave}
                        checked={declaraciones.camposPublicos[campo.clave] === true}
                        disabled={enviando}
                        onCheckedChange={(detalles) =>
                          setDeclaraciones((actual) => ({
                            ...actual,
                            camposPublicos: { ...actual.camposPublicos, [campo.clave]: detalles.checked === true },
                          }))
                        }
                        alignItems="start"
                      >
                        <Checkbox.HiddenInput />
                        <Checkbox.Control mt="0.5" />
                        <Checkbox.Label fontWeight="400">
                          <Text as="span" fontWeight="600">{campo.etiqueta}</Text>
                          <Text as="span" color="fg.muted" display="block" textStyle="body-sm">{campo.ayuda}</Text>
                        </Checkbox.Label>
                      </Checkbox.Root>
                    ))}
                  </Stack>
                </Fieldset.Root>
              </Stack>
            )}

            {paso === 3 && (
              <Stack gap="5">
                <Stack gap="1">
                  <Heading as="h2" textStyle="title-md">Información de verificación</Heading>
                  <Text textStyle="body-sm" color="fg.muted">
                    Estos campos son privados. Solo la revisión administrativa autorizada puede consultarlos y nunca se
                    muestran en tu perfil público.
                  </Text>
                </Stack>

                <Alert.Root status="info">
                  <Alert.Indicator>
                    <Lock aria-hidden size={18} />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>Documentos privados</Alert.Title>
                    <Alert.Description>
                      La identificación y la tarjeta profesional se conservan en un repositorio privado bajo tu
                      identificador y no se publican en el directorio. Los soportes en archivo se adjuntan después de
                      activar la cuenta.
                    </Alert.Description>
                  </Alert.Content>
                </Alert.Root>

                <Field.Root invalid={Boolean(erroresVerificacion.identificacionPrivada)}>
                  <Field.Label>Número de identificación</Field.Label>
                  <Input
                    value={verificacion.identificacionPrivada}
                    disabled={enviando}
                    maxLength={LIMITES_REGISTRO.identificacionMax}
                    onChange={(evento) => {
                      setVerificacion((actual) => ({ ...actual, identificacionPrivada: evento.target.value }))
                      setErroresVerificacion((actual) => ({ ...actual, identificacionPrivada: undefined }))
                    }}
                  />
                  {erroresVerificacion.identificacionPrivada ? (
                    <Field.ErrorText>{erroresVerificacion.identificacionPrivada}</Field.ErrorText>
                  ) : (
                    <Field.HelperText>
                      Entre 3 y 40 letras, números, espacios, puntos o guiones.
                    </Field.HelperText>
                  )}
                </Field.Root>

                <Field.Root invalid={Boolean(erroresVerificacion.tarjetaProfesional)}>
                  <Field.Label>Número de tarjeta profesional</Field.Label>
                  <Input
                    value={verificacion.tarjetaProfesional}
                    disabled={enviando}
                    maxLength={LIMITES_REGISTRO.identificacionMax}
                    onChange={(evento) => {
                      setVerificacion((actual) => ({ ...actual, tarjetaProfesional: evento.target.value }))
                      setErroresVerificacion((actual) => ({ ...actual, tarjetaProfesional: undefined }))
                    }}
                  />
                  {erroresVerificacion.tarjetaProfesional ? (
                    <Field.ErrorText>{erroresVerificacion.tarjetaProfesional}</Field.ErrorText>
                  ) : (
                    <Field.HelperText>
                      Tal como figura en el documento emitido por la autoridad competente; entre 3 y 40 letras, números,
                      espacios, puntos o guiones.
                    </Field.HelperText>
                  )}
                </Field.Root>

                <Alert.Root status="info">
                  <Alert.Indicator>
                    <Info aria-hidden size={18} />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>Los soportes documentales se adjuntan al activar la cuenta</Alert.Title>
                    <Alert.Description>
                      La identificación y la tarjeta profesional quedan registradas con estos datos. Los archivos (PDF, JPEG
                      o PNG de hasta 10 MB) van a un almacén privado que exige tu sesión, así que no pueden subirse en este
                      momento: se adjuntan al confirmar el correo, desde «Mi perfil profesional», a la versión que quedará
                      pendiente de revisión. Tenlos a mano para ese paso.
                    </Alert.Description>
                  </Alert.Content>
                </Alert.Root>
              </Stack>
            )}

            {paso === 4 && (
              <Stack gap="6">
                <Stack gap="1">
                  <Heading as="h2" textStyle="title-md">Aceptaciones y resumen</Heading>
                  <Text textStyle="body-sm" color="fg.muted">
                    Revisa el resumen y acepta los documentos vigentes. Después de enviar, tu inscripción queda pendiente de
                    revisión administrativa.
                  </Text>
                </Stack>

                {cargandoDocumentos ? (
                  <FeedbackState kind="loading" title="Cargando los documentos vigentes" />
                ) : errorDocumentos ? (
                  <FeedbackState kind="error" title="No pudimos cargar los documentos legales" description={errorDocumentos} />
                ) : (
                  <AceptacionesLegales
                    documentos={documentos}
                    seleccionados={aceptados}
                    alCambiar={(ids) => {
                      setAceptados(ids)
                      setErrorAceptaciones(null)
                    }}
                    error={errorAceptaciones ?? undefined}
                    deshabilitado={enviando}
                  />
                )}

                <Stack gap="4" borderTopWidth="1px" pt="5">
                  <Heading as="h3" textStyle="title-sm">Resumen del registro</Heading>
                  <ListaDatos
                    orientacion="vertical"
                    items={[
                      { etiqueta: 'Nombre completo', valor: credenciales.nombreCompleto },
                      { etiqueta: 'Correo de la cuenta', valor: credenciales.correo },
                      { etiqueta: 'Nombre profesional', valor: perfil.nombreProfesional },
                      { etiqueta: 'Ciudad de atención', valor: perfil.ciudadAtencion },
                      { etiqueta: 'Años de experiencia', valor: perfil.experienciaAnios },
                      { etiqueta: 'Áreas jurídicas', valor: areaIds.map(nombreArea).join(', ') },
                      { etiqueta: 'Tipos de caso', valor: tipoCasoIds.map(nombreTipo).join(', ') },
                      {
                        etiqueta: 'Especialidades declaradas',
                        valor: especialidades.map(etiquetaEspecialidad).join('; '),
                      },
                      { etiqueta: 'Modalidad declarada', valor: declaraciones.modalidad },
                      { etiqueta: 'Horarios declarados', valor: declaraciones.horarios },
                      { etiqueta: 'Tarifas orientativas', valor: declaraciones.tarifasOrientativas },
                      { etiqueta: 'Soportes documentales', valor: 'Se adjuntan al activar la cuenta' },
                      {
                        etiqueta: 'Publicación en el directorio',
                        valor: declaraciones.ofrecerEnDirectorio
                          ? 'Autorizada al aprobarse la verificación'
                          : 'No autorizada: podrás activarla desde Privacidad',
                      },
                      {
                        etiqueta: 'Campos que autorizas publicar',
                        valor: CAMPOS_OPCIONALES.filter((campo) => declaraciones.camposPublicos[campo.clave] === true)
                          .map((campo) => campo.etiqueta)
                          .join(', '),
                      },
                    ]}
                  />
                  <Alert.Root status="warning">
                    <Alert.Indicator>
                      <ShieldCheck aria-hidden size={18} />
                    </Alert.Indicator>
                    <Alert.Content>
                      <Alert.Title>Alcance de la inscripción</Alert.Title>
                      <Alert.Description>
                        La cuenta y el perfil quedan pendientes de revisión. El perfil permanece oculto y no aparece en el
                        directorio hasta que exista una verificación aprobada. No se crea una cita ni un contrato por
                        registrarte.
                      </Alert.Description>
                    </Alert.Content>
                  </Alert.Root>
                </Stack>
              </Stack>
            )}
          </Card.Body>

          <Card.Footer borderTopWidth="1px" pt="4">
            <Flex justify="space-between" align="center" gap="3" width="full" flexWrap="wrap">
              <Button type="button" variant="ghost" onClick={retroceder} disabled={paso === 0 || enviando}>
                <ArrowLeft aria-hidden size={16} />
                Atrás
              </Button>
              <Text textStyle="body-sm" color="fg.muted">{`Paso ${paso + 1} de ${TOTAL_PASOS}`}</Text>
              {paso < TOTAL_PASOS - 1 ? (
                <Button type="button" onClick={avanzar} disabled={enviando}>
                  Siguiente
                  <ArrowRight aria-hidden size={16} />
                </Button>
              ) : (
                <Button type="submit" loading={enviando} loadingText="Enviando tu inscripción">
                  <Send aria-hidden size={16} />
                  Enviar inscripción
                </Button>
              )}
            </Flex>
          </Card.Footer>
        </Card.Root>
      </form>

      <Stack gap="2">
        <Flex gap="3" wrap="wrap" align="center">
          <Button asChild variant="ghost" size="sm">
            <Link to="/registro">
              <ArrowLeft aria-hidden size={16} />
              Ver otros tipos de cuenta
            </Link>
          </Button>
          <ChakraLink asChild textStyle="body-sm" color="primary">
            <Link to="/login">Ya tengo una cuenta</Link>
          </ChakraLink>
        </Flex>
        <Flex gap="2" align="start" color="fg.muted">
          <Circle aria-hidden size={8} style={{ marginTop: 6 }} />
          <Text textStyle="body-sm">
            Si tu cuenta no tiene perfil y ya confirmaste el correo, puedes completar el alta profesional desde tu perfil al
            iniciar sesión.
          </Text>
        </Flex>
      </Stack>
    </Stack>
  )
}
