import type { ReactNode } from 'react'
import { Card, Heading, Stack } from '@chakra-ui/react'

export type SeccionDetalleProps = {
  titulo: string
  descripcion?: string
  acciones?: ReactNode
  children: ReactNode
}

/** Bloque con título reutilizado por los detalles de solicitud enviada y recibida. */
export function SeccionDetalle({ titulo, descripcion, acciones, children }: SeccionDetalleProps) {
  return (
    <Card.Root as="section" borderWidth="1px" borderColor="border" bg="bg.panel">
      <Card.Header>
        <Stack gap="2">
          <Heading as="h2" textStyle="title-md" color="primary">
            {titulo}
          </Heading>
          {descripcion && <Card.Description>{descripcion}</Card.Description>}
        </Stack>
      </Card.Header>
      <Card.Body pt="0">
        <Stack gap="4">
          {children}
          {acciones}
        </Stack>
      </Card.Body>
    </Card.Root>
  )
}
