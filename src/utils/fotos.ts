// Referencias a la fotografía de perfil (CU 08 y CU 19).
//
// El bucket `perfiles-publicos` es privado: la imagen se descarga con el cliente de
// Supabase (sujeta a RLS) y se representa con una URL local revocable. Este módulo solo
// traduce el valor guardado en `perfiles_abogados.foto_publica` a la ruta del objeto;
// no construye URLs públicas ni firmadas.

export const BUCKET_FOTOS_PERFIL = 'perfiles-publicos'

/** Sanea la ruta del objeto: sin barras iniciales, sin escapes y sin segmentos relativos. */
function normalizarRuta(ruta: string): string | null {
  let decodificada: string
  try {
    decodificada = decodeURIComponent(ruta)
  } catch {
    // Una secuencia de escape inválida no se interpreta: se usa tal cual.
    decodificada = ruta
  }
  const limpia = decodificada.replace(/^\/+/, '').trim()
  if (!limpia || limpia.includes('..')) return null
  return limpia
}

/**
 * Ruta del objeto dentro del bucket a partir del valor guardado en `foto_publica`.
 *
 * El contrato admite dos formas: la ruta relativa (lo que se guarda desde ahora) y la
 * URL pública completa que dejaron las altas anteriores
 * (`.../object/public/perfiles-publicos/<ruta>`). Cualquier otro esquema se descarta:
 * nunca se intenta descargar una URL ajena.
 */
export function rutaDeFotoPublica(valor: string | null | undefined): string | null {
  if (typeof valor !== 'string') return null
  const texto = valor.trim()
  if (!texto) return null

  const marca = `/${BUCKET_FOTOS_PERFIL}/`
  const indice = texto.indexOf(marca)
  if (indice >= 0) {
    // Se corta la consulta o el fragmento de una URL heredada (?token=…).
    return normalizarRuta(texto.slice(indice + marca.length).split(/[?#]/)[0])
  }

  // Una URL que no apunta a este bucket no se descarga.
  if (/^[a-z][a-z0-9+.-]*:/i.test(texto)) return null
  return normalizarRuta(texto)
}
