// Directorio público de abogados (CU 05, 06 y 07): búsqueda por texto, filtros combinados
// de área y tipo de caso, y filtro de ciudad. El estado vive en la URL para que la consulta
// sea enlazable y recargable; no se exige registro.

import { useCallback, useMemo, useRef, useState } from 'react'
import {
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
import { RotateCcw, Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { FeedbackState } from '../../../components/shared/FeedbackState'
import { PageHeader } from '../../../components/shared/PageHeader'
import { useConsulta } from '../../../hooks/useConsulta'
import {
  listarAreas,
  listarRelacionesAreaTipoCaso,
  listarTiposCaso,
} from '../../catalogo/services/catalogo'
import { SelectorEspecialidades } from '../../perfil/components/SelectorEspecialidades'
import { descomponerEspecialidades, especialidadesDesdeConjuntos, type Especialidad } from '../../perfil/utils'
import { TarjetaPerfil } from '../components/TarjetaPerfil'
import { buscarAbogados, listarCiudadesDisponibles } from '../services/directorio'
import type { FiltrosDirectorio } from '../types'
import {
  combinarOpciones,
  contarFiltrosActivos,
  FILTROS_VACIOS,
  hayFiltrosActivos,
  leerFiltrosDeParams,
  opcionesDeAreas,
  opcionesDeTiposCaso,
  serializarFiltros,
} from '../utils'

/** Tipos de caso activos: los inactivos no se ofrecen para nuevas selecciones (CU 07). */
function listarTiposCasoActivos() {
  return listarTiposCaso({ soloActivos: true })
}

export function DirectorioPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filtros = useMemo(() => leerFiltrosDeParams(searchParams), [searchParams])
  const formulario = useRef<HTMLFormElement>(null)
  // La lista de relaciones se deriva de los filtros de la URL hasta que el usuario la
  // edita; así el catálogo puede llegar después sin perder las relaciones activas.
  const [cambiosEspecialidades, setCambiosEspecialidades] = useState<Especialidad[] | null>(null)

  const actualizar = useCallback(
    (cambios: Partial<FiltrosDirectorio>) => {
      setSearchParams(serializarFiltros({ ...filtros, ...cambios }), { replace: true })
    },
    [filtros, setSearchParams],
  )

  /** Solo actualiza la URL si el texto cambió: evita reconsultas por envíos idénticos. */
  const aplicarFiltros = useCallback(() => {
    const datos = formulario.current ? new FormData(formulario.current) : null
    const busqueda = String(datos?.get('busqueda') ?? '').trim()
    const ciudad = String(datos?.get('ciudad') ?? '').trim()
    const cambios: Partial<FiltrosDirectorio> = {}
    if (busqueda !== filtros.busqueda) cambios.busqueda = busqueda
    if (ciudad !== filtros.ciudad) cambios.ciudad = ciudad
    if (Object.keys(cambios).length > 0) actualizar(cambios)
  }, [actualizar, filtros.busqueda, filtros.ciudad])

  const limpiarFiltros = useCallback(() => {
    // Se descarta la lista editada para que vuelva a derivarse de la URL (vacía).
    setCambiosEspecialidades(null)
    formulario.current?.reset()
    setSearchParams(serializarFiltros(FILTROS_VACIOS), { replace: true })
  }, [setSearchParams])

  const areas = useConsulta(() => listarAreas({ soloActivas: true }), 'directorio-areas-activas')
  const tiposCaso = useConsulta(() => listarTiposCasoActivos(), 'directorio-tipos-caso-activos')
  const relaciones = useConsulta(() => listarRelacionesAreaTipoCaso(), 'directorio-relaciones-area-tipo-caso')
  const ciudades = useConsulta(() => listarCiudadesDisponibles(), 'directorio-ciudades-disponibles')

  const claveResultados = useMemo(
    () => JSON.stringify([filtros.busqueda, filtros.areas, filtros.tiposCaso, filtros.ciudad]),
    [filtros],
  )
  const resultados = useConsulta(
    () =>
      buscarAbogados({
        busqueda: filtros.busqueda,
        areas: filtros.areas,
        tiposCaso: filtros.tiposCaso,
        ciudad: filtros.ciudad,
      }),
    claveResultados,
  )

  const opcionesAreas = useMemo(
    () => combinarOpciones(opcionesDeAreas(areas.datos ?? []), (resultados.datos ?? []).flatMap((perfil) => perfil.areas)),
    [areas.datos, resultados.datos],
  )
  const opcionesTiposCaso = useMemo(
    () =>
      combinarOpciones(
        opcionesDeTiposCaso(tiposCaso.datos ?? []),
        (resultados.datos ?? []).flatMap((perfil) => perfil.tiposCaso),
      ),
    [tiposCaso.datos, resultados.datos],
  )

  const catalogoFiltros = useMemo(
    () => ({
      areas: opcionesAreas,
      tipos: opcionesTiposCaso,
      relaciones: relaciones.datos ?? [],
    }),
    [opcionesAreas, opcionesTiposCaso, relaciones.datos],
  )
  const especialidades =
    cambiosEspecialidades ?? especialidadesDesdeConjuntos(catalogoFiltros, filtros.areas, filtros.tiposCaso)

  const filtrosActivos = contarFiltrosActivos(filtros)
  const total = resultados.datos?.length ?? 0

  const botonLimpiar = hayFiltrosActivos(filtros) ? (
    <Button variant="outline" onClick={limpiarFiltros}>
      <RotateCcw aria-hidden size={16} />
      Limpiar filtros
    </Button>
  ) : undefined

  return (
    <Stack gap="8">
      <PageHeader
        titulo="Directorio de abogados"
        descripcion="Busca por nombre, por área jurídica o por la situación que necesitas resolver. El directorio es público y no exige registro."
        etiqueta="BÚSQUEDA PÚBLICA"
      />

      <Card.Root>
        <Card.Body gap="6">
          <form
            ref={formulario}
            onSubmit={(evento) => {
              evento.preventDefault()
              aplicarFiltros()
            }}
          >
            <Stack gap="6">
              <Field.Root>
                <Field.Label>Buscar</Field.Label>
                <Flex gap="3" direction={{ base: 'column', sm: 'row' }} align={{ base: 'stretch', sm: 'center' }}>
                  <Input
                    key={`busqueda-${filtros.busqueda}`}
                    name="busqueda"
                    defaultValue={filtros.busqueda}
                    placeholder="Nombre del abogado, área o situación jurídica"
                    maxLength={120}
                    flex="1"
                  />
                  <Button type="submit">
                    <Search aria-hidden size={16} />
                    Buscar
                  </Button>
                </Flex>
                <Field.HelperText>
                  Se combina con los filtros seleccionados. También reconoce términos asociados a cada situación.
                </Field.HelperText>
              </Field.Root>

              <SimpleGrid columns={{ base: 1, lg: 2 }} gap="6">
                <SelectorEspecialidades
                  catalogo={catalogoFiltros}
                  cargandoCatalogo={areas.cargando || tiposCaso.cargando || relaciones.cargando}
                  errorCatalogo={areas.error ?? tiposCaso.error ?? relaciones.error}
                  especialidades={especialidades}
                  alCambiar={(lista) => {
                    setCambiosEspecialidades(lista)
                    const { areaIds, tipoCasoIds } = descomponerEspecialidades(lista)
                    actualizar({ areas: areaIds, tiposCaso: tipoCasoIds })
                  }}
                  titulo="Especialidad (área y tipo de caso)"
                  ayuda="Elige un área jurídica, después un tipo de caso de esa área y añádelo a la lista. Se muestran los perfiles que declaran alguna de estas áreas y alguno de estos tipos de caso."
                  textoBoton="Añadir a la relación"
                  textoVacio="Todavía no has añadido relaciones al filtro."
                />

                <Stack gap="6">
                  <Field.Root>
                    <Field.Label>Ciudad</Field.Label>
                    <Input
                      key={`ciudad-${filtros.ciudad}`}
                      name="ciudad"
                      defaultValue={filtros.ciudad}
                      placeholder="Ciudad de atención"
                      list="directorio-ciudades"
                      maxLength={80}
                    />
                    <datalist id="directorio-ciudades">
                      {(ciudades.datos ?? []).map((nombre) => (
                        <option key={nombre} value={nombre} />
                      ))}
                    </datalist>
                    <Field.HelperText>
                      {ciudades.error
                        ? 'No se pudo cargar la lista de ciudades; escribe la ciudad y pulsa Buscar.'
                        : 'Escribe la ciudad y pulsa Buscar para aplicarla.'}
                    </Field.HelperText>
                  </Field.Root>
                </Stack>
              </SimpleGrid>

              <Flex gap="3" wrap="wrap" align="center" justify="space-between">
                <Text textStyle="body-sm" color="fg.muted">
                  {filtrosActivos > 0
                    ? `${filtrosActivos} ${filtrosActivos === 1 ? 'filtro activo' : 'filtros activos'}`
                    : 'Sin filtros activos'}
                </Text>
                <Flex gap="3" wrap="wrap">
                  <Button type="submit" variant="outline">Aplicar filtros</Button>
                  {botonLimpiar}
                </Flex>
              </Flex>
            </Stack>
          </form>
        </Card.Body>
      </Card.Root>

      <Box as="section" aria-label="Resultados de la búsqueda">
        <Flex align="center" justify="space-between" gap="4" wrap="wrap" mb="4">
          <Heading as="h2" textStyle="title-md">
            {resultados.cargando
              ? 'Buscando perfiles…'
              : total === 1
                ? '1 perfil disponible'
                : `${total} perfiles disponibles`}
          </Heading>
          <Text textStyle="body-sm" color="fg.muted">
            Solo se muestran perfiles verificados, activos y visibles. Una cuenta suspendida o pendiente de aprobación no
            aparece aquí.
          </Text>
        </Flex>

        {resultados.error ? (
          <FeedbackState
            kind="error"
            title="No se pudo completar la búsqueda"
            description={resultados.error}
            action={<Button variant="outline" onClick={resultados.recargar}>Reintentar</Button>}
          />
        ) : resultados.cargando ? (
          <FeedbackState kind="loading" title="Buscando abogados" description="Estamos consultando el directorio público." />
        ) : total === 0 ? (
          <FeedbackState
            title="Sin coincidencias"
            description={
              hayFiltrosActivos(filtros)
                ? 'Ningún perfil coincide con los criterios seleccionados. Prueba con otra área, otra situación u otro texto.'
                : 'No hay perfiles disponibles en este momento.'
            }
            action={botonLimpiar}
          />
        ) : (
          <SimpleGrid columns={{ base: 1, xl: 2 }} gap="gutter">
            {(resultados.datos ?? []).map((perfil) => (
              <TarjetaPerfil key={perfil.id} perfil={perfil} />
            ))}
          </SimpleGrid>
        )}
      </Box>
    </Stack>
  )
}
