import { Flex, Link as ChakraLink, Stack, Text } from '@chakra-ui/react'
import { resolverMedioContacto } from '../../utils/mediosContacto'
import type { MedioContacto } from '../../utils/contrato'

/**
 * Lista de medios de contacto que el profesional autorizó publicar. Se usa en el perfil
 * público y en el detalle de la solicitud del ciudadano, de modo que ambas vistas
 * muestren exactamente lo mismo y con los mismos enlaces.
 *
 * La llamada decide si corresponde mostrarla: los datos llegan ya filtrados por la
 * autorización (`campos_opcionales_publicos.medios_contacto`).
 */
export function MediosContacto({ medios }: { medios: MedioContacto[] }) {
  if (medios.length === 0) return null

  return (
    <Stack gap="3">
      {medios.map((medio) => {
        const { icono: Icono, href } = resolverMedioContacto(medio)
        return (
          <Flex key={`${medio.etiqueta}-${medio.valor}`} gap="2" align="center" wrap="wrap">
            <Icono aria-hidden size={16} />
            <Text textStyle="body-sm" color="fg.muted">{`${medio.etiqueta}:`}</Text>
            {href ? (
              <ChakraLink
                href={href}
                color="primary"
                fontWeight="600"
                textStyle="body-sm"
                aria-label={`${medio.etiqueta}: ${medio.valor}`}
                {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                {medio.valor}
              </ChakraLink>
            ) : (
              <Text textStyle="body-sm">{medio.valor}</Text>
            )}
          </Flex>
        )
      })}
    </Stack>
  )
}
