import { Box, Button, Card, Flex, Heading, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import { BadgeCheck, MessageSquare, Search, ShieldCheck, UserRoundPlus } from 'lucide-react'
import { useSesion } from '../features/auth/hooks/useSesion'
import { rutaInicialPorRol } from './navigation'

const pasos = [
  {
    icon: Search,
    title: 'Busca sin registrarte',
    description: 'Consulta el directorio por área jurídica o por la situación para la que necesitas ayuda. Sólo se muestran perfiles verificados, activos y visibles.',
  },
  {
    icon: ShieldCheck,
    title: 'Conoce el alcance de la verificación',
    description: 'Cada perfil indica la fecha y el alcance de la verificación vigente. Un área declarada no acredita un título de especialización.',
  },
  {
    icon: MessageSquare,
    title: 'Solicita contacto',
    description: 'Envía tu solicitud con una descripción breve. Si el abogado la acepta, se habilita una conversación de texto entre ambos.',
  },
]

export function HomePage() {
  const { estado, cuenta } = useSesion()
  const conSesion = estado === 'con-sesion' && cuenta !== null

  return (
    <Stack gap={{ base: '12', md: '16' }}>
      <Stack gap="6" maxW="3xl" align="start">
        <Text textStyle="label-caps" color="secondary">ORIENTACIÓN Y CONTACTO LEGAL</Text>
        <Heading as="h1" textStyle={{ base: 'headline-lg-mobile', md: 'display' }} color="primary">
          El primer paso para encontrar ayuda legal.
        </Heading>
        <Text textStyle="body-lg" color="fg.muted" maxW="2xl">
          LexPortal conecta a ciudadanos con abogados: búsqueda pública, perfiles con verificación profesional trazable,
          solicitudes de contacto y mensajería de texto entre los participantes.
        </Text>
        <Flex gap="3" wrap="wrap">
          <Button asChild>
            <RouterLink to="/directorio">
              <Search aria-hidden size={18} />
              Buscar abogados
            </RouterLink>
          </Button>
          {conSesion ? (
            <Button asChild variant="outline">
              <RouterLink to={cuenta.rol === 'administrador' ? '/admin/verificacion' : rutaInicialPorRol(cuenta.rol)}>
                Ir a mi cuenta
              </RouterLink>
            </Button>
          ) : (
            <>
              <Button asChild variant="outline">
                <RouterLink to="/registro/ciudadano">
                  <UserRoundPlus aria-hidden size={18} />
                  Crear cuenta de ciudadano
                </RouterLink>
              </Button>
              <Button asChild variant="ghost">
                <RouterLink to="/registro/abogado">
                  <BadgeCheck aria-hidden size={18} />
                  Registrarme como abogado
                </RouterLink>
              </Button>
            </>
          )}
        </Flex>
        <Text textStyle="body-sm" color="fg.muted">
          El contacto a través de LexPortal no implica contratación ni garantiza resultados jurídicos. La búsqueda del
          directorio continúa disponible sin registro.
        </Text>
      </Stack>

      <Box as="section" id="como-funciona" scrollMarginTop="8">
        <Heading as="h2" textStyle="headline-md" mb="6">Un proceso claro, paso a paso</Heading>
        <SimpleGrid columns={{ base: 1, md: 3 }} gap="gutter">
          {pasos.map(({ icon: Icono, title, description }, indice) => (
            <Card.Root key={title}>
              <Card.Body gap="4">
                <Box color="primary" bg="bg.subtle" p="3" borderRadius="md" alignSelf="start">
                  <Icono aria-hidden size={24} />
                </Box>
                <Text textStyle="label-caps" color="fg.muted">PASO 0{indice + 1}</Text>
                <Heading as="h3" textStyle="title-md">{title}</Heading>
                <Text color="fg.muted">{description}</Text>
              </Card.Body>
            </Card.Root>
          ))}
        </SimpleGrid>
      </Box>

      <Box as="section">
        <Card.Root>
          <Card.Body gap="4">
            <Heading as="h2" textStyle="headline-sm" color="primary">Para profesionales del derecho</Heading>
            <Text color="fg.muted">
              El registro profesional se presenta por pasos: datos de la cuenta, perfil público, áreas y tipos de caso que
              atiende, información de verificación con evidencias privadas y confirmación de las aceptaciones legales. La
              inscripción queda pendiente de revisión administrativa y no se publica hasta que exista una verificación
              aprobada.
            </Text>
            <Flex gap="3" wrap="wrap">
              <Button asChild variant="outline">
                <RouterLink to="/registro/abogado">Conocer el registro profesional</RouterLink>
              </Button>
              <Button asChild variant="ghost">
                <RouterLink to="/login">Ya tengo cuenta</RouterLink>
              </Button>
            </Flex>
          </Card.Body>
        </Card.Root>
      </Box>
    </Stack>
  )
}
