// Perfil público de un abogado (CU 08). Presenta únicamente información pública y los
// campos opcionales que el abogado autorizó publicar; no consulta versiones profesionales,
// identificaciones, tarjetas profesionales ni evidencias privadas.

import { useState } from 'react'
import type { ReactElement } from 'react'
import {
  Badge,
  Button,
  Card,
  Flex,
  Heading,
  Separator,
  SimpleGrid,
  Stack,
  Tag,
  Text,
} from '@chakra-ui/react'
import { ArrowLeft, Briefcase, Info, MapPin, Send } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { AvatarProfesional } from '../../../components/shared/AvatarProfesional'
import { VerificacionBadge } from '../../../components/shared/EstadoBadge'
import { FeedbackState } from '../../../components/shared/FeedbackState'
import { ListaDatos } from '../../../components/shared/ListaDatos'
import { MediosContacto } from '../../../components/shared/MediosContacto'
import { PageHeader } from '../../../components/shared/PageHeader'
import { useConsulta } from '../../../hooks/useConsulta'
import { formatearFecha } from '../../../utils/fechas'
import { SolicitarContactoDialog } from '../../solicitudes/components/SolicitarContactoDialog'
import { cargarPerfilPublico } from '../services/directorio'
import type { PerfilPublico } from '../types'
import { etiquetaExperiencia, listaAreasTexto } from '../utils'

export function PerfilPublicoPage() {
  const { perfilId } = useParams<{ perfilId: string }>()
  const [dialogoAbierto, setDialogoAbierto] = useState(false)

  const consulta = useConsulta(
    () => (perfilId ? cargarPerfilPublico(perfilId) : Promise.resolve(null)),
    perfilId ?? 'sin-perfil',
  )

  const volver = (
    <Button asChild variant="ghost" size="sm" alignSelf="start">
      <Link to="/directorio">
        <ArrowLeft aria-hidden size={16} />
        Volver al directorio
      </Link>
    </Button>
  )

  if (consulta.cargando) {
    return (
      <Stack gap="6">
        {volver}
        <FeedbackState kind="loading" title="Cargando el perfil" description="Estamos consultando la información pública." />
      </Stack>
    )
  }

  if (consulta.error) {
    return (
      <Stack gap="6">
        {volver}
        <FeedbackState
          kind="error"
          title="No se pudo cargar el perfil"
          description={consulta.error}
          action={<Button variant="outline" onClick={consulta.recargar}>Reintentar</Button>}
        />
      </Stack>
    )
  }

  const perfil = consulta.datos
  if (!perfil) {
    return (
      <Stack gap="6">
        {volver}
        <FeedbackState
          title="Este perfil no está disponible para consulta pública"
          description="Puede que haya dejado de ser visible, que su verificación no esté vigente o que su cuenta no esté activa. No se muestra información privada de perfiles no disponibles."
          action={<Button asChild><Link to="/directorio">Volver al directorio</Link></Button>}
        />
      </Stack>
    )
  }

  return <PerfilDisponible perfil={perfil} dialogoAbierto={dialogoAbierto} setDialogoAbierto={setDialogoAbierto} volver={volver} />
}

