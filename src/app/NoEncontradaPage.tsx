import { Button, Card, Heading, Stack, Text } from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import { Search } from 'lucide-react'

export function NoEncontradaPage() {
  return (
    <Card.Root maxW="2xl" mx="auto">
      <Card.Body gap="4">
        <Heading as="h1" textStyle="headline-md" color="primary">La página no existe</Heading>
        <Text color="fg.muted">
          La dirección solicitada no corresponde a ninguna sección de LexPortal. Puedes volver al inicio o consultar el
          directorio público de abogados.
        </Text>
        <Stack direction={{ base: 'column', sm: 'row' }} gap="3">
          <Button asChild>
            <RouterLink to="/directorio">
              <Search aria-hidden size={18} />
              Buscar abogados
            </RouterLink>
          </Button>
          <Button asChild variant="outline">
            <RouterLink to="/">Volver al inicio</RouterLink>
          </Button>
        </Stack>
      </Card.Body>
    </Card.Root>
  )
}
