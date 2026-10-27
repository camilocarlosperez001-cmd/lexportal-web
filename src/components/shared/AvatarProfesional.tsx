import { Avatar } from '@chakra-ui/react'
import { useFotoPublica } from '../../hooks/useFotoPublica'
import { inicialesDeNombre } from '../../utils/nombres'

type AvatarProfesionalProps = {
  /** Valor guardado en `perfiles_abogados.foto_publica`, ya filtrado por autorización. */
  fotoPublica: string | null
  nombre: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}

/**
 * Fotografía del profesional con relleno de iniciales.
 *
 * La imagen no se referencia por URL: se descarga del bucket privado con la sesión (o de
 * forma anónima cuando el perfil cumple las condiciones de RLS) y se muestra con una URL
 * local revocable. Mientras llega, o si la lectura no está autorizada, se ven las
 * iniciales: nunca una imagen rota.
 */
export function AvatarProfesional({ fotoPublica, nombre, size = 'md' }: AvatarProfesionalProps) {
  const { url } = useFotoPublica(fotoPublica)

  return (
    <Avatar.Root size={size} colorPalette="brand">
      {url && <Avatar.Image src={url} alt={`Fotografía de ${nombre}`} />}
      <Avatar.Fallback name={nombre}>{inicialesDeNombre(nombre)}</Avatar.Fallback>
    </Avatar.Root>
  )
}