function PerfilDisponible({
  perfil,
  dialogoAbierto,
  setDialogoAbierto,
  volver,
}: {
  perfil: PerfilPublico
  dialogoAbierto: boolean
  setDialogoAbierto: (abierto: boolean) => void
  volver: ReactElement
}) {
  const experiencia = etiquetaExperiencia(perfil.experienciaAnios)
  const fechaVerificacion = formatearFecha(perfil.fechaVerificacionVigente)
  const areasDelPerfil = listaAreasTexto(perfil.areas)
  const primerTipoCaso = perfil.tiposCaso[0]?.id ?? null

  const camposOpcionales = [
    { etiqueta: 'Formación declarada', valor: perfil.formacionDeclarada },
    { etiqueta: 'Modalidad de atención', valor: perfil.modalidad },
    { etiqueta: 'Horarios de atención', valor: perfil.horarios },
    { etiqueta: 'Tarifas orientativas', valor: perfil.tarifasOrientativas },
  ].filter((campo): campo is { etiqueta: string; valor: string } => Boolean(campo.valor))

  return (
    <Stack gap="8">
      {volver}

      <PageHeader
        titulo={perfil.nombreProfesional}
        etiqueta="PERFIL PÚBLICO"
        descripcion="Información publicada por el propio profesional y verificada por LexPortal en cuanto a su presentación."
        acciones={
          <Button onClick={() => setDialogoAbierto(true)}>
            <Send aria-hidden size={16} />
            Solicitar contacto
          </Button>
        }
      />

      <SimpleGrid columns={{ base: 1, lg: 3 }} gap="gutter" alignItems="start">
        <Stack gap="6" gridColumn={{ lg: 'span 2' }}>
          <Card.Root>
            <Card.Body gap="6">
              <Flex gap="5" direction={{ base: 'column', sm: 'row' }} align={{ base: 'start', sm: 'center' }}>
                <AvatarProfesional fotoPublica={perfil.fotoPublica} nombre={perfil.nombreProfesional} size="2xl" />
                <Stack gap="3">
                  <Flex gap="2" wrap="wrap" align="center">
                    <VerificacionBadge fechaVerificacion={perfil.fechaVerificacionVigente} />
                    {fechaVerificacion && (
                      <Text textStyle="body-sm" color="fg.muted">Verificación vigente desde el {fechaVerificacion}</Text>
                    )}
                  </Flex>
                  <Flex align="center" gap="2" color="fg.muted">
                    <MapPin aria-hidden size={16} />
                    <Text>Ciudad de atención: {perfil.ciudadAtencion}</Text>
                  </Flex>
                  {experiencia && (
                    <Flex align="center" gap="2" color="fg.muted">
                      <Briefcase aria-hidden size={16} />
                      <Text>{experiencia}</Text>
                    </Flex>
                  )}
                </Stack>
              </Flex>

              <Separator />

              <Stack gap="3">
                <Heading as="h2" textStyle="title-md">Descripción de la práctica</Heading>
                <Text color="fg.muted" whiteSpace="pre-wrap">{perfil.descripcion}</Text>
              </Stack>
            </Card.Body>
          </Card.Root>

          <Card.Root>
            <Card.Body gap="5">
              <Heading as="h2" textStyle="title-md">Áreas jurídicas declaradas</Heading>
              {perfil.areas.length === 0 ? (
                <Text color="fg.muted">El perfil no declara áreas jurídicas.</Text>
              ) : (
                <>
                  <Flex gap="2" wrap="wrap">
                    {perfil.areas.map((area) => (
                      <Badge key={area.id} colorPalette="brand" variant="subtle" size="sm">{area.nombre}</Badge>
                    ))}
                  </Flex>
                  <Text textStyle="body-sm" color="fg.muted">
                    Las áreas son declaraciones del profesional. No acreditan un título de especialización ni una
                    certificación académica.
                  </Text>
                </>
              )}
            </Card.Body>
          </Card.Root>

          <Card.Root>
            <Card.Body gap="5">
              <Heading as="h2" textStyle="title-md">Tipos de caso que atiende</Heading>
              {perfil.tiposCaso.length === 0 ? (
                <Text color="fg.muted">El perfil no declara tipos de caso.</Text>
              ) : (
                <Flex gap="2" wrap="wrap">
                  {perfil.tiposCaso.map((tipo) => (
                    <Tag.Root key={tipo.id} colorPalette="gray" size="md">
                      <Tag.Label>{tipo.nombre}</Tag.Label>
                    </Tag.Root>
                  ))}
                </Flex>
              )}
            </Card.Body>
          </Card.Root>
        </Stack>

        <Stack gap="6">
          <Card.Root>
            <Card.Body gap="4">
              <Heading as="h2" textStyle="title-md">Verificación profesional</Heading>
              <Flex gap="2" wrap="wrap" align="center">
                <VerificacionBadge fechaVerificacion={perfil.fechaVerificacionVigente} />
              </Flex>
              <ListaDatos
                orientacion="vertical"
                items={[
                  { etiqueta: 'Fecha de la verificación vigente', valor: fechaVerificacion },
                  { etiqueta: 'Alcance declarado por la revisión', valor: perfil.alcanceVerificacionVigente },
                ]}
              />
              <Flex gap="2" align="start" color="fg.muted">
                <Info aria-hidden size={16} />
                <Text textStyle="body-sm">
                  La verificación se refiere a la información profesional presentada por el abogado y conservada como
                  versión aprobada. No certifica resultados, no garantiza la calidad del servicio y no equivale a una
                  especialización académica.
                </Text>
              </Flex>
            </Card.Body>
          </Card.Root>

          {camposOpcionales.length > 0 && (
            <Card.Root>
              <Card.Body gap="4">
                <Heading as="h2" textStyle="title-md">Información que autorizó publicar</Heading>
                <ListaDatos orientacion="vertical" items={camposOpcionales} />
              </Card.Body>
            </Card.Root>
          )}

          {perfil.mediosContacto.length > 0 && (
            <Card.Root>
              <Card.Body gap="4">
                <Heading as="h2" textStyle="title-md">Medios de contacto publicados</Heading>
                <MediosContacto medios={perfil.mediosContacto} />
                <Text textStyle="body-sm" color="fg.muted">
                  Estos datos los declara el profesional y se publican porque autorizó su difusión. La verificación de
                  LexPortal acredita su identidad y su tarjeta profesional, no la exactitud de estos datos.
                </Text>
                <Text textStyle="body-sm" color="fg.muted">
                  Para iniciar el contacto dentro de la plataforma se usa la solicitud; el envío no implica contratación ni
                  garantiza resultados.
                </Text>
              </Card.Body>
            </Card.Root>
          )}

          <Card.Root>
            <Card.Body gap="4">
              <Heading as="h2" textStyle="title-md">Solicitar contacto</Heading>
              <Text color="fg.muted">
                Envía una solicitud al profesional para que conozca tu situación. Cuando la acepte, se habilita una
                conversación de texto entre ambos.
              </Text>
              <Button onClick={() => setDialogoAbierto(true)}>
                <Send aria-hidden size={16} />
                Solicitar contacto
              </Button>
            </Card.Body>
          </Card.Root>
        </Stack>
      </SimpleGrid>

      <SolicitarContactoDialog
        perfilId={perfil.id}
        nombreProfesional={perfil.nombreProfesional}
        areasDelPerfil={areasDelPerfil}
        abierto={dialogoAbierto}
        alCerrar={() => setDialogoAbierto(false)}
        clasificacionInicial={{ tipoCasoId: primerTipoCaso }}
      />
    </Stack>
  )
}
