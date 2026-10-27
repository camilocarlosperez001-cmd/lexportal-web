import { useState } from 'react'
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Dialog,
  Field,
  Flex,
  Heading,
  Input,
  NativeSelect,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
} from '@chakra-ui/react'
import { AlertTriangle, Link2, Pencil, Plus, PowerOff, Trash2 } from 'lucide-react'
import { FeedbackState } from '../../../components/shared/FeedbackState'
import { PageHeader } from '../../../components/shared/PageHeader'
import { toaster } from '../../../components/ui/toaster-store'
import { useConsulta } from '../../../hooks/useConsulta'
import { esErrorDePermiso, mensajeDeError } from '../../../utils/errores'
import { validarTextoRequerido } from '../../../utils/validaciones'
import {
  listarAreas,
  listarRelacionesAreaTipoCaso,
  listarRelacionesTerminoArea,
  listarRelacionesTerminoTipoCaso,
  listarTerminos,
  listarTiposCaso,
  type AreaJuridica,
  type RelacionAreaTipoCaso,
  type RelacionTerminoArea,
  type RelacionTerminoTipoCaso,
  type TerminoBusqueda,
  type TipoCaso,
} from '../services/catalogo'
import {
  actualizarArea,
  actualizarTermino,
  actualizarTipoCaso,
  crearArea,
  crearRelacionAreaTipoCaso,
  crearRelacionTerminoArea,
  crearRelacionTerminoTipoCaso,
  crearTermino,
  crearTipoCaso,
  eliminarRelacionAreaTipoCaso,
  eliminarRelacionTerminoArea,
  eliminarRelacionTerminoTipoCaso,
  obtenerUsoCatalogo,
  type UsoCatalogo,
} from '../services/administracion'

const LONGITUD_MAXIMA_ETIQUETA = 120

type Pestana = 'areas' | 'tipos' | 'terminos' | 'relaciones'

type DatosCatalogo = {
  areas: AreaJuridica[]
  tipos: TipoCaso[]
  terminos: TerminoBusqueda[]
  areaTipoCaso: RelacionAreaTipoCaso[]
  terminoArea: RelacionTerminoArea[]
  terminoTipoCaso: RelacionTerminoTipoCaso[]
  uso: UsoCatalogo
}

type ClaseElemento = 'area' | 'tipo' | 'termino'

type ElementoEnEdicion = { clase: ClaseElemento; id: string } | null

type Confirmacion =
  | { clase: 'area' | 'tipo' | 'termino'; id: string; etiqueta: string; activo: boolean }
  | { clase: 'area-tipo'; parentId: string; childId: string; etiqueta: string }
  | { clase: 'termino-area'; parentId: string; childId: string; etiqueta: string }
  | { clase: 'termino-tipo'; parentId: string; childId: string; etiqueta: string }
  | null

/** Correspondencia pendiente de confirmar, según el bloque que la solicitó. */
type VinculoPendiente =
  | { tipo: 'area-tipo'; areaId: string; tipoCasoId: string }
  | { tipo: 'termino-area'; terminoId: string; areaId: string }
  | { tipo: 'termino-tipo'; terminoId: string; tipoCasoId: string }
  | null

type OpcionCatalogo = { id: string; nombre: string; activo: boolean }

const ETIQUETA_CLASE: Record<ClaseElemento, string> = {
  area: 'área jurídica',
  tipo: 'tipo de caso',
  termino: 'término de búsqueda',
}

const NOMBRE_PESTANA: Record<ClaseElemento, string> = {
  area: 'áreas jurídicas',
  tipo: 'tipos de caso',
  termino: 'términos de búsqueda',
}

async function cargarCatalogo(): Promise<DatosCatalogo> {
  const [areas, tipos, terminos, areaTipoCaso, terminoArea, terminoTipoCaso] = await Promise.all([
    listarAreas(),
    listarTiposCaso(),
    listarTerminos(),
    listarRelacionesAreaTipoCaso(),
    listarRelacionesTerminoArea(),
    listarRelacionesTerminoTipoCaso(),
  ])
  // El uso se consulta con conteos reales sobre las tablas base: nunca se estima.
  const uso = await obtenerUsoCatalogo({
    areas: areas.map((area) => area.id),
    tipos: tipos.map((tipo) => tipo.id),
    terminos: terminos.map((termino) => termino.id),
  })
  return { areas, tipos, terminos, areaTipoCaso, terminoArea, terminoTipoCaso, uso }
}

function normalizar(valor: string): string {
  return valor.trim().toLocaleLowerCase('es')
}

function ElementoEstadoBadge({ activo }: { activo: boolean }) {
  return (
    <Badge colorPalette={activo ? 'green' : 'gray'} variant="subtle" size="sm">
      {activo ? 'Activo' : 'Inactivo'}
    </Badge>
  )
}

function AccionesElemento({
  activo,
  deshabilitado,
  nombre,
  onAlternar,
  onEditar,
}: {
  activo: boolean
  deshabilitado: boolean
  nombre: string
  onAlternar: () => void
  onEditar: () => void
}) {
  return (
    <Flex gap="2" wrap="wrap" justify="flex-end">
      <Button size="xs" variant="outline" onClick={onEditar} disabled={deshabilitado} aria-label={`Editar ${nombre}`}>
        <Pencil aria-hidden size={14} />
        Editar
      </Button>
      <Button
        size="xs"
        variant="outline"
        colorPalette={activo ? 'orange' : 'green'}
        onClick={onAlternar}
        disabled={deshabilitado}
        aria-label={activo ? `Desactivar ${nombre}` : `Reactivar ${nombre}`}
      >
        <PowerOff aria-hidden size={14} />
        {activo ? 'Desactivar' : 'Reactivar'}
      </Button>
    </Flex>
  )
}

