// Anuncio en vivo de los avisos internos (CU 15).
//
// Los avisos se crean en el servidor (triggers) y la bandeja los lee al cargar. Este
// hook añade el anuncio inmediato: escucha las inserciones de `notificaciones` del
// propio destinatario y muestra un Toast con acceso al recurso.
//
// Reglas que respeta:
//   - Realtime aplica RLS, así que el canal solo recibe filas propias; aun así se filtra.
//   - La fila se relee tipada: el evento solo aporta el identificador.
//   - Cada aviso se anuncia una sola vez (Realtime puede reenviar tras reconectar).
//   - La suscripción se cancela al desmontar o al cambiar de cuenta.

import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toaster } from '../../../components/ui/toaster-store'
import { ETIQUETA_EVENTO, type RolCuenta } from '../../../utils/etiquetas'
import { avisosConEnlace, cargarNotificacion, conversacionesDeAvisos, observarAvisos } from '../services/notificaciones'

/** Duración del aviso: suficiente para leerlo y decidir, sin quedarse fijo en pantalla. */
const DURACION_TOAST_MS = 8000

export function useAvisosEnVivo(cuentaId: string | null | undefined, rol: RolCuenta): void {
  const navegar = useNavigate()
  // Identificadores ya anunciados en esta sesión de pantalla.
  const anunciados = useRef(new Set<string>())

  useEffect(() => {
    if (!cuentaId) return

    const anunciar = async (notificacionId: string) => {
      try {
        const notificacion = await cargarNotificacion(notificacionId)
        if (!notificacion) return

        // El enlace al chat exige ser participante de la conversación, así que el aviso
        // de mensaje se resuelve con la misma comprobación que usa la bandeja.
        const conversaciones =
          notificacion.evento === 'nuevo_mensaje' && notificacion.mensaje_id
            ? await conversacionesDeAvisos(cuentaId, [notificacion.mensaje_id])
            : new Set<string>()

        const [aviso] = avisosConEnlace([notificacion], rol, conversaciones)
        const url = aviso?.url ?? null

        toaster.create({
          type: 'info',
          title: ETIQUETA_EVENTO[notificacion.evento],
          description:
            notificacion.evento === 'nuevo_mensaje'
              ? 'Puedes responder desde la conversación.'
              : 'Revisa los detalles en tu bandeja de avisos.',
          duration: DURACION_TOAST_MS,
          closable: true,
          ...(url ? { action: { label: 'Ver', onClick: () => navegar(url) } } : {}),
        })
      } catch {
        // El anuncio es un extra: si falla, el aviso sigue disponible en la bandeja, que
        // informa de sus propios errores de carga. No se convierte en un error de página.
      }
    }

    return observarAvisos(
      cuentaId,
      (notificacionId) => {
        if (anunciados.current.has(notificacionId)) return
        anunciados.current.add(notificacionId)
        void anunciar(notificacionId)
      },
      () => {
        // Canal caído: los avisos siguen creándose y la bandeja los mostrará al abrirla.
        console.warn('El canal de avisos en vivo se interrumpió; se reintentará al recargar.')
      },
    )
  }, [cuentaId, rol, navegar])
}
