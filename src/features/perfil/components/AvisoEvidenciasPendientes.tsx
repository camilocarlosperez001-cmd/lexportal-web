import { Alert, Box, Button, Flex } from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import { ArrowRight, Paperclip } from 'lucide-react'
import { useAltaProfesional, type MotivoAltaIncompleta } from '../hooks/useAltaProfesional'

const TITULO: Record<MotivoAltaIncompleta, string> = {
  'sin-perfil': 'Falta registrar tu perfil profesional',
  'sin-version': 'Falta presentar tu información verificable',
  'sin-evidencias': 'Solo falta adjuntar tus soportes documentales',
}

const DESCRIPCION: Record<MotivoAltaIncompleta, string> = {
  'sin-perfil':
    'Tu cuenta profesional está activa, pero todavía no tiene perfil. Regístralo desde «Mi perfil profesional» para poder recibir solicitudes.',
  'sin-version':
    'Tu perfil existe, pero aún no presentaste la información verificable (identificación y tarjeta profesional). Preséntala para que la revisión administrativa pueda resolverse.',
  'sin-evidencias':
    'Tu inscripción quedó registrada, pero la versión presentada no tiene evidencias. Adjúntalas para que la revisión administrativa pueda contrastar la información: sin ellas la verificación no puede resolverse.',
}

/**
 * Recordatorio del alta profesional incompleta (CU 02), visible en todas las secciones
 * autenticadas. Usa la misma regla que el guardia de rutas, de modo que el aviso y el
 * bloqueo nunca se contradicen.
 */
export function AvisoEvidenciasPendientes({ cuentaId }: { cuentaId: string }) {
  const alta = useAltaProfesional(cuentaId)

  if (alta.cargando || alta.error || !alta.requiereCompletar || !alta.motivo) return null

  return (
    <Box mb="6">
      <Alert.Root status="warning" alignItems="start">
        <Alert.Indicator>
          <Paperclip aria-hidden size={18} />
        </Alert.Indicator>
        <Alert.Content>
          <Alert.Title>{TITULO[alta.motivo]}</Alert.Title>
          <Alert.Description>{DESCRIPCION[alta.motivo]}</Alert.Description>
          <Flex mt="3">
            <Button asChild size="sm">
              <RouterLink to="/completar-perfil">
                Completar mi perfil
                <ArrowRight aria-hidden size={16} />
              </RouterLink>
            </Button>
          </Flex>
        </Alert.Content>
      </Alert.Root>
    </Box>
  )
}
