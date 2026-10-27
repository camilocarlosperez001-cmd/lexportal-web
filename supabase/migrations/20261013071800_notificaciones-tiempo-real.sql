-- ==============================================================================
-- AVISOS INTERNOS EN TIEMPO REAL (CU 15)
-- ==============================================================================
-- Los avisos internos se leían solo al cargar la bandeja, así que un mensaje o una
-- decisión no se notaban hasta recargar. Para anunciarlos con un Toast en el momento
-- hay que publicar la tabla en Realtime.
--
-- La autorización no cambia: Realtime aplica las políticas RLS también a
-- `postgres_changes`, de modo que cada cliente recibe únicamente las filas que su
-- política de SELECT permite («Ver notificaciones propias o admin»). El filtro por
-- `destinatario_id` del cliente solo evita despertarlo por filas ajenas.
--
-- Es idempotente: si la tabla ya estuviera publicada, no hace nada.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notificaciones'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones;
  END IF;
END;
$$;

-- Los eventos INSERT incluyen la fila completa con la identidad de réplica por defecto,
-- así que no hace falta REPLICA IDENTITY FULL (que además enviaría los valores
-- anteriores en cada actualización, sin aportar nada a este caso).