/** Selector simple accesible para elegir el elemento principal de un bloque de vínculos. */
function SelectorElemento({
  valor,
  opciones,
  onCambiar,
}: {
  valor: string
  opciones: { id: string; nombre: string }[]
  onCambiar: (valor: string) => void
}) {
  return (
    <NativeSelect.Root>
      <NativeSelect.Field value={valor} onChange={(evento) => onCambiar(evento.target.value)}>
        {opciones.map((opcion) => (
          <option key={opcion.id} value={opcion.id}>
            {opcion.nombre}
          </option>
        ))}
      </NativeSelect.Field>
      <NativeSelect.Indicator />
    </NativeSelect.Root>
  )
}

/** Bloque de correspondencias: alta sobre los elementos disponibles y retiro de los vinculados. */
function SeccionVinculos({
  titulo,
  descripcion,
  parentEtiqueta,
  parents,
  parentId,
  onCambiarParent,
  children,
  vinculados,
  onVincular,
  onQuitar,
  notaVacia,
}: {
  titulo: string
  descripcion: string
  parentEtiqueta: string
  parents: { id: string; nombre: string }[]
  parentId: string
  onCambiarParent: (valor: string) => void
  children: OpcionCatalogo[]
  vinculados: string[]
  onVincular: (childId: string) => void
  onQuitar: (childId: string) => void
  notaVacia: string
}) {
  const vinculadosSet = new Set(vinculados)
  const disponibles = children.filter((hijo) => !vinculadosSet.has(hijo.id))
  const parent = parents.find((opcion) => opcion.id === parentId)

  return (
    <Card.Root>
      <Card.Header>
        <Flex align="center" gap="2">
          <Link2 aria-hidden size={18} />
          <Card.Title textStyle="title-sm">{titulo}</Card.Title>
        </Flex>
        <Text textStyle="body-sm" color="fg.muted" mt="1">
          {descripcion}
        </Text>
      </Card.Header>
      <Card.Body>
        <Stack gap="4">
          <Field.Root>
            <Field.Label>{parentEtiqueta}</Field.Label>
            <SelectorElemento valor={parentId} opciones={parents} onCambiar={onCambiarParent} />
          </Field.Root>

          {parents.length === 0 ? (
            <Text color="fg.muted">{notaVacia}</Text>
          ) : (
            <>
              <Box>
                <Text textStyle="label-md" mb="2">
                  {`Vinculados con ${parent?.nombre ?? 'el elemento seleccionado'}`}
                </Text>
                {vinculados.length === 0 ? (
                  <Text color="fg.muted" textStyle="body-sm">
                    Sin correspondencias registradas para esta selección.
                  </Text>
                ) : (
                  <Table.ScrollArea borderWidth="1px" borderRadius="md">
                    <Table.Root size="sm" variant="line">
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeader>Elemento vinculado</Table.ColumnHeader>
                          <Table.ColumnHeader textAlign="end">Acción</Table.ColumnHeader>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {children
                          .filter((hijo) => vinculadosSet.has(hijo.id))
                          .map((hijo) => (
                            <Table.Row key={hijo.id}>
                              <Table.Cell>
                                <Flex align="center" gap="2" wrap="wrap">
                                  <Text>{hijo.nombre}</Text>
                                  {!hijo.activo && <ElementoEstadoBadge activo={false} />}
                                </Flex>
                              </Table.Cell>
                              <Table.Cell textAlign="end">
                                <Button
                                  size="xs"
                                  variant="outline"
                                  colorPalette="red"
                                  onClick={() => onQuitar(hijo.id)}
                                  aria-label={`Quitar la correspondencia con ${hijo.nombre}`}
                                >
                                  <Trash2 aria-hidden size={14} />
                                  Quitar
                                </Button>
                              </Table.Cell>
                            </Table.Row>
                          ))}
                      </Table.Body>
                    </Table.Root>
                  </Table.ScrollArea>
                )}
              </Box>

              <Box>
                <Text textStyle="label-md" mb="2">
                  Disponibles para vincular
                </Text>
                {disponibles.length === 0 ? (
                  <Text color="fg.muted" textStyle="body-sm">
                    Todos los elementos del catálogo ya están vinculados a esta selección.
                  </Text>
                ) : (
                  <Stack gap="1">
                    {disponibles.map((hijo) => (
                      <Checkbox.Root key={hijo.id} checked={false} onCheckedChange={() => onVincular(hijo.id)}>
                        <Checkbox.HiddenInput />
                        <Checkbox.Control />
                        <Checkbox.Label>
                          <Flex align="center" gap="2" wrap="wrap">
                            <Text>{hijo.nombre}</Text>
                            {!hijo.activo && <ElementoEstadoBadge activo={false} />}
                          </Flex>
                        </Checkbox.Label>
                      </Checkbox.Root>
                    ))}
                  </Stack>
                )}
              </Box>
            </>
          )}
        </Stack>
      </Card.Body>
    </Card.Root>
  )
}

function ListaSimple({ items }: { items: string[] }) {
  return (
    <Stack as="ul" gap="1" ps="4">
      {items.map((item) => (
        <Text as="li" key={item} color="fg.muted">
          {item}
        </Text>
      ))}
    </Stack>
  )
}

/**
 * CU 17 — Administración del catálogo jurídico.
 *
 * Alta y edición de áreas, tipos de caso y términos; alternancia activo/inactivo y gestión de
 * las correspondencias. Los elementos con referencias históricas se desactivan: la fila y sus
 * relaciones se conservan y solo dejan de ofrecerse para nuevas selecciones. No existe borrado
 * físico de áreas, tipos de caso ni términos.
 */
