import { useState } from 'react'
import { Alert, Button, Field, Flex, NativeSelect, Stack, Text, Textarea } from '@chakra-ui/react'
import { Compass, Info } from 'lucide-react'
import { FeedbackState } from '../../../components/shared/FeedbackState'
import { toaster } from '../../../components/ui/toaster-store'
import { useConsulta } from '../../../hooks/useConsulta'
import { listarAreas, listarRelacionesAreaTipoCaso, listarTiposCaso, tiposCasoDeAreas } from '../../catalogo/services/catalogo'
import { guardarOrientacion, type Orientacion } from '../services/solicitudes'
import { formatearFechaHora } from '../../../utils/fechas'
import { mensajeDeError } from '../../../utils/errores'

const SIN_SELECCION = ''

export type FormularioOrientacionProps = {
  solicitudId: string
  orientacion: Orientacion | null
  /** Se invoca tras guardar para recargar la orientación registrada. */
  alGuardar: () => void
}

/**
 * Orientación hacia otra clasificación jurídica (CU 20). Recomienda un área o un tipo de
 * caso del catálogo activo y admite un comentario general. No transfiere la solicitud, no
 * envía el relato ni datos personales a otro abogado y no sustituye una decisión de estado.
 */
export function FormularioOrientacion({ solicitudId, orientacion, alGuardar }: FormularioOrientacionProps) {
  const areas = useConsulta(() => listarAreas({ soloActivas: true }), 'areas-activas-orientacion')
  const tipos = useConsulta(() => listarTiposCaso({ soloActivos: true }), 'tipos-caso-activos-orientacion')
  const relaciones = useConsulta(() => listarRelacionesAreaTipoCaso(), 'relaciones-area-tipo-caso')

  const [areaId, setAreaId] = useState<string>(orientacion?.area_id ?? SIN_SELECCION)
  const [tipoCasoId, setTipoCasoId] = useState<string>(orientacion?.tipo_caso_id ?? SIN_SELECCION)
  const [comentario, setComentario] = useState(orientacion?.comentario_general ?? '')
  const [errores, setErrores] = useState<{ general?: string; envio?: string }>({})
  const [guardando, setGuardando] = useState(false)

  const tiposDisponibles = tiposCasoDeAreas(relaciones.datos ?? [], tipos.datos ?? [], areaId ? [areaId] : [])
  const catalogosConError = areas.error !== null && tipos.error !== null
  const catalogosCargando = areas.cargando || tipos.cargando
  const areaSeleccionada = areas.datos?.find((area) => area.id === areaId) ?? null
  const tipoSeleccionado = tiposDisponibles.find((tipo) => tipo.id === tipoCasoId) ?? null
  const registradaEn = formatearFechaHora(orientacion?.creada_en)

  function elegirArea(valor: string) {
    setAreaId(valor)
    // Un tipo de caso que no pertenece al área elegida dejaría la recomendación incoherente.
    if (valor && tipoCasoId && !tiposCasoDeAreas(relaciones.datos ?? [], tipos.datos ?? [], [valor]).some((tipo) => tipo.id === tipoCasoId)) {
      setTipoCasoId(SIN_SELECCION)
    }
  }

  async function enviar() {
    const hayContenido = Boolean(areaId || tipoCasoId || comentario.trim())
    if (!hayContenido) {
      setErrores({
        general:
          'Selecciona un área, un tipo de caso o escribe un comentario general. Si no hay una clasificación concreta, el comentario por sí solo es suficiente.',
      })
      return
    }
    setErrores({})
    setGuardando(true)
    try {
      await guardarOrientacion({
        solicitudId,
        areaId: areaId || null,
        tipoCasoId: tipoCasoId || null,
        comentarioGeneral: comentario.trim() ? comentario : null,
      })
      toaster.create({
        title: orientacion ? 'Orientación actualizada' : 'Orientación registrada',
        description: 'El ciudadano puede consultar la recomendación e iniciar una nueva búsqueda en el directorio.',
        type: 'success',
      })
      alGuardar()
    } catch (fallo: unknown) {
      setErrores({ envio: mensajeDeError(fallo, 'No se pudo guardar la orientación. Inténtalo de nuevo.') })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Stack gap="5">
      <Alert.Root status="info" alignItems="flex-start">
        <Alert.Indicator>
          <Info aria-hidden size={18} />
        </Alert.Indicator>
        <Alert.Content>
          <Alert.Title>Qué hace la orientación y qué no</Alert.Title>
          <Alert.Description>
            La orientación habilita una nueva búsqueda para el ciudadano usando tu recomendación. No transfiere esta
            solicitud a otro abogado, no envía el relato ni datos personales y no cambia el estado de la solicitud.
          </Alert.Description>
        </Alert.Content>
      </Alert.Root>

      {registradaEn && (
        <Text color="fg.muted" textStyle="body-sm">
          Orientación registrada el {registradaEn}. Puedes modificarla mientras conserves acceso a la solicitud.
        </Text>
      )}

      {catalogosConError ? (
        <FeedbackState
          kind="error"
          title="No se pudo cargar el catálogo jurídico"
          description="Sin el catálogo activo no es posible recomendar un área o un tipo de caso. Puedes reintentar o registrar únicamente un comentario general."
          action={
            <Button
              variant="outline"
              onClick={() => {
                areas.recargar()
                tipos.recargar()
              }}
            >
              Reintentar
            </Button>
          }
        />
      ) : (
        <Flex gap="4" direction={{ base: 'column', md: 'row' }} align="flex-start">
          <Field.Root flex="1" width="full">
            <Field.Label>Área jurídica recomendada</Field.Label>
            <NativeSelect.Root disabled={catalogosCargando || guardando}>
              <NativeSelect.Field value={areaId} onChange={(evento) => elegirArea(evento.target.value)}>
                <option value={SIN_SELECCION}>Sin área concreta</option>
                {(areas.datos ?? []).map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.nombre}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
            <Field.HelperText>
              {areas.error
                ? 'No se pudo cargar el catálogo de áreas; puedes orientar solo con el tipo de caso o el comentario.'
                : 'Un área declarada no acredita un título de especialización.'}
            </Field.HelperText>
          </Field.Root>

          <Field.Root flex="1" width="full">
            <Field.Label>Tipo de caso recomendado</Field.Label>
            <NativeSelect.Root disabled={catalogosCargando || guardando || Boolean(areaId && relaciones.cargando)}>
              <NativeSelect.Field value={tipoCasoId} onChange={(evento) => setTipoCasoId(evento.target.value)}>
                <option value={SIN_SELECCION}>Sin tipo de caso concreto</option>
                {tiposDisponibles.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nombre_cotidiano}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
            <Field.HelperText>
              {tipos.error
                ? 'No se pudo cargar el catálogo de tipos de caso; el comentario general sigue disponible.'
                : 'Si eliges un área, solo se ofrecen los tipos de caso asociados a ella.'}
            </Field.HelperText>
          </Field.Root>
        </Flex>
      )}

      <Field.Root invalid={Boolean(errores.general)}>
        <Field.Label>Comentario general (opcional)</Field.Label>
        <Textarea
          value={comentario}
          onChange={(evento) => setComentario(evento.target.value)}
          rows={4}
          maxLength={800}
          disabled={guardando}
          placeholder="Explica de forma general por qué el asunto corresponde a otra área o tipo de caso."
        />
        <Field.HelperText>
          Describe la recomendación sin incluir datos personales ni copiar el relato del ciudadano.
        </Field.HelperText>
        <Field.ErrorText>{errores.general}</Field.ErrorText>
      </Field.Root>

      {errores.envio && (
        <Field.Root invalid>
          <Field.ErrorText role="alert">{errores.envio}</Field.ErrorText>
        </Field.Root>
      )}

      <Flex gap="3" wrap="wrap" align="center">
        <Button onClick={() => void enviar()} loading={guardando} disabled={catalogosConError && !comentario.trim()}>
          <Compass aria-hidden size={16} />
          {orientacion ? 'Actualizar orientación' : 'Guardar orientación'}
        </Button>
        <Text textStyle="body-sm" color="fg.muted">
          {areaSeleccionada || tipoSeleccionado
            ? `Se recomendará ${[areaSeleccionada?.nombre, tipoSeleccionado?.nombre_cotidiano].filter(Boolean).join(' · ')}.`
            : 'Puedes guardar la orientación sin una clasificación concreta.'}
        </Text>
      </Flex>
    </Stack>
  )
}
