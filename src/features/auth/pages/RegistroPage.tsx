// Selección del tipo de cuenta (CU 01 y CU 02). La búsqueda pública no exige registro
// y la inscripción profesional queda pendiente de revisión administrativa.

import { Box, Button, Card, Flex, Heading, List, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { Link, Navigate } from 'react-router-dom'
import { BadgeCheck, Check, Search, ShieldCheck, UserRoundPlus } from 'lucide-react'
import { PageHeader } from '../../../components/shared/PageHeader'
import { FeedbackState } from '../../../components/shared/FeedbackState'
import { rutaInicialPorRol } from '../../../app/navigation'
import { useSesion } from '../hooks/useSesion'

const OPCIONES = [
  {
    icono: UserRoundPlus,
    etiqueta: 'CUENTA DE CIUDADANO',
    titulo: 'Necesito ayuda legal',
    descripcion:
      'Crea una cuenta para enviar solicitudes de contacto a los abogados del directorio y conversar por texto cuando acepten tu solicitud.',
    puntos: [
      'Búsqueda y consulta del directorio sin necesidad de cuenta.',
      'Envío de solicitudes de contacto con una descripción breve.',
      'Conversación de texto habilitada cuando el abogado acepta.',
      'Aceptación de términos, privacidad y tratamiento de datos.',
    ],
    ruta: '/registro/ciudadano',
    accion: 'Crear cuenta de ciudadano',
    variante: 'solid' as const,
  },
  {
    icono: BadgeCheck,
    etiqueta: 'CUENTA PROFESIONAL',
    titulo: 'Soy abogado y quiero recibir solicitudes',
    descripcion:
      'Solicita una cuenta profesional y presenta tu información y tus soportes de verificación. La inscripción queda pendiente de revisión administrativa.',
    puntos: [
      'Registro guiado en cinco pasos.',
      'Perfil público, áreas jurídicas y tipos de caso que atiendes.',
      'Soportes de verificación en un repositorio privado, nunca publicados.',
      'El perfil no se publica hasta que exista una verificación aprobada.',
    ],
    ruta: '/registro/abogado',
    accion: 'Solicitar cuenta profesional',
    variante: 'outline' as const,
  },
]

export function RegistroPage() {
  const { estado, cuenta } = useSesion()

  if (estado === 'cargando') {
    return <FeedbackState kind="loading" title="Comprobando tu sesión" />
  }

  if (estado === 'con-sesion' && cuenta) {
    return <Navigate to={rutaInicialPorRol(cuenta.rol)} replace />
  }

  return (
    <Stack gap="8">
      <PageHeader
        titulo="Crear una cuenta"
        descripcion="Elige el tipo de cuenta que necesitas. Cada una habilita funciones distintas dentro de la plataforma."
        etiqueta="REGISTRO"
      />

      <Box as="section" aria-labelledby="tipos-de-cuenta">
        <Heading as="h2" id="tipos-de-cuenta" srOnly>
          Tipos de cuenta
        </Heading>
        <SimpleGrid columns={{ base: 1, lg: 2 }} gap="gutter">
          {OPCIONES.map((opcion) => {
            const Icono = opcion.icono
            return (
              <Card.Root key={opcion.ruta} display="flex" flexDirection="column">
                <Card.Header>
                  <Flex align="center" gap="3">
                    <Box color="primary" bg="bg.subtle" p="3" borderRadius="md">
                      <Icono aria-hidden size={22} />
                    </Box>
                    <Stack gap="1">
                      <Text textStyle="label-caps" color="secondary">{opcion.etiqueta}</Text>
                      <Card.Title textStyle="title-md">{opcion.titulo}</Card.Title>
                    </Stack>
                  </Flex>
                </Card.Header>
                <Card.Body gap="4" flex="1">
                  <Text color="fg.muted">{opcion.descripcion}</Text>
                  <List.Root gap="2" textStyle="body-sm">
                    {opcion.puntos.map((punto) => (
                      <List.Item key={punto}>
                        <Flex gap="2" align="start">
                          <Box color="primary" mt="0.5"><Check aria-hidden size={16} /></Box>
                          <Text as="span" color="fg.muted">{punto}</Text>
                        </Flex>
                      </List.Item>
                    ))}
                  </List.Root>
                </Card.Body>
                <Card.Footer>
                  <Button asChild variant={opcion.variante} width="full">
                    <Link to={opcion.ruta}>{opcion.accion}</Link>
                  </Button>
                </Card.Footer>
              </Card.Root>
            )
          })}
        </SimpleGrid>
      </Box>

      <Card.Root bg="bg.subtle">
        <Card.Body gap="3">
          <Flex align="center" gap="2">
            <Search aria-hidden size={18} />
            <Heading as="h2" textStyle="title-sm">La búsqueda del directorio no exige registro</Heading>
          </Flex>
          <Text textStyle="body-sm" color="fg.muted">
            Puedes consultar los perfiles verificados, activos y visibles sin crear una cuenta ni iniciar sesión. El
            registro solo es necesario para enviar solicitudes de contacto, conversar o presentar tu perfil profesional.
          </Text>
          <Flex gap="3" wrap="wrap" pt="1">
            <Button asChild size="sm" variant="outline">
              <Link to="/directorio">
                <Search aria-hidden size={16} />
                Buscar abogados
              </Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link to="/login">Ya tengo una cuenta</Link>
            </Button>
          </Flex>
        </Card.Body>
      </Card.Root>

      <Card.Root>
        <Card.Body gap="3">
          <Flex align="center" gap="2">
            <ShieldCheck aria-hidden size={18} />
            <Heading as="h2" textStyle="title-sm">Sobre la revisión administrativa</Heading>
          </Flex>
          <Text textStyle="body-sm" color="fg.muted">
            Una inscripción profesional no equivale a una verificación aprobada. Mientras la revisión esté pendiente, el
            perfil permanece oculto para el público y las evidencias aportadas solo son accesibles para el titular y para
            la revisión autorizada. Un área jurídica declarada no acredita un título de especialización.
          </Text>
        </Card.Body>
      </Card.Root>
    </Stack>
  )
}