export function CatalogoAdminPage() {
  const { datos, cargando, error, recargar } = useConsulta<DatosCatalogo>(cargarCatalogo, 'catalogo-administracion')
  const [pestana, setPestana] = useState<Pestana>('areas')
  const [edicion, setEdicion] = useState<ElementoEnEdicion>(null)
  const [nombreFormulario, setNombreFormulario] = useState('')
  const [activoFormulario, setActivoFormulario] = useState(true)
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorOperacion, setErrorOperacion] = useState<string | null>(null)
  const [confirmacion, setConfirmacion] = useState<Confirmacion>(null)
  const [procesando, setProcesando] = useState(false)
  const [areaSeleccionada, setAreaSeleccionada] = useState('')
  const [terminoSeleccionado, setTerminoSeleccionado] = useState('')
  const [tipoSeleccionado, setTipoSeleccionado] = useState('')
  const [vinculoPendiente, setVinculoPendiente] = useState<VinculoPendiente>(null)
  const [errorVinculo, setErrorVinculo] = useState<string | null>(null)

  const areas = datos?.areas ?? []
  const tipos = datos?.tipos ?? []
  const terminos = datos?.terminos ?? []
  const areaTipoCaso = datos?.areaTipoCaso ?? []
  const terminoArea = datos?.terminoArea ?? []
  const terminoTipoCaso = datos?.terminoTipoCaso ?? []
  const uso = datos?.uso

  const areaActiva = areas.find((area) => area.id === areaSeleccionada) ?? areas[0] ?? null
  const terminoActivo = terminos.find((termino) => termino.id === terminoSeleccionado) ?? terminos[0] ?? null
  const tipoActivo = tipos.find((tipo) => tipo.id === tipoSeleccionado) ?? tipos[0] ?? null

  const tiposDelArea = areaActiva
    ? tipos.filter((tipo) =>
        areaTipoCaso.some((relacion) => relacion.area_id === areaActiva.id && relacion.tipo_caso_id === tipo.id),
      )
    : []
  const terminosDelArea = areaActiva
    ? terminos.filter((termino) =>
        terminoArea.some((relacion) => relacion.termino_id === termino.id && relacion.area_id === areaActiva.id),
      )
    : []
  const areasDelTermino = terminoActivo
    ? areas.filter((area) =>
        terminoArea.some((relacion) => relacion.termino_id === terminoActivo.id && relacion.area_id === area.id),
      )
    : []
  const tiposDelTermino = terminoActivo
    ? tipos.filter((tipo) =>
        terminoTipoCaso.some((relacion) => relacion.termino_id === terminoActivo.id && relacion.tipo_caso_id === tipo.id),
      )
    : []
  const areasDelTipo = tipoActivo
    ? areas.filter((area) =>
        areaTipoCaso.some((relacion) => relacion.area_id === area.id && relacion.tipo_caso_id === tipoActivo.id),
      )
    : []

  // Correspondencia incompleta: tipos de caso activos que el área seleccionada todavía no admite.
  const tiposActivosSinArea = areaActiva
    ? tipos.filter((tipo) => tipo.activo && !tiposDelArea.some((vinculado) => vinculado.id === tipo.id))
    : []

  function abrirAlta(clase: ClaseElemento) {
    setEdicion({ clase, id: '' })
    setNombreFormulario('')
    setActivoFormulario(true)
    setErrorFormulario(null)
  }

  function abrirEdicion(elemento: { id: string; nombre: string; activo: boolean }, clase: ClaseElemento) {
    setEdicion({ clase, id: elemento.id })
    setNombreFormulario(elemento.nombre)
    setActivoFormulario(elemento.activo)
    setErrorFormulario(null)
  }

  function seleccionarValor(clase: 'area' | 'termino' | 'tipo', valor: string) {
    setErrorVinculo(null)
    if (clase === 'area') setAreaSeleccionada(valor)
    if (clase === 'termino') setTerminoSeleccionado(valor)
    if (clase === 'tipo') setTipoSeleccionado(valor)
  }

  /** Comprueba duplicados exactos (comparación sin distinguir mayúsculas) antes de guardar. */
  function textoDuplicado(clase: ClaseElemento, id: string, texto: string): boolean {
    const existentes =
      clase === 'area'
        ? areas.filter((elemento) => elemento.id !== id).map((elemento) => elemento.nombre)
        : clase === 'tipo'
          ? tipos.filter((elemento) => elemento.id !== id).map((elemento) => elemento.nombre_cotidiano)
          : terminos.filter((elemento) => elemento.id !== id).map((elemento) => elemento.texto)
    return existentes.some((valor) => normalizar(valor) === normalizar(texto))
  }

  async function guardarFormulario() {
    if (!edicion) return
    const etiqueta = ETIQUETA_CLASE[edicion.clase]
    const errorValidacion = validarTextoRequerido(nombreFormulario, etiqueta, LONGITUD_MAXIMA_ETIQUETA)
    if (errorValidacion) {
      setErrorFormulario(errorValidacion)
      return
    }
    const texto = nombreFormulario.trim()
    if (textoDuplicado(edicion.clase, edicion.id, texto)) {
      setErrorFormulario('Ya existe un elemento del catálogo con ese texto. Los nombres y términos no se repiten.')
      return
    }

    setGuardando(true)
    setErrorFormulario(null)
    try {
      if (edicion.clase === 'area') {
        if (edicion.id) await actualizarArea(edicion.id, { nombre: texto, activa: activoFormulario })
        else await crearArea(texto)
      }
      if (edicion.clase === 'tipo') {
        if (edicion.id) await actualizarTipoCaso(edicion.id, { nombreCotidiano: texto, activo: activoFormulario })
        else await crearTipoCaso(texto)
      }
      if (edicion.clase === 'termino') {
        if (edicion.id) await actualizarTermino(edicion.id, { texto, activo: activoFormulario })
        else await crearTermino(texto)
      }
      toaster.create({
        title: edicion.id ? 'Elemento actualizado' : 'Elemento creado',
        description: `La operación se registró sobre el ${etiqueta}.`,
        type: 'success',
      })
      setEdicion(null)
      recargar()
    } catch (fallo: unknown) {
      setErrorFormulario(mensajeDeError(fallo, 'No se pudo guardar el elemento del catálogo.'))
    } finally {
      setGuardando(false)
    }
  }

  async function confirmarOperacion() {
    if (!confirmacion || procesando) return
    setProcesando(true)
    setErrorOperacion(null)
    try {
      if (confirmacion.clase === 'area' || confirmacion.clase === 'tipo' || confirmacion.clase === 'termino') {
        if (confirmacion.clase === 'area') {
          const area = areas.find((elemento) => elemento.id === confirmacion.id)
          if (area) await actualizarArea(area.id, { nombre: area.nombre, activa: !area.activa })
        }
        if (confirmacion.clase === 'tipo') {
          const tipo = tipos.find((elemento) => elemento.id === confirmacion.id)
          if (tipo) await actualizarTipoCaso(tipo.id, { nombreCotidiano: tipo.nombre_cotidiano, activo: !tipo.activo })
        }
        if (confirmacion.clase === 'termino') {
          const termino = terminos.find((elemento) => elemento.id === confirmacion.id)
          if (termino) await actualizarTermino(termino.id, { texto: termino.texto, activo: !termino.activo })
        }
      }
      if (confirmacion.clase === 'area-tipo') {
        await eliminarRelacionAreaTipoCaso(confirmacion.parentId, confirmacion.childId)
      }
      if (confirmacion.clase === 'termino-area') {
        await eliminarRelacionTerminoArea(confirmacion.parentId, confirmacion.childId)
      }
      if (confirmacion.clase === 'termino-tipo') {
        await eliminarRelacionTerminoTipoCaso(confirmacion.parentId, confirmacion.childId)
      }
      toaster.create({ title: 'Cambio registrado', type: 'success' })
      setConfirmacion(null)
      recargar()
    } catch (fallo: unknown) {
      setErrorOperacion(mensajeDeError(fallo, 'No se pudo registrar el cambio. Inténtalo de nuevo.'))
    } finally {
      setProcesando(false)
    }
  }

  async function agregarVinculo() {
    if (!vinculoPendiente || procesando) return
    setProcesando(true)
    setErrorVinculo(null)
    try {
      if (vinculoPendiente.tipo === 'area-tipo') {
        await crearRelacionAreaTipoCaso(vinculoPendiente.areaId, vinculoPendiente.tipoCasoId)
      }
      if (vinculoPendiente.tipo === 'termino-area') {
        await crearRelacionTerminoArea(vinculoPendiente.terminoId, vinculoPendiente.areaId)
      }
      if (vinculoPendiente.tipo === 'termino-tipo') {
        await crearRelacionTerminoTipoCaso(vinculoPendiente.terminoId, vinculoPendiente.tipoCasoId)
      }
      toaster.create({ title: 'Correspondencia registrada', type: 'success' })
      setVinculoPendiente(null)
      recargar()
    } catch (fallo: unknown) {
      setErrorVinculo(mensajeDeError(fallo, 'No se pudo registrar la correspondencia.'))
    } finally {
      setProcesando(false)
    }
  }

  function describirVinculo(pendiente: VinculoPendiente): string {
    if (!pendiente) return ''
    if (pendiente.tipo === 'area-tipo') {
      const tipo = tipos.find((elemento) => elemento.id === pendiente.tipoCasoId)
      const area = areas.find((elemento) => elemento.id === pendiente.areaId)
      return `Se vinculará «${tipo?.nombre_cotidiano ?? 'el tipo de caso'}» con el área «${area?.nombre ?? ''}».`
    }
    const termino = terminos.find((elemento) => elemento.id === pendiente.terminoId)
    if (pendiente.tipo === 'termino-area') {
      const area = areas.find((elemento) => elemento.id === pendiente.areaId)
      return `Se vinculará «${area?.nombre ?? 'el área'}» con el término «${termino?.texto ?? ''}».`
    }
    const tipo = tipos.find((elemento) => elemento.id === pendiente.tipoCasoId)
    return `Se vinculará «${tipo?.nombre_cotidiano ?? 'el tipo de caso'}» con el término «${termino?.texto ?? ''}».`
  }

  const totalRegistros = areas.length + tipos.length + terminos.length + areaTipoCaso.length + terminoArea.length + terminoTipoCaso.length
  const errorDePermiso = error !== null && esErrorDePermiso(error)
  const enEdicionEsNuevo = edicion !== null && edicion.id === ''
  const tituloDialogo = edicion === null ? '' : enEdicionEsNuevo ? 'Nuevo elemento del catálogo' : `Editar ${ETIQUETA_CLASE[edicion.clase]}`

  return (
    <Box>
      <PageHeader
        titulo="Gestión de categorías y taxonomía jurídica"
        descripcion="Administra las áreas del derecho, las situaciones en lenguaje cotidiano y los términos asociados que se ofrecen en el registro profesional y en la búsqueda pública."
        etiqueta="CU 17 · Administración del catálogo"
        acciones={
          <>
            <Button variant="outline" onClick={recargar} loading={cargando}>
              Actualizar
            </Button>
            <Button onClick={() => abrirAlta('area')}>
              <Plus aria-hidden size={16} />
              Nueva área jurídica
            </Button>
          </>
        }
      />

      <Alert.Root status="info" mb="6">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Desactivar conserva la clasificación histórica</Alert.Title>
          <Alert.Description>
            Un área, un tipo de caso o un término con referencias históricas se desactiva y nunca se borra: la fila y
            sus correspondencias se conservan. Los elementos inactivos dejan de ofrecerse para nuevas selecciones,
            pero las declaraciones ya registradas en perfiles y solicitudes mantienen su clasificación.
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>

      {cargando && !datos && <FeedbackState kind="loading" title="Cargando el catálogo jurídico" />}

      {error !== null && (
        <FeedbackState
          kind="error"
          title={errorDePermiso ? 'No tienes permiso para administrar el catálogo' : 'No se pudo cargar el catálogo'}
          description={
            errorDePermiso
              ? 'La administración del catálogo requiere una cuenta con rol administrativo. La consulta del catálogo público sigue disponible.'
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
                <Text textStyle="label-caps" color="fg.muted">Áreas jurídicas</Text>
                <Heading as="p" textStyle="headline-md" color="primary">{areas.length}</Heading>
                <Text textStyle="body-sm" color="fg.muted">{areas.filter((area) => area.activa).length} activas</Text>
              </Card.Body>
            </Card.Root>
            <Card.Root>
              <Card.Body>
                <Text textStyle="label-caps" color="fg.muted">Tipos de caso</Text>
                <Heading as="p" textStyle="headline-md" color="primary">{tipos.length}</Heading>
                <Text textStyle="body-sm" color="fg.muted">{tipos.filter((tipo) => tipo.activo).length} activos</Text>
              </Card.Body>
            </Card.Root>
            <Card.Root>
              <Card.Body>
                <Text textStyle="label-caps" color="fg.muted">Términos de búsqueda</Text>
                <Heading as="p" textStyle="headline-md" color="primary">{terminos.length}</Heading>
                <Text textStyle="body-sm" color="fg.muted">{terminos.filter((termino) => termino.activo).length} activos</Text>
              </Card.Body>
            </Card.Root>
            <Card.Root>
              <Card.Body>
                <Text textStyle="label-caps" color="fg.muted">Correspondencias</Text>
                <Heading as="p" textStyle="headline-md" color="primary">
                  {areaTipoCaso.length + terminoArea.length + terminoTipoCaso.length}
                </Heading>
                <Text textStyle="body-sm" color="fg.muted">Entre áreas, tipos de caso y términos</Text>
              </Card.Body>
            </Card.Root>
          </SimpleGrid>

          {totalRegistros === 0 && (
            <FeedbackState
              title="El catálogo está vacío"
              description="Crea la primera área jurídica para que los profesionales puedan declarar su práctica."
              action={
                <Button onClick={() => abrirAlta('area')}>
                  <Plus aria-hidden size={16} />
                  Crear área jurídica
                </Button>
              }
            />
          )}

          <Tabs.Root value={pestana} onValueChange={(detalles) => setPestana(detalles.value as Pestana)}>
            <Tabs.List>
              <Tabs.Trigger value="areas">Áreas jurídicas</Tabs.Trigger>
              <Tabs.Trigger value="tipos">Tipos de caso</Tabs.Trigger>
              <Tabs.Trigger value="terminos">Términos de búsqueda</Tabs.Trigger>
              <Tabs.Trigger value="relaciones">Correspondencias</Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="areas">
              <Stack gap="4" mt="4">
                <Flex justify="space-between" align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap="3">
                  <Box>
                    <Heading as="h2" textStyle="title-md">Áreas jurídicas</Heading>
                    <Text color="fg.muted" textStyle="body-sm">
                      Cada área admite ciertos tipos de caso. Para retirar un área se desactiva y se conservan sus
                      correspondencias.
                    </Text>
                  </Box>
                  <Button variant="outline" onClick={() => abrirAlta('area')}>
                    <Plus aria-hidden size={16} />
                    Nueva área
                  </Button>
                </Flex>
                {areas.length === 0 ? (
                  <FeedbackState title="Sin áreas jurídicas registradas" description="Crea la primera área para clasificar la práctica profesional." />
                ) : (
                  <Table.ScrollArea borderWidth="1px" borderRadius="md">
                    <Table.Root size="sm">
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeader>Área</Table.ColumnHeader>
                          <Table.ColumnHeader>Estado</Table.ColumnHeader>
                          <Table.ColumnHeader>Tipos de caso vinculados</Table.ColumnHeader>
                          <Table.ColumnHeader>Perfiles que la declaran</Table.ColumnHeader>
                          <Table.ColumnHeader>Orientaciones registradas</Table.ColumnHeader>
                          <Table.ColumnHeader textAlign="end">Acciones</Table.ColumnHeader>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {areas.map((area) => {
                          const conteo = uso?.areas[area.id]
                          const tiposActivos = tipos.filter((tipo) => tipo.activo).length
                          const vinculos = conteo?.tiposDeCaso ?? 0
                          const incompleta = area.activa && tiposActivos > 0 && vinculos < tiposActivos
                          return (
                            <Table.Row key={area.id}>
                              <Table.Cell>
                                <Text fontWeight="600">{area.nombre}</Text>
                                {incompleta && (
                                  <Text textStyle="body-sm" color="fg.warning">
                                    {`Solo ${vinculos} de ${tiposActivos} tipos de caso activos están vinculados.`}
                                  </Text>
                                )}
                              </Table.Cell>
                              <Table.Cell>
                                <ElementoEstadoBadge activo={area.activa} />
                              </Table.Cell>
                              <Table.Cell>{area.activa ? vinculos : `${vinculos} (histórico)`}</Table.Cell>
                              <Table.Cell>{conteo ? conteo.perfiles : '—'}</Table.Cell>
                              <Table.Cell>{conteo ? conteo.orientaciones : '—'}</Table.Cell>
                              <Table.Cell textAlign="end">
                                <AccionesElemento
                                  activo={area.activa}
                                  deshabilitado={procesando}
                                  nombre={area.nombre}
                                  onEditar={() => abrirEdicion({ id: area.id, nombre: area.nombre, activo: area.activa }, 'area')}
                                  onAlternar={() =>
                                    setConfirmacion({ clase: 'area', id: area.id, etiqueta: area.nombre, activo: area.activa })
                                  }
                                />
                              </Table.Cell>
                            </Table.Row>
                          )
                        })}
                      </Table.Body>
                    </Table.Root>
                  </Table.ScrollArea>
                )}
              </Stack>
            </Tabs.Content>

            <Tabs.Content value="tipos">
              <Stack gap="4" mt="4">
                <Flex justify="space-between" align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap="3">
                  <Box>
                    <Heading as="h2" textStyle="title-md">Tipos de caso</Heading>
                    <Text color="fg.muted" textStyle="body-sm">
                      Situaciones descritas en lenguaje cotidiano. Un tipo de caso sin área vinculada no se alcanza
                      desde el filtro por área.
                    </Text>
                  </Box>
                  <Button variant="outline" onClick={() => abrirAlta('tipo')}>
                    <Plus aria-hidden size={16} />
                    Nuevo tipo de caso
                  </Button>
                </Flex>
                {tipos.length === 0 ? (
                  <FeedbackState title="Sin tipos de caso registrados" description="Crea el primer tipo de caso para clasificar las solicitudes." />
                ) : (
                  <Table.ScrollArea borderWidth="1px" borderRadius="md">
                    <Table.Root size="sm">
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeader>Tipo de caso</Table.ColumnHeader>
                          <Table.ColumnHeader>Estado</Table.ColumnHeader>
                          <Table.ColumnHeader>Áreas vinculadas</Table.ColumnHeader>
                          <Table.ColumnHeader>Perfiles que lo atienden</Table.ColumnHeader>
                          <Table.ColumnHeader>Solicitudes clasificadas</Table.ColumnHeader>
                          <Table.ColumnHeader textAlign="end">Acciones</Table.ColumnHeader>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {tipos.map((tipo) => {
                          const conteo = uso?.tipos[tipo.id]
                          const sinArea = tipo.activo && (conteo?.areas ?? 0) === 0
                          return (
                            <Table.Row key={tipo.id}>
                              <Table.Cell>
                                <Text fontWeight="600">{tipo.nombre_cotidiano}</Text>
                                {sinArea && (
                                  <Text textStyle="body-sm" color="fg.warning">
                                    Sin área jurídica vinculada: no aparece en el filtro por área.
                                  </Text>
                                )}
                              </Table.Cell>
                              <Table.Cell>
                                <ElementoEstadoBadge activo={tipo.activo} />
                              </Table.Cell>
                              <Table.Cell>{conteo ? conteo.areas : '—'}</Table.Cell>
                              <Table.Cell>{conteo ? conteo.perfiles : '—'}</Table.Cell>
                              <Table.Cell>{conteo ? conteo.solicitudes : '—'}</Table.Cell>
                              <Table.Cell textAlign="end">
                                <AccionesElemento
                                  activo={tipo.activo}
                                  deshabilitado={procesando}
                                  nombre={tipo.nombre_cotidiano}
                                  onEditar={() =>
                                    abrirEdicion({ id: tipo.id, nombre: tipo.nombre_cotidiano, activo: tipo.activo }, 'tipo')
                                  }
                                  onAlternar={() =>
                                    setConfirmacion({
                                      clase: 'tipo',
                                      id: tipo.id,
                                      etiqueta: tipo.nombre_cotidiano,
                                      activo: tipo.activo,
                                    })
                                  }
                                />
                              </Table.Cell>
                            </Table.Row>
                          )
                        })}
                      </Table.Body>
                    </Table.Root>
                  </Table.ScrollArea>
                )}
              </Stack>
            </Tabs.Content>

            <Tabs.Content value="terminos">
              <Stack gap="4" mt="4">
                <Flex justify="space-between" align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap="3">
                  <Box>
                    <Heading as="h2" textStyle="title-md">Términos de búsqueda</Heading>
                    <Text color="fg.muted" textStyle="body-sm">
                      Palabras de uso frecuente asociadas a áreas y tipos de caso para orientar la búsqueda pública.
                    </Text>
                  </Box>
                  <Button variant="outline" onClick={() => abrirAlta('termino')}>
                    <Plus aria-hidden size={16} />
                    Nuevo término
                  </Button>
                </Flex>
                {terminos.length === 0 ? (
                  <FeedbackState title="Sin términos registrados" description="Crea el primer término para orientar la búsqueda por situación jurídica." />
                ) : (
                  <Table.ScrollArea borderWidth="1px" borderRadius="md">
                    <Table.Root size="sm">
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeader>Término</Table.ColumnHeader>
                          <Table.ColumnHeader>Estado</Table.ColumnHeader>
                          <Table.ColumnHeader>Áreas vinculadas</Table.ColumnHeader>
                          <Table.ColumnHeader>Tipos de caso vinculados</Table.ColumnHeader>
                          <Table.ColumnHeader textAlign="end">Acciones</Table.ColumnHeader>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {terminos.map((termino) => {
                          const conteo = uso?.terminos[termino.id]
                          const huerfano = termino.activo && (conteo?.areas ?? 0) === 0 && (conteo?.tiposDeCaso ?? 0) === 0
                          return (
                            <Table.Row key={termino.id}>
                              <Table.Cell>
                                <Text fontWeight="600">{termino.texto}</Text>
                                {huerfano && (
                                  <Text textStyle="body-sm" color="fg.warning">
                                    Sin correspondencias: no orienta la búsqueda mientras no se asocie a un área o a un
                                    tipo de caso.
                                  </Text>
                                )}
                              </Table.Cell>
                              <Table.Cell>
                                <ElementoEstadoBadge activo={termino.activo} />
                              </Table.Cell>
                              <Table.Cell>{conteo ? conteo.areas : '—'}</Table.Cell>
                              <Table.Cell>{conteo ? conteo.tiposDeCaso : '—'}</Table.Cell>
                              <Table.Cell textAlign="end">
                                <AccionesElemento
                                  activo={termino.activo}
                                  deshabilitado={procesando}
                                  nombre={termino.texto}
                                  onEditar={() =>
                                    abrirEdicion({ id: termino.id, nombre: termino.texto, activo: termino.activo }, 'termino')
                                  }
                                  onAlternar={() =>
                                    setConfirmacion({
                                      clase: 'termino',
                                      id: termino.id,
                                      etiqueta: termino.texto,
                                      activo: termino.activo,
                                    })
                                  }
                                />
                              </Table.Cell>
                            </Table.Row>
                          )
                        })}
                      </Table.Body>
                    </Table.Root>
                  </Table.ScrollArea>
                )}
              </Stack>
            </Tabs.Content>

            <Tabs.Content value="relaciones">
              <Stack gap="4" mt="4">
                <Box>
                  <Heading as="h2" textStyle="title-md">Correspondencias del catálogo</Heading>
                  <Text color="fg.muted" textStyle="body-sm">
                    Elige el elemento principal y vincula o retira sus correspondencias. Un elemento inactivo no se
                    ofrece para nuevas selecciones, pero conserva lo ya registrado.
                  </Text>
                </Box>

                {areas.length === 0 || tipos.length === 0 ? (
                  <FeedbackState
                    title="Faltan elementos para relacionar"
                    description="Necesitas al menos un área jurídica y un tipo de caso para registrar correspondencias."
                  />
                ) : (
                  <>
                    <SeccionVinculos
                      titulo="Área — tipo de caso"
                      descripcion="Determina qué situaciones en lenguaje cotidiano se ofrecen al elegir un área jurídica."
                      parentEtiqueta="Área jurídica"
                      parents={areas.map((area) => ({
                        id: area.id,
                        nombre: area.activa ? area.nombre : `${area.nombre} (inactiva)`,
                      }))}
                      parentId={areaActiva?.id ?? ''}
                      onCambiarParent={(valor) => seleccionarValor('area', valor)}
                      children={tipos.map((tipo) => ({ id: tipo.id, nombre: tipo.nombre_cotidiano, activo: tipo.activo }))}
                      vinculados={tiposDelArea.map((tipo) => tipo.id)}
                      onVincular={(tipoCasoId) =>
                        setVinculoPendiente({ tipo: 'area-tipo', areaId: areaActiva?.id ?? '', tipoCasoId })
                      }
                      onQuitar={(tipoCasoId) =>
                        setConfirmacion({
                          clase: 'area-tipo',
                          parentId: areaActiva?.id ?? '',
                          childId: tipoCasoId,
                          etiqueta: tipos.find((tipo) => tipo.id === tipoCasoId)?.nombre_cotidiano ?? 'el tipo de caso',
                        })
                      }
                      notaVacia="Registra primero un área jurídica."
                    />

                    {tiposActivosSinArea.length > 0 && (
                      <Alert.Root status="warning">
                        <Alert.Indicator>
                          <AlertTriangle aria-hidden size={18} />
                        </Alert.Indicator>
                        <Alert.Content>
                          <Alert.Title>Correspondencia incompleta</Alert.Title>
                          <Alert.Description>
                            {`Estos tipos de caso activos no están vinculados al área seleccionada: ${tiposActivosSinArea
                              .map((tipo) => tipo.nombre_cotidiano)
                              .join(', ')}. Vincúlalos para que la búsqueda por área los ofrezca.`}
                          </Alert.Description>
                        </Alert.Content>
                      </Alert.Root>
                    )}

                    <SeccionVinculos
                      titulo="Término — área"
                      descripcion="Asocia palabras de uso frecuente con el área jurídica que describen."
                      parentEtiqueta="Término de búsqueda"
                      parents={terminos.map((termino) => ({
                        id: termino.id,
                        nombre: termino.activo ? termino.texto : `${termino.texto} (inactivo)`,
                      }))}
                      parentId={terminoActivo?.id ?? ''}
                      onCambiarParent={(valor) => seleccionarValor('termino', valor)}
                      children={areas.map((area) => ({ id: area.id, nombre: area.nombre, activo: area.activa }))}
                      vinculados={areasDelTermino.map((area) => area.id)}
                      onVincular={(areaId) =>
                        setVinculoPendiente({ tipo: 'termino-area', terminoId: terminoActivo?.id ?? '', areaId })
                      }
                      onQuitar={(areaId) =>
                        setConfirmacion({
                          clase: 'termino-area',
                          parentId: terminoActivo?.id ?? '',
                          childId: areaId,
                          etiqueta: areas.find((area) => area.id === areaId)?.nombre ?? 'el área',
                        })
                      }
                      notaVacia="Registra primero un término de búsqueda."
                    />

                    <SeccionVinculos
                      titulo="Término — tipo de caso"
                      descripcion="Asocia palabras de uso frecuente con la situación cotidiana que describen."
                      parentEtiqueta="Término de búsqueda"
                      parents={terminos.map((termino) => ({
                        id: termino.id,
                        nombre: termino.activo ? termino.texto : `${termino.texto} (inactivo)`,
                      }))}
                      parentId={terminoActivo?.id ?? ''}
                      onCambiarParent={(valor) => seleccionarValor('termino', valor)}
                      children={tipos.map((tipo) => ({ id: tipo.id, nombre: tipo.nombre_cotidiano, activo: tipo.activo }))}
                      vinculados={tiposDelTermino.map((tipo) => tipo.id)}
                      onVincular={(tipoCasoId) =>
                        setVinculoPendiente({ tipo: 'termino-tipo', terminoId: terminoActivo?.id ?? '', tipoCasoId })
                      }
                      onQuitar={(tipoCasoId) =>
                        setConfirmacion({
                          clase: 'termino-tipo',
                          parentId: terminoActivo?.id ?? '',
                          childId: tipoCasoId,
                          etiqueta: tipos.find((tipo) => tipo.id === tipoCasoId)?.nombre_cotidiano ?? 'el tipo de caso',
                        })
                      }
                      notaVacia="Registra primero un término de búsqueda."
                    />

                    <SimpleGrid columns={{ base: 1, lg: 2 }} gap="4">
                      <Card.Root>
                        <Card.Header>
                          <Card.Title textStyle="title-sm">
                            {`Áreas que admiten «${tipoActivo?.nombre_cotidiano ?? 'el tipo de caso'}»`}
                          </Card.Title>
                        </Card.Header>
                        <Card.Body>
                          {areasDelTipo.length === 0 ? (
                            <Text color="fg.muted" textStyle="body-sm">
                              Este tipo de caso no está vinculado a ninguna área jurídica.
                            </Text>
                          ) : (
                            <ListaSimple items={areasDelTipo.map((area) => area.nombre)} />
                          )}
                        </Card.Body>
                      </Card.Root>
                      <Card.Root>
                        <Card.Header>
                          <Card.Title textStyle="title-sm">
                            {`Términos vinculados con «${areaActiva?.nombre ?? 'el área'}»`}
                          </Card.Title>
                        </Card.Header>
                        <Card.Body>
                          {terminosDelArea.length === 0 ? (
                            <Text color="fg.muted" textStyle="body-sm">
                              Ningún término de búsqueda está asociado a esta área.
                            </Text>
                          ) : (
                            <ListaSimple items={terminosDelArea.map((termino) => termino.texto)} />
                          )}
                        </Card.Body>
                      </Card.Root>
                    </SimpleGrid>
                  </>
                )}
              </Stack>
            </Tabs.Content>
          </Tabs.Root>
        </Stack>
      )}

      {errorOperacion !== null && (
        <Alert.Root status="error" mt="6">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>No se pudo completar la operación</Alert.Title>
            <Alert.Description>{errorOperacion}</Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}

      {errorVinculo !== null && (
        <Alert.Root status="error" mt="6">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>No se pudo registrar la correspondencia</Alert.Title>
            <Alert.Description>{errorVinculo}</Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}

      {/* Alta y edición de elementos del catálogo */}
      <Dialog.Root open={edicion !== null} onOpenChange={(detalles) => { if (!detalles.open) setEdicion(null) }} size="md">
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{tituloDialogo}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              {edicion && (
                <Stack gap="5">
                  <Field.Root invalid={Boolean(errorFormulario)}>
                    <Field.Label>
                      {edicion.clase === 'tipo'
                        ? 'Situación en lenguaje cotidiano'
                        : edicion.clase === 'termino'
                          ? 'Término de búsqueda'
                          : 'Nombre del área jurídica'}
                    </Field.Label>
                    <Input
                      value={nombreFormulario}
                      onChange={(evento) => setNombreFormulario(evento.target.value)}
                      maxLength={LONGITUD_MAXIMA_ETIQUETA}
                      placeholder={
                        edicion.clase === 'tipo'
                          ? 'Por ejemplo: despido sin justa causa'
                          : edicion.clase === 'termino'
                            ? 'Por ejemplo: liquidación laboral'
                            : 'Por ejemplo: Derecho laboral'
                      }
                    />
                    {errorFormulario && <Field.ErrorText role="alert">{errorFormulario}</Field.ErrorText>}
                    <Field.HelperText>
                      {edicion.clase === 'termino'
                        ? 'El término orienta la búsqueda pública; no acredita especialidades ni títulos.'
                        : `El texto no puede repetirse entre las ${NOMBRE_PESTANA[edicion.clase]}.`}
                    </Field.HelperText>
                  </Field.Root>

                  {edicion.id !== '' && (
                    <Field.Root>
                      <Switch.Root
                        checked={activoFormulario}
                        onCheckedChange={(detalles) => setActivoFormulario(detalles.checked)}
                      >
                        <Switch.HiddenInput />
                        <Switch.Control />
                        <Switch.Label>
                          {activoFormulario ? 'Ofrecer para nuevas selecciones' : 'Conservar solo como histórico'}
                        </Switch.Label>
                      </Switch.Root>
                      <Field.HelperText>
                        Al desactivarlo, el elemento deja de ofrecerse en el registro profesional y en la búsqueda, pero
                        la clasificación ya registrada se conserva.
                      </Field.HelperText>
                    </Field.Root>
                  )}
                </Stack>
              )}
            </Dialog.Body>
            <Dialog.Footer>
              <Flex gap="3" width="full" justify="flex-end">
                <Button variant="outline" onClick={() => setEdicion(null)}>Cancelar</Button>
                <Button onClick={() => void guardarFormulario()} loading={guardando}>Guardar</Button>
              </Flex>
            </Dialog.Footer>
            <Dialog.CloseTrigger aria-label="Cerrar el formulario del catálogo" />
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* Confirmación de desactivación, reactivación o retiro de una correspondencia */}
      <Dialog.Root
        open={confirmacion !== null}
        onOpenChange={(detalles) => { if (!detalles.open) setConfirmacion(null) }}
        size="md"
        role="alertdialog"
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>
                {confirmacion === null
                  ? ''
                  : confirmacion.clase === 'area-tipo' || confirmacion.clase === 'termino-area' || confirmacion.clase === 'termino-tipo'
                    ? 'Retirar correspondencia'
                    : confirmacion.activo
                      ? 'Desactivar elemento del catálogo'
                      : 'Reactivar elemento del catálogo'}
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              {confirmacion !== null &&
                (confirmacion.clase === 'area-tipo' || confirmacion.clase === 'termino-area' || confirmacion.clase === 'termino-tipo' ? (
                  <Stack gap="3">
                    <Text>{`Se retirará la correspondencia con «${confirmacion.etiqueta}».`}</Text>
                    <Text color="fg.muted">
                      Los elementos del catálogo no se borran: solo deja de existir esta asociación y puede volver a
                      registrarse más adelante.
                    </Text>
                  </Stack>
                ) : (
                  <Stack gap="3">
                    <Text>
                      {confirmacion.activo
                        ? `«${confirmacion.etiqueta}» dejará de ofrecerse para nuevas selecciones.`
                        : `«${confirmacion.etiqueta}» volverá a ofrecerse para nuevas selecciones.`}
                    </Text>
                    <Text color="fg.muted">
                      No se borra la fila ni sus correspondencias: los perfiles y las solicitudes que ya lo referencian
                      conservan su clasificación histórica.
                    </Text>
                  </Stack>
                ))}
            </Dialog.Body>
            <Dialog.Footer>
              <Flex gap="3" width="full" justify="flex-end">
                <Button variant="outline" onClick={() => setConfirmacion(null)}>Cancelar</Button>
                <Button colorPalette="red" onClick={() => void confirmarOperacion()} loading={procesando}>
                  Confirmar
                </Button>
              </Flex>
            </Dialog.Footer>
            <Dialog.CloseTrigger aria-label="Cerrar la confirmación" />
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* Alta de una correspondencia */}
      <Dialog.Root
        open={vinculoPendiente !== null}
        onOpenChange={(detalles) => { if (!detalles.open) setVinculoPendiente(null) }}
        size="md"
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Registrar correspondencia</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap="3">
                <Text>{describirVinculo(vinculoPendiente)}</Text>
                <Text color="fg.muted">
                  Podrás retirarla desde este mismo apartado sin borrar ningún elemento del catálogo.
                </Text>
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Flex gap="3" width="full" justify="flex-end">
                <Button variant="outline" onClick={() => setVinculoPendiente(null)}>Cancelar</Button>
                <Button onClick={() => void agregarVinculo()} loading={procesando}>Vincular</Button>
              </Flex>
            </Dialog.Footer>
            <Dialog.CloseTrigger aria-label="Cerrar el alta de correspondencia" />
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Box>
  )
}
