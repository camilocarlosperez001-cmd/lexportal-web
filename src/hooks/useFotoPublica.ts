// Descarga de la fotografía pública de un perfil (CU 08 y CU 19).
//
// El bucket `perfiles-publicos` es privado y su lectura está condicionada por RLS:
// publicación, actividad, verificación aprobada y autorización expresa del titular. Por
// eso la imagen se pide con `download` (nunca con `getPublicUrl`) y se representa con
// una URL local revocable:
//   - se crea on mount y se revoca al desmontar o al cambiar de fotografía;
//   - no se persiste ni se cachea entre vistas, para que retirar el consentimiento corte
//     el acceso de verdad y no quede una referencia viva en otra pantalla.
// Si la descarga falla (RLS, objeto retirado, red), la vista usa las iniciales.

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BUCKET_FOTOS_PERFIL, rutaDeFotoPublica } from '../utils/fotos'

export type EstadoFotoPublica = {
  /** URL local del blob ya descargado; null mientras carga o si no hay fotografía. */
  url: string | null
  cargando: boolean
  /** La descarga falló: el perfil existe, pero la imagen no está disponible. */
  error: boolean
}

/** Estados guardados junto a la ruta a la que pertenecen, para descartar valores viejos. */
type FotoDescargada = { ruta: string; url: string }

export function useFotoPublica(valor: string | null | undefined): EstadoFotoPublica {
  const ruta = rutaDeFotoPublica(valor)
  const [descargada, setDescargada] = useState<FotoDescargada | null>(null)
  const [fallida, setFallida] = useState<string | null>(null)

  useEffect(() => {
    if (!ruta) return
    // Evita fijar estado después de desmontar y deja rastro para revocar la URL creada.
    let cancelado = false
    let urlCreada: string | null = null

    const descargar = async () => {
      const { data, error } = await supabase.storage.from(BUCKET_FOTOS_PERFIL).download(ruta)
      if (cancelado) return
      if (error || !data) {
        setFallida(ruta)
        return
      }
      urlCreada = URL.createObjectURL(data)
      setDescargada({ ruta, url: urlCreada })
    }

    void descargar().catch(() => {
      if (!cancelado) setFallida(ruta)
    })

    return () => {
      cancelado = true
      if (urlCreada) URL.revokeObjectURL(urlCreada)
    }
  }, [ruta])

  if (!ruta) return { url: null, cargando: false, error: false }

  const url = descargada?.ruta === ruta ? descargada.url : null
  const fallo = fallida === ruta
  return { url, cargando: !url && !fallo, error: fallo }
}
