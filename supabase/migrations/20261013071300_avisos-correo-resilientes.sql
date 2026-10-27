-- ==============================================================================
-- AVISOS POR CORREO RESILIENTES (CU 15)
-- ==============================================================================
-- Dos problemas detectados al registrar una decisión de verificación:
--
-- 1. La migración 20261013052258 instaló pg_net con `WITH SCHEMA extensions`, pero
--    `supabase_functions.http_request` invoca `net.http_post`. Sin el esquema `net`,
--    el despacho fallaba con «3F000: schema "net" does not exist».
--
-- 2. Más grave que el fallo del correo: el trigger del webhook se ejecutaba dentro de
--    la misma transacción que la operación de negocio, así que un problema de la
--    mensajería externa REVERTÍA la decisión administrativa (aprobar o suspender) y
--    las notificaciones de solicitudes y mensajes. El aviso interno debe conservarse
--    aunque falle el correo, y el correo no puede condicionar ninguna decisión.
--
-- Se reinstala pg_net en su esquema correcto y se sustituye el trigger por uno que
-- aísla cualquier error del despacho y lo registra en `estado_aviso_correo`.

-- ------------------------------------------------------------------------------
-- 1. pg_net en el esquema `net`
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'net') THEN
    RAISE NOTICE 'El esquema net ya existe: pg_net está disponible para los avisos por correo.';
    RETURN;
  END IF;

  BEGIN
    -- Estaba instalada en otro esquema (por ejemplo `extensions`): se reinstala en el
    -- suyo para que `net.http_post` resuelva. La cola de envíos pendiente se pierde.
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
      DROP EXTENSION pg_net;
    END IF;

    BEGIN
      CREATE EXTENSION pg_net WITH SCHEMA net;
    EXCEPTION WHEN OTHERS THEN
      -- La extensión es reubicable y exige que el esquema exista antes.
      CREATE SCHEMA IF NOT EXISTS net;
      CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA net;
    END;

    RAISE NOTICE 'pg_net instalado en el esquema net.';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING
      'No se pudo instalar pg_net en el esquema net (%: %). Los avisos por correo quedarán marcados como fallidos y el aviso interno se conservará igualmente.',
      SQLSTATE, SQLERRM;
  END;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. Despacho del aviso por correo, aislado de la transacción de negocio
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enviar_aviso_correo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  -- Función Edge local (`supabase start`). En un proyecto alojado se sustituye por
  -- https://<referencia>.supabase.co/functions/v1/enviar-correos
  v_url text := 'http://host.docker.internal:54321/functions/v1/enviar-correos';
  v_headers jsonb := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
  );
BEGIN
  -- El aviso interno ya quedó registrado al insertar la fila. Este trigger solo
  -- intenta despachar el correo: ningún fallo aquí puede revertir el cambio de negocio
  -- que lo originó (decisión de verificación, suspensión, mensaje o solicitud).
  BEGIN
    PERFORM net.http_post(
      url := v_url,
      body := jsonb_build_object(
        'type', 'INSERT',
        'table', 'notificaciones',
        'schema', 'public',
        'record', to_jsonb(NEW)
      ),
      headers := v_headers,
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.notificaciones
    SET estado_aviso_correo = 'fallido'
    WHERE id = NEW.id;

    RAISE WARNING
      'Aviso por correo de la notificación % no despachado (%: %). El aviso interno permanece registrado.',
      NEW.id, SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enviar_correo ON public.notificaciones;
CREATE TRIGGER trigger_enviar_correo
  AFTER INSERT ON public.notificaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.enviar_aviso_correo();
