-- ==============================================================================
-- DESPACHO DEL AVISO POR CORREO SIN DEPENDER DEL ESQUEMA DE pg_net (CU 15)
-- ==============================================================================
-- Diagnóstico real: `avisos_correo_diagnostico.detalle` decía
--   «pg_net no disponible: falta el esquema net o la función net.http_post»
--
-- Causa: la migración 20261013052258 instaló la extensión con `WITH SCHEMA
-- extensions`, así que sus funciones viven en `extensions`, no en `net`. La migración
-- 20261013071300 intentó reinstalarla en su esquema canónico, pero el DDL quedó dentro
-- de bloques de excepción que silenciaron el fallo: la migración se marcó aplicada y el
-- esquema `net` seguía ausente.
--
-- En lugar de forzar el DDL (que puede fallar porque `supabase_functions.http_request`
-- depende de la extensión), este cambio resuelve la ubicación real de `http_post` y la
-- invoca donde esté:
--   1. busca `http_post` en `net`, `extensions` y `public`, en ese orden de preferencia;
--   2. inspecciona su firma para usar argumentos nombrados o posicionales;
--   3. registra la función resuelta en el diagnóstico;
--   4. si no existe en ningún esquema, lo dice con claridad y conserva el aviso interno.
--
-- La instalación canónica sigue siendo recomendable (Supabase espera `net.http_post`),
-- y se puede hacer aparte: `CREATE EXTENSION pg_net;`

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
  v_funcion text;
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

  SELECT format('%I.%I', n.nspname, p.proname), pg_get_function_arguments(p.oid)
  INTO v_funcion, v_firma
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'http_post'
    AND n.nspname IN ('net', 'extensions', 'public')
  ORDER BY CASE n.nspname WHEN 'net' THEN 0 WHEN 'extensions' THEN 1 ELSE 2 END, p.oid
  LIMIT 1;

  IF v_funcion IS NULL THEN
    v_resultado := 'error';
    v_detalle := 'http_post no existe en los esquemas net, extensions ni public: instala pg_net con CREATE EXTENSION pg_net;';
  ELSE
    -- El aviso interno ya está registrado. Este bloque sólo intenta encolar el correo:
    -- ningún fallo aquí puede revertir el cambio de negocio que lo originó.
    BEGIN
      IF v_firma LIKE '%timeout_milliseconds%' THEN
        EXECUTE format(
          'SELECT %s(url := $1, body := $2, headers := $3, timeout_milliseconds := $4)',
          v_funcion
        ) USING v_url, v_cuerpo, v_headers, 5000;
      ELSE
        EXECUTE format('SELECT %s($1, $2, $3, $4, $5)', v_funcion)
          USING v_url, v_cuerpo, '{}'::jsonb, v_headers, 5000;
      END IF;

      v_resultado := 'encolado';
      v_detalle := v_funcion || '(' || v_firma || ')';
    EXCEPTION WHEN OTHERS THEN
      v_resultado := 'error';
      v_detalle := v_funcion || ' -> ' || SQLSTATE || ': ' || SQLERRM;
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
