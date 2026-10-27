import { Component, type ReactNode } from 'react'
import { Button, Card, Heading, Stack, Text } from '@chakra-ui/react'

type LimiteDeErroresProps = { children: ReactNode }
type EstadoLimite = { fallo: boolean }

/**
 * Contiene fallos inesperados de render para que la interfaz informe el problema en
 * lugar de dejar la pantalla en blanco. No registra datos del usuario: sólo evita
 * que un error de presentación se presente como una lista vacía o un contador en cero.
 */
export class LimiteDeErrores extends Component<LimiteDeErroresProps, EstadoLimite> {
  state: EstadoLimite = { fallo: false }

  static getDerivedStateFromError(): EstadoLimite {
    return { fallo: true }
  }

  reiniciar = () => {
    this.setState({ fallo: false })
  }

  render() {
    if (this.state.fallo) {
      return (
        <Card.Root maxW="2xl" mx="auto" my="10">
          <Card.Body gap="4">
            <Heading as="h1" textStyle="headline-md" color="primary">
              No pudimos mostrar esta pantalla
            </Heading>
            <Text color="fg.muted">
              Ocurrió un error inesperado al presentar la información. Vuelve a intentarlo; si el problema continúa,
              cierra la sesión y entra de nuevo.
            </Text>
            <Stack direction={{ base: 'column', sm: 'row' }} gap="3">
              <Button onClick={this.reiniciar}>Reintentar</Button>
              <Button variant="outline" onClick={() => { window.location.assign('/') }}>
                Volver al inicio
              </Button>
            </Stack>
          </Card.Body>
        </Card.Root>
      )
    }
    return this.props.children
  }
}
