import { Alert, Box, Button, Flex } from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import { ArrowRight, EyeOff, ShieldCheck } from 'lucide-react'
import { usePublicacionPerfil } from '../hooks/usePublicacionPerfil'

/**
 * Aviso para el abogado con verificación aprobada cuyo perfil todavía no se ofrece en
 * el directorio (CU 08 y CU 19).
 *
 * La aprobación acredita la información, pero la publicación la decide el titular: la
 * búsqueda pública exige `visibilidad = 'publico'`, `activo = true` y una versión
 * aprobada. Sin este aviso, el abogado podía tener la verificación aprobada y seguir
 * invisible sin saber por qué.
 */
export function AvisoPublicacionPendiente({ cuentaId }: { cuentaId: string }) {
  const publicacion = usePublicacionPerfil(cuentaId)

  if (publicacion.cargando || publicacion.error || !publicacion.aprobadoSinPublicar) return null

  return (
    <Box mb="6">
      <Alert.Root status="info" alignItems="start">
        <Alert.Indicator>{publicacion.activo ? <EyeOff aria-hidden size={18} /> : <ShieldCheck aria-hidden size={18} />}</Alert.Indicator>
        <Alert.Content>
          <Alert.Title>Tu verificación está aprobada, pero tu perfil no aparece en el directorio</Alert.Title>
          <Alert.Description>
            {publicacion.activo
              ? 'La publicación de tu perfil está desactivada. Actívala en Privacidad para que aparezca en las búsquedas: la verificación aprobada no la activa por sí sola.'
              : 'Tu perfil no está activo, así que no se ofrece en las búsquedas aunque la verificación esté aprobada. Consulta el estado de tu cuenta antes de activar la publicación.'}
          </Alert.Description>
          <Flex mt="3">
            <Button asChild size="sm">
              <RouterLink to="/privacidad">
                Revisar mi publicación
                <ArrowRight aria-hidden size={16} />
              </RouterLink>
            </Button>
          </Flex>
        </Alert.Content>
      </Alert.Root>
    </Box>
  )
}
