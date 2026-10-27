// Tarjeta de resultado del directorio (CU 05, 06 y 07): presenta solo información pública
// y los campos opcionales que el perfil autorizó publicar.
//
// Corte de palabras: los textos pueden traer tokens sin espacios (una URL, una palabra
// larga). Los hijos de un `Flex` tienen `min-width: auto`, así que sin `minW="0"` imponen
// su ancho intrínseco y desbordan la tarjeta; con `overflowWrap="anywhere"` el texto se
// parte dentro del contenedor en cualquier ancho.

import { Badge, Button, Card, Flex, Stack, Tag, Text } from '@chakra-ui/react'
import { ArrowRight, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AvatarProfesional } from '../../../components/shared/AvatarProfesional'
import { VerificacionBadge } from '../../../components/shared/EstadoBadge'
import { formatearFechaCorta } from '../../../utils/fechas'
import type { PerfilDirectorio } from '../types'
import { etiquetaExperiencia, resumirDescripcion } from '../utils'

export function TarjetaPerfil({ perfil }: { perfil: PerfilDirectorio }) {
  const experiencia = etiquetaExperiencia(perfil.experienciaAnios)
  const fechaVerificacion = formatearFechaCorta(perfil.fechaVerificacionVigente)
  const descripcion = perfil.descripcion ? resumirDescripcion(perfil.descripcion) : ''

  return (
    <Card.Root as="article">
      <Card.Body gap="5">
        <Flex
          gap="5"
          direction={{ base: 'column', lg: 'row' }}
          align={{ base: 'stretch', lg: 'start' }}
          minW="0"
        >
          <Flex
            gap="4"
            direction={{ base: 'row', lg: 'column' }}
            align={{ base: 'center', lg: 'flex-start' }}
            minW={{ base: '0', lg: '3xs' }}
          >
            <AvatarProfesional fotoPublica={perfil.fotoPublica} nombre={perfil.nombreProfesional} size="xl" />
            <Stack gap="2" align={{ base: 'start', lg: 'flex-start' }} minW="0">
              <Text textStyle="title-md" color="primary" overflowWrap="anywhere">
                {perfil.nombreProfesional}
              </Text>
              <Flex align="center" gap="2" wrap="wrap" color="fg.muted" minW="0">
                <MapPin aria-hidden size={16} />
                <Text textStyle="body-sm" overflowWrap="anywhere">{perfil.ciudadAtencion}</Text>
              </Flex>
              {experiencia && <Text textStyle="body-sm" color="fg.muted">{experiencia}</Text>}
              <Flex align="center" gap="2" wrap="wrap" minW="0">
                <VerificacionBadge fechaVerificacion={perfil.fechaVerificacionVigente} />
                {fechaVerificacion && (
                  <Text textStyle="body-sm" color="fg.muted">Vigente desde el {fechaVerificacion}</Text>
                )}
              </Flex>
            </Stack>
          </Flex>

          <Stack gap="4" flex="1" minW="0">
            {descripcion && (
              <Text color="fg.muted" overflowWrap="anywhere">
                {descripcion}
              </Text>
            )}

            {perfil.areas.length > 0 && (
              <Stack gap="2" minW="0">
                <Text textStyle="label-caps" color="fg.muted">ÁREAS DECLARADAS</Text>
                <Flex gap="2" wrap="wrap">
                  {perfil.areas.map((area) => (
                    <Badge
                      key={area.id}
                      colorPalette="brand"
                      variant="subtle"
                      size="sm"
                      maxW="full"
                      whiteSpace="normal"
                      overflowWrap="anywhere"
                    >
                      {area.nombre}
                    </Badge>
                  ))}
                </Flex>
              </Stack>
            )}

            {perfil.tiposCaso.length > 0 && (
              <Stack gap="2" minW="0">
                <Text textStyle="label-caps" color="fg.muted">SITUACIONES QUE ATIENDE</Text>
                <Flex gap="2" wrap="wrap">
                  {perfil.tiposCaso.map((tipo) => (
                    <Tag.Root key={tipo.id} colorPalette="gray" size="sm" maxW="full">
                      <Tag.Label whiteSpace="normal" overflowWrap="anywhere">{tipo.nombre}</Tag.Label>
                    </Tag.Root>
                  ))}
                </Flex>
              </Stack>
            )}
          </Stack>
        </Flex>
      </Card.Body>
      <Card.Footer borderTopWidth="1px" pt="4">
        <Flex
          gap="3"
          direction={{ base: 'column', sm: 'row' }}
          align={{ base: 'stretch', sm: 'center' }}
          justify="space-between"
          width="full"
          minW="0"
        >
          <Stack gap="1" minW="0">
            {perfil.modalidad && (
              <Text textStyle="body-sm" color="fg.muted" overflowWrap="anywhere">Modalidad: {perfil.modalidad}</Text>
            )}
            {perfil.tarifasOrientativas && (
              <Text textStyle="body-sm" color="fg.muted" overflowWrap="anywhere">
                Tarifas orientativas: {perfil.tarifasOrientativas}
              </Text>
            )}
          </Stack>
          <Button asChild variant="outline" flexShrink={0}>
            <Link to={`/directorio/${perfil.id}`}>
              Ver perfil
              <ArrowRight aria-hidden size={16} />
            </Link>
          </Button>
        </Flex>
      </Card.Footer>
    </Card.Root>
  )
}
