import { Box, Checkbox, Link as ChakraLink, Stack, Text } from '@chakra-ui/react'
import { ExternalLink } from 'lucide-react'
import { ETIQUETA_TIPO_DOCUMENTO } from '../../../utils/etiquetas'
import type { DocumentoLegal } from '../services/legales'

type AceptacionesLegalesProps = {
  documentos: DocumentoLegal[]
  seleccionados: string[]
  alCambiar: (documentoIds: string[]) => void
  error?: string
  deshabilitado?: boolean
}

const ID_ERROR = 'error-aceptaciones-legales'

/**
 * Consulta y aceptación de las versiones vigentes de términos, privacidad y tratamiento
 * de datos. Cada aceptación queda vinculada al identificador del documento aceptado.
 *
 * Nota de implementación: `Checkbox.Root` debe seguir siendo un `<label>` (su tipo es
 * HTMLProps<'label'>); es la asociación etiqueta–input lo que hace que el clic marque la
 * casilla. Por eso el elemento de lista (`li`) se envuelve por fuera y el enlace para
 * consultar el documento queda fuera de la etiqueta: abrir el documento no registra la
 * aceptación.
 */
export function AceptacionesLegales({ documentos, seleccionados, alCambiar, error, deshabilitado }: AceptacionesLegalesProps) {
  if (documentos.length === 0) {
    return (
      <Text color="fg.muted">
        No hay documentos legales publicados. No es posible completar el registro sin ellos.
      </Text>
    )
  }

  function alternar(documentoId: string, marcado: boolean) {
    const siguiente = marcado
      ? [...seleccionados, documentoId]
      : seleccionados.filter((id) => id !== documentoId)
    alCambiar(siguiente)
  }

  return (
    <Stack gap="4">
      <Stack gap="4" as="ul" listStyleType="none" p="0" m="0" aria-describedby={error ? ID_ERROR : undefined}>
        {documentos.map((documento) => {
          const marcado = seleccionados.includes(documento.id)
          const etiqueta = ETIQUETA_TIPO_DOCUMENTO[documento.tipo]
          return (
            <Box as="li" key={documento.id}>
              <Checkbox.Root
                value={documento.id}
                checked={marcado}
                disabled={deshabilitado}
                onCheckedChange={(detalles) => alternar(documento.id, detalles.checked === true)}
                alignItems="start"
              >
                <Checkbox.HiddenInput />
                <Checkbox.Control mt="0.5" />
                <Checkbox.Label fontWeight="400">
                  <Text as="span" fontWeight="600">{etiqueta}</Text>{' '}
                  <Text as="span" color="fg.muted">(versión {documento.version})</Text>
                </Checkbox.Label>
              </Checkbox.Root>
              <ChakraLink
                href={documento.referencia_contenido}
                target="_blank"
                rel="noopener noreferrer"
                display="inline-flex"
                alignItems="center"
                gap="1"
                ml="7"
                mt="1"
                textStyle="body-sm"
                color="primary"
                fontWeight="600"
                aria-label={`Consultar ${etiqueta}, versión ${documento.version}`}
              >
                Consultar el documento
                <ExternalLink aria-hidden size={14} />
              </ChakraLink>
            </Box>
          )
        })}
      </Stack>

      {error && (
        <Text id={ID_ERROR} role="alert" textStyle="body-sm" color="fg.error" fontWeight="600">
          {error}
        </Text>
      )}

      <Text textStyle="body-sm" color="fg.muted">
        Se conserva la fecha y la versión de cada aceptación registrada. Abrir el documento no registra la aceptación.
      </Text>
    </Stack>
  )
}
