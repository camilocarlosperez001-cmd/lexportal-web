-- ==============================================================================
-- DIAGNÓSTICO DEL DESPACHO DE AVISOS POR CORREO (CU 15)
-- ==============================================================================
-- `net.http_post` es asíncrono: encola la petición y devuelve de inmediato. Por eso el
-- resultado de la entrega no se puede conocer dentro del trigger, y un fallo al encolar
-- (o una firma distinta de pg_net) dejaba el aviso en 'fallido' sin decir por qué.
--
-- Este cambio:
--   1. inspecciona la firma real de `net.http_post` y llama en consecuencia, de modo que
--      no dependa de una versión concreta de pg_net;
--   2. registra el resultado del encolado en una tabla de diagnóstico legible;
--   3. conserva el aviso interno y nunca revierte la operación de negocio.

CREATE TABLE IF NOT EXISTS public.avisos_correo_diagnostico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notificacion_id uuid NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  /** 'encolado' cuando la petición quedó en la cola de pg_net; 'error' si no se pudo. */
  resultado text NOT NULL,
  detalle text
);

ALTER TABLE public.avisos_correo_diagnostico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins leen el diagnostico de avisos" ON public.avisos_correo_diagnostico;
CREATE POLICY "Admins leen el diagnostico de avisos"
ON public.avisos_correo_diagnostico FOR SELECT
USING (public.es_admin());

CREATE INDEX IF NOT EXISTS avisos_correo_diag_notificacion_idx
  ON public.avisos_correo_diagnostico (notificacion_id, creado_en DESC);

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
  v_cuerpo jsonb;
  v_firma text;
  v_resultado text;
  v_detalle text;
BEGIN
  v_cuerpo := jsonb_build_object(
    'type', 'INSERT',
    'table', 'notificaciones',
    'schema', 'public',
    'record', to_jsonb(NEW)
  );

  -- Firma instalada de net.http_post: evita depender de los nombres de sus argumentos.
  SELECT pg_get_function_arguments(p.oid)
  INTO v_firma
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'net' AND p.proname = 'http_post'
  ORDER BY p.oid
  LIMIT 1;

  IF v_firma IS NULL THEN
    v_resultado := 'error';
    v_detalle := 'pg_net no disponible: falta el esquema net o la función net.http_post';
  ELSE
    -- El aviso interno ya está registrado. Este bloque sólo intenta encolar el correo:
    -- ningún fallo aquí puede revertir el cambio de negocio que lo originó.
    BEGIN
      IF v_firma LIKE '%timeout_milliseconds%' THEN
        PERFORM net.http_post(
          url := v_url,
          body := v_cuerpo,
          headers := v_headers,
          timeout_milliseconds := 5000
        );
      ELSE
        PERFORM net.http_post(v_url, v_cuerpo, '{}'::jsonb, v_headers, 5000);
      END IF;
      v_resultado := 'encolado';
      v_detalle := v_firma;
    EXCEPTION WHEN OTHERS THEN
      v_resultado := 'error';
      v_detalle := SQLSTATE || ': ' || SQLERRM;
    END;
  END IF;

  BEGIN
    INSERT INTO public.avisos_correo_diagnostico (notificacion_id, resultado, detalle)
    VALUES (NEW.id, v_resultado, v_detalle);
  EXCEPTION WHEN OTHERS THEN
    -- El diagnóstico nunca debe impedir el registro del aviso.
    NULL;
  END;

  IF v_resultado = 'error' THEN
    UPDATE public.notificaciones
    SET estado_aviso_correo = 'fallido'
    WHERE id = NEW.id;

    RAISE WARNING 'Aviso por correo de la notificación % no se pudo encolar: %', NEW.id, v_detalle;
  END IF;

  RETURN NEW;
END;
$$;

-- El trigger `trigger_enviar_correo` ya apunta a esta función.
