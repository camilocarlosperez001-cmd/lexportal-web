import { Box, Button, Container, Flex, Link as ChakraLink, Text } from '@chakra-ui/react'
import { Scale } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ENLACES_PUBLICOS, rutaInicialPorRol } from '../app/navigation'
import { useSesion } from '../features/auth/hooks/useSesion'

/** Marco público: presentación, directorio, registro y acceso. */
export function PublicLayout() {
  const { estado, cuenta } = useSesion()
  const ubicacion = useLocation()
  const conSesion = estado === 'con-sesion' && cuenta !== null

  return (
    <Flex minH="100dvh" direction="column">
      <ChakraLink href="#contenido" position="absolute" top="-20" left="4" zIndex="skipNav" bg="bg.panel" p="3" _focus={{ top: '4' }}>
        Saltar al contenido
      </ChakraLink>
      <Box as="header" bg="bg.panel" borderBottomWidth="1px">
        <Container maxW="7xl" px={{ base: 'margin-mobile', md: 'gutter', xl: 'margin' }}>
          <Flex minH="20" align="center" justify="space-between" gap="4" wrap="wrap" py="2">
            <ChakraLink asChild color="primary" textDecoration="none" _hover={{ textDecoration: 'none' }}>
              <NavLink to="/" aria-label="LexPortal, inicio">
                <Flex align="center" gap="3">
                  <Box bg="primary" color="on-primary" p="2" borderRadius="lg"><Scale aria-hidden size={24} /></Box>
                  <Box>
                    <Text textStyle="title-md" fontWeight="700">LexPortal</Text>
                    <Text textStyle="body-sm" color="fg.muted" display={{ base: 'none', sm: 'block' }}>
                      Orientación y contacto legal
                    </Text>
                  </Box>
                </Flex>
              </NavLink>
            </ChakraLink>
            <Flex align="center" gap={{ base: '2', md: '4' }} wrap="wrap">
              <Flex as="nav" aria-label="Navegación principal" gap="1">
                {ENLACES_PUBLICOS.map((enlace) => {
                  const activo = ubicacion.pathname.startsWith(enlace.ruta)
                  const Icono = enlace.icono
                  return (
                    <Box
                      key={enlace.ruta}
                      asChild
                      borderRadius="md"
                      bg={activo ? 'bg.subtle' : 'transparent'}
                      color={activo ? 'primary' : 'fg.muted'}
                      fontWeight={activo ? '600' : '500'}
                      _hover={{ bg: 'bg.subtle', color: 'fg' }}
                    >
                      <NavLink to={enlace.ruta} aria-current={activo ? 'page' : undefined}>
                        <Flex align="center" gap="2" px="3" py="2">
                          <Icono aria-hidden size={18} />
                          <Text textStyle="label-md">{enlace.etiqueta}</Text>
                        </Flex>
                      </NavLink>
                    </Box>
                  )
                })}
              </Flex>
              {conSesion ? (
                <Button asChild size="sm">
                  <NavLink to={cuenta.rol === 'administrador' ? '/admin/verificacion' : rutaInicialPorRol(cuenta.rol)}>
                    Ir a mi cuenta
                  </NavLink>
                </Button>
              ) : (
                <Flex align="center" gap="2">
                  <Button asChild size="sm" variant="outline">
                    <NavLink to="/login">Iniciar sesión</NavLink>
                  </Button>
                  <Button asChild size="sm">
                    <NavLink to="/registro">Crear cuenta</NavLink>
                  </Button>
                </Flex>
              )}
            </Flex>
          </Flex>
        </Container>
      </Box>
      <Container as="main" id="contenido" tabIndex={-1} flex="1" maxW="7xl" px={{ base: 'margin-mobile', md: 'gutter', xl: 'margin' }} py={{ base: '8', md: '12' }}>
        <Outlet />
      </Container>
      <Box as="footer" borderTopWidth="1px" py="6">
        <Container maxW="7xl" px={{ base: 'margin-mobile', md: 'gutter', xl: 'margin' }}>
          <Text textStyle="body-sm" color="fg.muted">
            El contacto a través de LexPortal no implica contratación ni garantiza resultados jurídicos. La búsqueda del
            directorio es pública y no exige registro.
          </Text>
        </Container>
      </Box>
    </Flex>
  )
}
