import type { ReactNode } from 'react'
import { Flex, Heading, Stack, Text } from '@chakra-ui/react'

type PageHeaderProps = {
  titulo: string
  descripcion?: string
  etiqueta?: string
  acciones?: ReactNode
}

/** Encabezado común de las vistas: título h1, contexto y acciones principales. */
export function PageHeader({ titulo, descripcion, etiqueta, acciones }: PageHeaderProps) {
  return (
    <Flex justify="space-between" align={{ base: 'stretch', md: 'end' }} gap="4" direction={{ base: 'column', md: 'row' }} mb="6">
      <Stack gap="2" maxW="3xl">
        {etiqueta && <Text textStyle="label-caps" color="secondary">{etiqueta}</Text>}
        <Heading as="h1" textStyle={{ base: 'headline-lg-mobile', md: 'headline-md' }} color="primary">
          {titulo}
        </Heading>
        {descripcion && <Text color="fg.muted">{descripcion}</Text>}
      </Stack>
      {acciones && <Flex gap="2" wrap="wrap" align="center">{acciones}</Flex>}
    </Flex>
  )
}
