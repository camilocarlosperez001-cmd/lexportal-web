import { Box, Button, Container, Flex, Link as ChakraLink, Text } from '@chakra-ui/react'
import { LogOut, Scale } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useSesion } from '../features/auth/hooks/useSesion'
import { AvisosEnVivo } from '../features/notificaciones/components/AvisosEnVivo'
import { AvisoEvidenciasPendientes } from '../features/perfil/components/AvisoEvidenciasPendientes'
import { AvisoPublicacionPendiente } from '../features/perfil/components/AvisoPublicacionPendiente'
import { ETIQUETA_ROL } from '../utils/etiquetas'
import type { EnlaceMenu } from '../app/navigation'

type PanelShellProps = {
  enlaces: EnlaceMenu[]
  seccion: string
}

/** Marco de las áreas autenticadas: cabecera con navegación por rol y contenido de la ruta. */
export function PanelShell({ enlaces, seccion }: PanelShellProps) {
  const { cuenta, cerrarSesion } = useSesion()
  const ubicacion = useLocation()

  return (
    <Flex minH="100dvh" direction="column">
      <ChakraLink href="#contenido" position="absolute" top="-20" left="4" zIndex="skipNav" bg="bg.panel" p="3" _focus={{ top: '4' }}>
        Saltar al contenido
      </ChakraLink>
      <Box as="header" bg="bg.panel" borderBottomWidth="1px" position="sticky" top="0" zIndex="docked">
        <Container maxW="7xl" px={{ base: 'margin-mobile', md: 'gutter', xl: 'margin' }}>
          <Flex minH="16" align="center" justify="space-between" gap="4" wrap="wrap" py="2">
            <Flex align="center" gap="3" minW="0">
              <ChakraLink asChild color="primary" textDecoration="none" _hover={{ textDecoration: 'none' }}>
                <NavLink to="/" aria-label="LexPortal, inicio">
                  <Flex align="center" gap="2">
                    <Box bg="primary" color="on-primary" p="2" borderRadius="lg"><Scale aria-hidden size={20} /></Box>
                    <Text textStyle="title-md" fontWeight="700">LexPortal</Text>
                  </Flex>
                </NavLink>
              </ChakraLink>
              <Text textStyle="label-caps" color="fg.muted" display={{ base: 'none', sm: 'block' }}>{seccion}</Text>
            </Flex>
            <Flex align="center" gap="3" minW="0">
              <Box textAlign="right" display={{ base: 'none', md: 'block' }} minW="0">
                <Text textStyle="title-sm" truncate>{cuenta?.nombre_completo}</Text>
                <Text textStyle="body-sm" color="fg.muted">
                  {cuenta ? ETIQUETA_ROL[cuenta.rol] : ''}
                </Text>
              </Box>
              <Button size="sm" variant="outline" onClick={() => void cerrarSesion()}>
                <LogOut aria-hidden size={16} />
                <Box as="span" display={{ base: 'none', sm: 'inline' }}>Cerrar sesión</Box>
              </Button>
            </Flex>
          </Flex>
          <Flex as="nav" aria-label={`Secciones de ${seccion}`} gap="1" overflowX="auto" pb="2">
            {enlaces.map((enlace) => {
              const activo = ubicacion.pathname === enlace.ruta || ubicacion.pathname.startsWith(`${enlace.ruta}/`)
              const Icono = enlace.icono
              return (
                <Box
                  key={enlace.ruta}
                  asChild
                  flexShrink="0"
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
        </Container>
      </Box>
      <Container as="main" id="contenido" tabIndex={-1} flex="1" maxW="7xl" px={{ base: 'margin-mobile', md: 'gutter', xl: 'margin' }} py={{ base: '6', md: '10' }}>
        {/* Anuncio inmediato de avisos (CU 15): no renderiza nada, solo escucha. */}
        <AvisosEnVivo />

        {/* Segundo momento del alta profesional: recordatorio de lo que falta. Se remonta
            al cambiar de sección para reflejar de inmediato lo que se acabe de completar. */}
        {cuenta?.rol === 'abogado' && (
          <>
            <AvisoEvidenciasPendientes key={`alta-${ubicacion.pathname}`} cuentaId={cuenta.id} />
            {/* Verificación aprobada que aún no se publica: la visibilidad la decide el titular */}
            <AvisoPublicacionPendiente key={`publicacion-${ubicacion.pathname}`} cuentaId={cuenta.id} />
          </>
        )}
        <Outlet />
      </Container>
      <Box as="footer" borderTopWidth="1px" py="6">
        <Container maxW="7xl" px={{ base: 'margin-mobile', md: 'gutter', xl: 'margin' }}>
          <Text textStyle="body-sm" color="fg.muted">
            El contacto a través de LexPortal no implica contratación ni garantiza resultados jurídicos.
          </Text>
        </Container>
      </Box>
    </Flex>
  )
}
