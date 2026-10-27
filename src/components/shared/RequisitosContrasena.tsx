// Indicador reutilizable de los requisitos de contraseña. Consume las mismas reglas
// que la validación del registro, la recuperación y el cambio de contraseña.

import { Box, Stack, Text } from '@chakra-ui/react'
import { Check, Circle } from 'lucide-react'
import { REGLAS_CONTRASENA } from '../../utils/validaciones'

export function RequisitosContrasena({ valor }: { valor: string }) {
  return (
    <Stack as="ul" gap="1" p="0" m="0" listStyleType="none" aria-label="Requisitos de la contraseña">
      {REGLAS_CONTRASENA.map((regla) => {
        const cumplida = regla.test(valor)
        return (
          <Stack as="li" key={regla.id} direction="row" align="center" gap="2" color={cumplida ? 'fg.success' : 'fg.muted'}>
            <Box as="span" display="inline-flex" flexShrink="0" aria-hidden>
              {cumplida ? <Check size={14} /> : <Circle size={8} />}
            </Box>
            <Text textStyle="body-sm">
              <Text as="span" srOnly>
                {cumplida ? 'Requisito cumplido: ' : 'Requisito pendiente: '}
              </Text>
              {regla.label}
            </Text>
          </Stack>
        )
      })}
    </Stack>
  )
}
