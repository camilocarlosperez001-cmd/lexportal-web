import { useSesion } from '../../auth/hooks/useSesion'
import { useAvisosEnVivo } from '../hooks/useAvisosEnVivo'

/**
 * Anuncio inmediato de los avisos internos (CU 15). No renderiza nada: se monta una vez
 * en el panel para que un mensaje, una solicitud o una decisión aparezcan como Toast sin
 * recargar. La bandeja sigue siendo la fuente de verdad del historial.
 */
export function AvisosEnVivo() {
  const { cuenta } = useSesion()
  useAvisosEnVivo(cuenta?.id, cuenta?.rol ?? 'ciudadano')
  return null
}
