// Presentación de los medios de contacto publicados por un profesional (CU 08).
// Vive en `utils` porque lo usan el perfil público del directorio y el detalle de la
// solicitud del ciudadano: una sola regla para componer enlaces y elegir el icono.

import type { LucideIcon } from 'lucide-react'
import { Globe, Link2, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
import type { MedioContacto } from './contrato'

/** Sólo dígitos, para componer enlaces `tel:` y `wa.me` desde el texto declarado. */
function soloDigitos(valor: string): string {
  return valor.replace(/[^\d]/g, '')
}

export type MedioContactoPresentable = {
  icono: LucideIcon
  /** Enlace directo del medio; null cuando el dato es sólo informativo. */
  href: string | null
}

/**
 * Presentación de un medio de contacto publicado. El enlace se compone solo cuando el
 * valor declarado lo permite: el sitio web si es http(s), el correo si parece una
 * dirección válida y el teléfono o WhatsApp si tienen dígitos suficientes. La dirección
 * postal queda como información.
 */
export function resolverMedioContacto(medio: MedioContacto): MedioContactoPresentable {
  const valor = medio.valor.trim()
  switch (medio.etiqueta.toLowerCase()) {
    case 'correo':
      return { icono: Mail, href: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor) ? `mailto:${valor}` : null }
    case 'teléfono': {
      const digitos = soloDigitos(valor)
      return { icono: Phone, href: digitos.length >= 7 ? `tel:${digitos}` : null }
    }
    case 'whatsapp': {
      const digitos = soloDigitos(valor)
      return { icono: MessageCircle, href: digitos.length >= 7 ? `https://wa.me/${digitos}` : null }
    }
    case 'sitio web':
      return { icono: Globe, href: /^https?:\/\/[^\s]+$/i.test(valor) ? valor : null }
    case 'dirección':
      return { icono: MapPin, href: null }
    default:
      return { icono: Link2, href: null }
  }
}
