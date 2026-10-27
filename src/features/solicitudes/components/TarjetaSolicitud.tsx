import type { ReactNode } from 'react'
import { Badge, Box, Card, Flex, Heading, Stack, Text } from '@chakra-ui/react'
import { ListaDatos, type DatoPresentacion } from '../../../components/shared/ListaDatos'

export type TarjetaSolicitudProps = {
  etiqueta: string
  titulo: string
  descripcion?: string
  insignias?: ReactNode
  datos: DatoPresentacion[]
  acciones?: ReactNode
}

/**
 * Tarjeta de solicitud compartida por «Mis solicitudes» (CU 09) y «Solicitudes recibidas»
 * (CU 10). Solo presenta los campos que recibe: no consulta ni completa datos por su cuenta.
 */
export function TarjetaSolicitud({ etiqueta, titulo, descripcion, insignias, datos, acciones }: TarjetaSolicitudProps) {
  return (
    <Card.Root as="article" borderWidth="1px" borderColor="border" bg="bg.panel">
      <Card.Header>
        <Flex justify="space-between" align="flex-start" gap="4" wrap="wrap">
          <Stack gap="2" flex="1" minW="0">
            <Badge alignSelf="flex-start" colorPalette="gray" variant="subtle" size="sm">
              {etiqueta}
            </Badge>
            <Heading as="h3" textStyle="title-md" color="primary">
              {titulo}
            </Heading>
            {descripcion && (
              <Text color="fg.muted" textStyle="body-md">
                {descripcion}
              </Text>
            )}
          </Stack>
          {insignias && (
            <Flex gap="2" wrap="wrap" align="center">
              {insignias}
            </Flex>
          )}
        </Flex>
      </Card.Header>
      <Card.Body pt="0">
        <Box bg="bg.subtle" borderRadius="md" p="4">
          <ListaDatos items={datos} orientacion="vertical" />
        </Box>
      </Card.Body>
      {acciones && (
        <Card.Footer>
          <Flex gap="2" wrap="wrap" align="center">
            {acciones}
          </Flex>
        </Card.Footer>
      )}
    </Card.Root>
  )
}
