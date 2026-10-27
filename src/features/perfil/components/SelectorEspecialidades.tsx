// Especialidades del perfil profesional (CU 02): relación área jurídica – tipo de caso.
//
// Se arma en dos pasos: se elige el área, se cargan solo los tipos de caso asociados a esa
// área (catálogo `area_tipo_caso`) y la relación se añade a una lista que no admite
// repeticiones. El contrato guarda áreas y tipos en tablas separadas (`perfil_area` y
// `perfil_tipo_caso`), así que la lista se descompone en ambos conjuntos al guardar.

import { useMemo, useState } from 'react'
import {
  Button,
  Field,
  Fieldset,
  Flex,
  NativeSelect,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react'
import { Plus, X } from 'lucide-react'
import {
  MAX_ESPECIALIDADES,
  descomponerEspecialidades,
  type CatalogoEspecialidades,
  type Especialidad,
} from '../utils'

type SelectorEspecialidadesProps = {
  catalogo: CatalogoEspecialidades | null
  cargandoCatalogo: boolean
  errorCatalogo: string | null
  especialidades: Especialidad[]
  alCambiar: (especialidades: Especialidad[]) => void
  /** Límite de la lista. */
  maximo?: number
  /**
   * Límite de áreas y de tipos distintos que acepta el servidor. La recuperación del
   * perfil exige como máximo 8 de cada uno; sin este dato solo se aplica `maximo`.
   */
  limitePorConjunto?: number
  error?: string
  deshabilitado?: boolean
  /** Marca la lista como obligatoria en la leyenda. */
  requerido?: boolean
  /** Textos de presentación; los formularios del perfil usan los valores por defecto. */
  titulo?: string
  ayuda?: string
  textoBoton?: string
  textoVacio?: string
}

export function SelectorEspecialidades({
  catalogo,
  cargandoCatalogo,
  errorCatalogo,
  especialidades,
  alCambiar,
  maximo = MAX_ESPECIALIDADES,
  limitePorConjunto,
  error,
  deshabilitado = false,
  requerido = false,
  titulo = 'Especialidades (área y tipo de caso)',
  ayuda = `Elige un área jurídica, después un tipo de caso de esa área y añádelo a la lista. Hasta ${MAX_ESPECIALIDADES} relaciones. Una declaración no acredita especialización académica.`,
  textoBoton = 'Añadir a la lista',
  textoVacio = 'Todavía no has añadido relaciones.',
}: SelectorEspecialidadesProps) {
  const [areaId, setAreaId] = useState('')
  const [tipoCasoId, setTipoCasoId] = useState('')
  const [erroresSeleccion, setErroresSeleccion] = useState<{ area?: string; tipo?: string }>({})
  const [mensaje, setMensaje] = useState<string | null>(null)

  const areas = catalogo?.areas ?? []
  // Los tipos de caso se filtran por la relación `area_tipo_caso` del catálogo, sin
  // depender de las tablas: así el componente sirve también a los filtros del directorio.
  const tiposDelArea = useMemo(() => {
    if (!areaId) return []
    const permitidos = new Set(
      (catalogo?.relaciones ?? [])
        .filter((relacion) => relacion.area_id === areaId)
        .map((relacion) => relacion.tipo_caso_id),
    )
    return (catalogo?.tipos ?? []).filter((tipo) => permitidos.has(tipo.id))
  }, [areaId, catalogo])

  const nombreArea = (id: string) => catalogo?.areas.find((area) => area.id === id)?.nombre ?? 'Área no disponible'
  const nombreTipo = (id: string | null) =>
    id ? catalogo?.tipos.find((tipo) => tipo.id === id)?.nombre ?? 'Tipo no disponible' : null

  const alcanzoMaximo = especialidades.length >= maximo

  function agregar() {
    const faltantes: { area?: string; tipo?: string } = {}
    if (!areaId) {
      faltantes.area = 'Selecciona un área jurídica.'
    } else if (tiposDelArea.length === 0) {
      faltantes.tipo = 'El área elegida no tiene tipos de caso activos. Elige otra área jurídica.'
    } else if (!tipoCasoId) {
      faltantes.tipo = 'Selecciona un tipo de caso.'
    }
    setErroresSeleccion(faltantes)
    if (faltantes.area || faltantes.tipo) return

    if (alcanzoMaximo) {
      setMensaje(`Alcanzaste el límite de ${maximo} relaciones. Quita una para añadir otra.`)
      return
    }

    if (
      limitePorConjunto !== undefined &&
      (descomponerEspecialidades([...especialidades, { areaId, tipoCasoId }]).areaIds.length > limitePorConjunto ||
        descomponerEspecialidades([...especialidades, { areaId, tipoCasoId }]).tipoCasoIds.length > limitePorConjunto)
    ) {
      setMensaje(
        `La recuperación del perfil admite como máximo ${limitePorConjunto} áreas y ${limitePorConjunto} tipos de caso distintos. Quita una relación para añadir esta.`,
      )
      return
    }

    if (especialidades.some((item) => item.areaId === areaId && item.tipoCasoId === tipoCasoId)) {
      setMensaje(`Esa relación ya está en tu lista: ${nombreArea(areaId)} • ${nombreTipo(tipoCasoId) ?? ''}.`)
      return
    }

    alCambiar([...especialidades, { areaId, tipoCasoId }])
    setTipoCasoId('')
    setMensaje(null)
    setErroresSeleccion({})
  }

  function quitar(indice: number) {
    alCambiar(especialidades.filter((_, posicion) => posicion !== indice))
    setMensaje(null)
  }

  return (
    <Fieldset.Root invalid={Boolean(error || erroresSeleccion.area || erroresSeleccion.tipo)}>
      <Fieldset.Legend>
        {titulo}
        {requerido && (
          <Text as="span" color="fg.error" aria-hidden>
            {' '}
            *
          </Text>
        )}
      </Fieldset.Legend>
      <Fieldset.HelperText>{ayuda}</Fieldset.HelperText>
      <Fieldset.Content>
        {cargandoCatalogo && <Text color="fg.muted">Cargando el catálogo…</Text>}
        {errorCatalogo && (
          <Text color="fg.error" role="alert">
            No se pudo cargar el catálogo activo: {errorCatalogo}
          </Text>
        )}

        <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
          <Field.Root invalid={Boolean(erroresSeleccion.area)}>
            <Field.Label>Área jurídica</Field.Label>
            <NativeSelect.Root disabled={cargandoCatalogo || deshabilitado}>
              <NativeSelect.Field
                value={areaId}
                onChange={(evento) => {
                  setAreaId(evento.target.value)
                  setTipoCasoId('')
                  setErroresSeleccion({})
                  setMensaje(null)
                }}
                aria-label="Área jurídica"
              >
                <option value="">Selecciona un área</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.nombre}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
            <Field.ErrorText>{erroresSeleccion.area}</Field.ErrorText>
          </Field.Root>

          <Field.Root invalid={Boolean(erroresSeleccion.tipo)}>
            <Field.Label>Tipo de caso</Field.Label>
            <NativeSelect.Root disabled={!areaId || tiposDelArea.length === 0 || deshabilitado}>
              <NativeSelect.Field
                value={tipoCasoId}
                onChange={(evento) => setTipoCasoId(evento.target.value)}
                aria-label="Tipo de caso del área elegida"
              >
                <option value="">
                  {!areaId ? 'Elige primero un área' : tiposDelArea.length === 0 ? 'Sin tipos de caso activos' : 'Selecciona un tipo'}
                </option>
                {tiposDelArea.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nombre}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
            <Field.ErrorText>{erroresSeleccion.tipo}</Field.ErrorText>
          </Field.Root>
        </SimpleGrid>

        <Flex>
          <Button
            type="button"
            variant="outline"
            onClick={agregar}
            disabled={alcanzoMaximo || deshabilitado || cargandoCatalogo || Boolean(errorCatalogo)}
          >
            <Plus aria-hidden size={16} />
            {textoBoton}
          </Button>
        </Flex>

        {mensaje && (
          <Text role="status" color="fg.warning" textStyle="body-sm">
            {mensaje}
          </Text>
        )}

        {especialidades.length === 0 ? (
          <Text color="fg.muted" textStyle="body-sm">
            {textoVacio}
          </Text>
        ) : (
          <Stack as="ul" listStyleType="none" p="0" m="0" gap="2" aria-label="Relaciones añadidas">
            {especialidades.map((especialidad, indice) => {
              const area = nombreArea(especialidad.areaId)
              const tipo = nombreTipo(especialidad.tipoCasoId)
              return (
                <Flex
                  as="li"
                  key={`${especialidad.areaId}-${especialidad.tipoCasoId ?? 'sin-tipo'}`}
                  justify="space-between"
                  align="center"
                  gap="3"
                  px="3"
                  py="2"
                  borderWidth="1px"
                  borderColor="border"
                  borderRadius="md"
                >
                  <Text textStyle="body-sm">
                    {area}
                    <Text as="span" color="fg.muted">
                      {' '}
                      • {tipo ?? 'sin tipo de caso declarado'}
                    </Text>
                  </Text>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={() => quitar(indice)}
                    disabled={deshabilitado}
                    aria-label={`Quitar la relación ${area} • ${tipo ?? 'sin tipo de caso declarado'}`}
                  >
                    <X aria-hidden size={14} />
                    Eliminar
                  </Button>
                </Flex>
              )
            })}
          </Stack>
        )}
      </Fieldset.Content>
      <Fieldset.ErrorText>{error}</Fieldset.ErrorText>
    </Fieldset.Root>
  )
}
