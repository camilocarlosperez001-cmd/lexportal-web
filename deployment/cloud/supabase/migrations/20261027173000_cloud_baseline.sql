-- Baseline del estado local auditado. Esquema sin datos ni credenciales.
-- Solo para un proyecto Cloud vacío; historial original conservado en respaldo.



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."estado_cuenta" AS ENUM (
    'activa',
    'suspendida',
    'inactiva'
);


ALTER TYPE "public"."estado_cuenta" OWNER TO "postgres";


CREATE TYPE "public"."estado_envio_correo" AS ENUM (
    'no_aplica',
    'pendiente',
    'enviado',
    'fallido'
);


ALTER TYPE "public"."estado_envio_correo" OWNER TO "postgres";


CREATE TYPE "public"."estado_peticion_priv" AS ENUM (
    'pendiente',
    'en_proceso',
    'resuelta'
);


ALTER TYPE "public"."estado_peticion_priv" OWNER TO "postgres";


CREATE TYPE "public"."estado_revision_prof" AS ENUM (
    'pendiente',
    'en_revision',
    'aprobada',
    'rechazada',
    'requiere_correcciones'
);


ALTER TYPE "public"."estado_revision_prof" OWNER TO "postgres";


CREATE TYPE "public"."estado_solicitud" AS ENUM (
    'pendiente',
    'aceptada',
    'rechazada',
    'cancelada'
);


ALTER TYPE "public"."estado_solicitud" OWNER TO "postgres";


CREATE TYPE "public"."evento_noti" AS ENUM (
    'nueva_solicitud',
    'nuevo_mensaje',
    'revision_resuelta',
    'privacidad_resuelta',
    'solicitud_aceptada',
    'solicitud_rechazada',
    'perfil_suspendido',
    'solicitud_cancelada'
);


ALTER TYPE "public"."evento_noti" OWNER TO "postgres";


CREATE TYPE "public"."rol_cuenta" AS ENUM (
    'ciudadano',
    'abogado',
    'administrador'
);


ALTER TYPE "public"."rol_cuenta" OWNER TO "postgres";


CREATE TYPE "public"."tipo_doc_legal" AS ENUM (
    'terminos_condiciones',
    'politica_privacidad',
    'tratamiento_datos'
);


ALTER TYPE "public"."tipo_doc_legal" OWNER TO "postgres";


CREATE TYPE "public"."tipo_peticion_priv" AS ENUM (
    'acceso',
    'rectificacion',
    'cancelacion',
    'oposicion',
    'desactivacion',
    'supresion'
);


ALTER TYPE "public"."tipo_peticion_priv" OWNER TO "postgres";


CREATE TYPE "public"."tipo_revision_prof" AS ENUM (
    'inicial',
    'revalidacion',
    'reporte'
);


ALTER TYPE "public"."tipo_revision_prof" OWNER TO "postgres";


CREATE TYPE "public"."visibilidad_perfil" AS ENUM (
    'publico',
    'oculto'
);


ALTER TYPE "public"."visibilidad_perfil" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."fotografia_publicable"("p_ruta" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles_abogados p
    JOIN public.cuentas c ON c.id=p.cuenta_id AND c.estado='activa' AND c.rol='abogado'
    JOIN public.versiones_profesionales v ON v.id=p.version_aprobada_id AND v.perfil_id=p.id AND v.estado_revision='aprobada'
    WHERE regexp_replace(p.foto_publica,'^https?://[^/]+/storage/v1/object/public/perfiles-publicos/','')=p_ruta
      AND split_part(p_ruta,'/',1)=p.cuenta_id::text
      AND p.activo AND p.visibilidad='publico' AND p.fecha_verificacion_vigente IS NOT NULL
      AND p.campos_opcionales_publicos->'foto_publica'='true'::jsonb
  );
$$;


ALTER FUNCTION "private"."fotografia_publicable"("p_ruta" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."fotografia_registrada"("p_ruta" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS(SELECT 1 FROM public.perfiles_abogados p
    WHERE regexp_replace(p.foto_publica,'^https?://[^/]+/storage/v1/object/public/perfiles-publicos/','')=p_ruta);
$$;


ALTER FUNCTION "private"."fotografia_registrada"("p_ruta" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."proteger_cuenta"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND NOT public.es_admin() THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'La cuenta se crea exclusivamente mediante Auth' USING ERRCODE = '42501';
    END IF;
    IF (NEW.id, NEW.rol, NEW.estado, NEW.correo, NEW.creada_en)
       IS DISTINCT FROM (OLD.id, OLD.rol, OLD.estado, OLD.correo, OLD.creada_en) THEN
      RAISE EXCEPTION 'No puedes modificar identidad, rol o estado de la cuenta' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "private"."proteger_cuenta"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."proteger_perfil"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND NOT public.es_admin() THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.cuenta_id IS DISTINCT FROM auth.uid()
         OR NOT EXISTS (SELECT 1 FROM public.cuentas WHERE id = auth.uid() AND rol = 'abogado' AND estado = 'activa')
         OR NEW.activo IS DISTINCT FROM TRUE OR NEW.version_aprobada_id IS NOT NULL
         OR NEW.fecha_verificacion_vigente IS NOT NULL OR NEW.alcance_verificacion_vigente IS NOT NULL
         OR NEW.suspendido_en IS NOT NULL OR NEW.motivo_suspension IS NOT NULL THEN
        RAISE EXCEPTION 'Alta profesional no autorizada' USING ERRCODE = '42501';
      END IF;
    ELSIF (NEW.id, NEW.cuenta_id, NEW.activo, NEW.version_aprobada_id,
           NEW.fecha_verificacion_vigente, NEW.alcance_verificacion_vigente, NEW.suspendido_en, NEW.motivo_suspension)
       IS DISTINCT FROM (OLD.id, OLD.cuenta_id, OLD.activo, OLD.version_aprobada_id,
           OLD.fecha_verificacion_vigente, OLD.alcance_verificacion_vigente, OLD.suspendido_en, OLD.motivo_suspension) THEN
      RAISE EXCEPTION 'Solo la administración puede cambiar aprobación, propietario o suspensión' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "private"."proteger_perfil"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."validar_evidencia_presentada"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE v_cuenta uuid; v_estado public.estado_revision_prof;
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' OR public.es_admin() THEN RETURN NEW; END IF;
  SELECT p.cuenta_id,v.estado_revision INTO v_cuenta,v_estado FROM public.versiones_profesionales v
  JOIN public.perfiles_abogados p ON p.id=v.perfil_id JOIN public.cuentas c ON c.id=p.cuenta_id
  WHERE v.id=NEW.version_id AND c.estado='activa' AND c.rol='abogado' FOR UPDATE OF v;
  IF v_cuenta IS DISTINCT FROM auth.uid() OR v_estado IS DISTINCT FROM 'pendiente'::public.estado_revision_prof
    OR NOT starts_with(NEW.ruta_storage_privada,v_cuenta::text||'/'||NEW.version_id::text||'/')
    OR NEW.ruta_storage_privada LIKE '%..%'
    OR NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='evidencias-privadas' AND o.name=NEW.ruta_storage_privada
      AND o.metadata->>'mimetype' IN ('application/pdf','image/jpeg','image/png') AND (o.metadata->>'size')::bigint BETWEEN 1 AND 10485760)
  THEN RAISE EXCEPTION 'Solo puedes aportar archivos propios a una versión pendiente' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION "private"."validar_evidencia_presentada"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."validar_version_presentada"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF auth.role()='authenticated' AND NOT public.es_admin() THEN
    IF NEW.estado_revision<>'pendiente' OR NOT EXISTS(SELECT 1 FROM public.perfiles_abogados p
      JOIN public.cuentas c ON c.id=p.cuenta_id WHERE p.id=NEW.perfil_id AND p.cuenta_id=auth.uid() AND c.rol='abogado' AND c.estado='activa')
    THEN RAISE EXCEPTION 'Solo puedes presentar versiones propias pendientes' USING ERRCODE='42501'; END IF;
    NEW.presentada_en:=now();
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION "private"."validar_version_presentada"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."al_cambiar_estado_solicitud"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Cuando la solicitud pasa a estado 'aceptada'
  IF NEW.estado = 'aceptada'::estado_solicitud AND (OLD.estado IS NULL OR OLD.estado <> 'aceptada'::estado_solicitud) THEN
    
    -- Crear conversación si no existe previamente
    INSERT INTO public.conversaciones (solicitud_id)
    VALUES (NEW.id)
    ON CONFLICT (solicitud_id) DO NOTHING;

    -- (Nota: Para notificar aceptación o rechazo, debes agregar esos eventos 
    -- al ENUM evento_noti. Ver notas al final).

  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."al_cambiar_estado_solicitud"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."buscar_abogados"("p_busqueda" "text" DEFAULT NULL::"text", "p_areas" "uuid"[] DEFAULT NULL::"uuid"[], "p_tipos_caso" "uuid"[] DEFAULT NULL::"uuid"[], "p_ciudad" "text" DEFAULT NULL::"text", "p_perfil_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("perfil_id" "uuid", "nombre_profesional" "text", "descripcion" "text", "experiencia_anios" integer, "ciudad_atencion" "text", "foto_publica" "text", "modalidad" "text", "tarifas_orientativas" "text", "fecha_verificacion_vigente" timestamp with time zone, "alcance_verificacion_vigente" "text", "campos_opcionales_publicos" "jsonb", "areas" "jsonb", "tipos_caso" "jsonb", "formacion_declarada" "text", "horarios" "text", "medios_contacto" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT p.id,p.nombre_profesional,p.descripcion,p.experiencia_anios,p.ciudad_atencion,
    CASE WHEN f.flags->'foto_publica'='true'::jsonb THEN p.foto_publica END,
    CASE WHEN f.flags->'modalidad'='true'::jsonb THEN p.modalidad END,
    CASE WHEN f.flags->'tarifas_orientativas'='true'::jsonb THEN p.tarifas_orientativas END,
    p.fecha_verificacion_vigente,p.alcance_verificacion_vigente,f.flags,
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'nombre',a.nombre) ORDER BY a.nombre,a.id)
      FROM public.perfil_area pa JOIN public.areas_juridicas a ON a.id=pa.area_id WHERE pa.perfil_id=p.id),'[]'::jsonb),
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'nombre',t.nombre_cotidiano) ORDER BY t.nombre_cotidiano,t.id)
      FROM public.perfil_tipo_caso pt JOIN public.tipos_caso t ON t.id=pt.tipo_caso_id WHERE pt.perfil_id=p.id),'[]'::jsonb),
    CASE WHEN f.flags->'formacion_declarada'='true'::jsonb THEN p.formacion_declarada END,
    CASE WHEN f.flags->'horarios'='true'::jsonb THEN p.horarios END,
    CASE WHEN f.flags->'medios_contacto'='true'::jsonb THEN
      coalesce((SELECT jsonb_object_agg(e.key,e.value) FROM jsonb_each(
        CASE WHEN jsonb_typeof(p.medios_contacto)='object' THEN p.medios_contacto ELSE '{}'::jsonb END) e
        WHERE e.key IN ('correo','telefono','whatsapp','sitio_web','direccion')
          AND jsonb_typeof(e.value)='string' AND btrim(e.value#>>'{}')<>''),'{}'::jsonb)
    END
  FROM public.perfiles_abogados p
  JOIN public.cuentas c ON c.id=p.cuenta_id AND c.rol='abogado' AND c.estado='activa'
  JOIN public.versiones_profesionales v ON v.id=p.version_aprobada_id AND v.perfil_id=p.id AND v.estado_revision='aprobada'
  CROSS JOIN LATERAL (SELECT jsonb_object_agg(k,coalesce(p.campos_opcionales_publicos->k='true'::jsonb,false)) AS flags
    FROM unnest(ARRAY['foto_publica','formacion_declarada','modalidad','horarios','tarifas_orientativas','medios_contacto']) k) f
  WHERE p.activo AND p.visibilidad='publico' AND p.fecha_verificacion_vigente IS NOT NULL
    AND (p_perfil_id IS NULL OR p.id=p_perfil_id)
    AND (p_ciudad IS NULL OR btrim(p_ciudad)='' OR p.ciudad_atencion ILIKE '%'||btrim(p_ciudad)||'%')
    AND (p_areas IS NULL OR cardinality(p_areas)=0 OR EXISTS(
      SELECT 1 FROM public.perfil_area pa WHERE pa.perfil_id=p.id AND pa.area_id=ANY(p_areas)))
    AND (p_tipos_caso IS NULL OR cardinality(p_tipos_caso)=0 OR EXISTS(
      SELECT 1 FROM public.perfil_tipo_caso pt WHERE pt.perfil_id=p.id AND pt.tipo_caso_id=ANY(p_tipos_caso)))
    AND (p_busqueda IS NULL OR btrim(p_busqueda)=''
      OR p.nombre_profesional ILIKE '%'||btrim(p_busqueda)||'%' OR p.descripcion ILIKE '%'||btrim(p_busqueda)||'%'
      OR EXISTS(SELECT 1 FROM public.perfil_area pa JOIN public.areas_juridicas a ON a.id=pa.area_id
        LEFT JOIN public.termino_area ta ON ta.area_id=a.id LEFT JOIN public.terminos_busqueda tb ON tb.id=ta.termino_id
        WHERE pa.perfil_id=p.id AND (a.nombre ILIKE '%'||btrim(p_busqueda)||'%' OR tb.texto ILIKE '%'||btrim(p_busqueda)||'%'))
      OR EXISTS(SELECT 1 FROM public.perfil_tipo_caso pt JOIN public.tipos_caso t ON t.id=pt.tipo_caso_id
        LEFT JOIN public.termino_tipo_caso tt ON tt.tipo_caso_id=t.id LEFT JOIN public.terminos_busqueda tb ON tb.id=tt.termino_id
        WHERE pt.perfil_id=p.id AND (t.nombre_cotidiano ILIKE '%'||btrim(p_busqueda)||'%' OR tb.texto ILIKE '%'||btrim(p_busqueda)||'%')))
  ORDER BY p.experiencia_anios DESC,p.id;
$$;


ALTER FUNCTION "public"."buscar_abogados"("p_busqueda" "text", "p_areas" "uuid"[], "p_tipos_caso" "uuid"[], "p_ciudad" "text", "p_perfil_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cambiar_estado_solicitud"("p_solicitud_id" "uuid", "p_nuevo_estado" "public"."estado_solicitud", "p_motivo_rechazo" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_estado public.estado_solicitud; v_titular uuid;
BEGIN
  SELECT s.estado,p.cuenta_id INTO v_estado,v_titular FROM public.solicitudes_contacto s
  JOIN public.perfiles_abogados p ON p.id=s.abogado_perfil_id WHERE s.id=p_solicitud_id FOR UPDATE OF s;
  IF auth.uid() IS NULL OR v_titular IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'No tienes permiso para decidir esta solicitud' USING ERRCODE='42501'; END IF;
  IF p_nuevo_estado IS NULL OR p_nuevo_estado NOT IN ('aceptada','rechazada') THEN RAISE EXCEPTION 'Decisión inválida' USING ERRCODE='22023'; END IF;
  IF v_estado IS DISTINCT FROM 'pendiente'::public.estado_solicitud THEN RAISE EXCEPTION 'La solicitud ya no está pendiente' USING ERRCODE='22023'; END IF;
  UPDATE public.solicitudes_contacto SET estado=p_nuevo_estado,decidida_en=now(),
    motivo_rechazo=CASE WHEN p_nuevo_estado='rechazada' THEN nullif(btrim(p_motivo_rechazo),'') ELSE NULL END
    WHERE id=p_solicitud_id;
END $$;


ALTER FUNCTION "public"."cambiar_estado_solicitud"("p_solicitud_id" "uuid", "p_nuevo_estado" "public"."estado_solicitud", "p_motivo_rechazo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."crear_perfil_profesional_desde_metadatos"("p_cuenta_id" "uuid", "p_perfil" "jsonb") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_perfil_id uuid;
  v_area uuid;
  v_tipo uuid;
  v_experiencia integer;
  v_faltantes text[] := ARRAY[]::text[];

  v_nombre text;
  v_descripcion text;
  v_ciudad text;
  v_experiencia_texto text;
  v_formacion text;
  v_foto text;
  v_modalidad text;
  v_horarios text;
  v_tarifas text;
  v_identificacion text;
  v_tarjeta text;
  v_visibilidad visibilidad_perfil;

  v_medios jsonb;
  v_campos jsonb;
  v_areas jsonb;
  v_tipos jsonb;

  v_resultado text;
BEGIN
  IF p_cuenta_id IS NULL THEN
    RETURN 'sin_cuenta';
  END IF;

  IF jsonb_typeof(p_perfil) IS DISTINCT FROM 'object' THEN
    RETURN 'sin_metadatos_perfil';
  END IF;

  -- Campos obligatorios: se leen con sus alias y se informa exactamente cuál falta.
  v_nombre := public.perfil_texto(p_perfil, 'nombre_profesional', 'nombreProfesional');
  v_descripcion := public.perfil_texto(p_perfil, 'descripcion');
  v_ciudad := public.perfil_texto(p_perfil, 'ciudad_atencion', 'ciudadAtencion');
  v_experiencia_texto := public.perfil_texto(p_perfil, 'experiencia_anios', 'experienciaAnios');

  IF v_nombre IS NULL THEN
    v_faltantes := array_append(v_faltantes, 'nombre_profesional');
  END IF;
  IF v_descripcion IS NULL THEN
    v_faltantes := array_append(v_faltantes, 'descripcion');
  END IF;
  IF v_ciudad IS NULL THEN
    v_faltantes := array_append(v_faltantes, 'ciudad_atencion');
  END IF;
  IF v_experiencia_texto IS NULL OR v_experiencia_texto !~ '^\d+$' THEN
    v_faltantes := array_append(v_faltantes, 'experiencia_anios');
  END IF;

  IF array_length(v_faltantes, 1) IS NOT NULL THEN
    RETURN 'datos_incompletos:' || array_to_string(v_faltantes, ',');
  END IF;

  v_experiencia := v_experiencia_texto::integer;

  v_formacion := public.perfil_texto(p_perfil, 'formacion_declarada', 'formacionDeclarada');
  v_foto := public.perfil_texto(p_perfil, 'foto_publica', 'fotoPublica');
  v_modalidad := public.perfil_texto(p_perfil, 'modalidad');
  v_horarios := public.perfil_texto(p_perfil, 'horarios');
  v_tarifas := public.perfil_texto(p_perfil, 'tarifas_orientativas', 'tarifasOrientativas');
  v_identificacion := public.perfil_texto(p_perfil, 'identificacion_privada', 'identificacionPrivada');
  v_tarjeta := public.perfil_texto(p_perfil, 'tarjeta_profesional', 'tarjetaProfesional');

  -- Autorización de publicación: sólo 'publico' habilita la visibilidad pública. El
  -- perfil seguirá sin aparecer hasta que exista una verificación aprobada.
  v_visibilidad := CASE
    WHEN lower(btrim(COALESCE(p_perfil->>'visibilidad', ''))) = 'publico' THEN 'publico'::visibilidad_perfil
    ELSE 'oculto'::visibilidad_perfil
  END;

  -- Objetos y arreglos: se elige la primera clave con el tipo esperado. No se usa
  -- COALESCE porque un JSON null no es NULL en SQL y no debe ganar la precedence.
  v_medios := CASE
    WHEN jsonb_typeof(p_perfil->'medios_contacto') = 'object' THEN p_perfil->'medios_contacto'
    WHEN jsonb_typeof(p_perfil->'mediosContacto') = 'object' THEN p_perfil->'mediosContacto'
    ELSE NULL
  END;

  v_campos := CASE
    WHEN jsonb_typeof(p_perfil->'campos_opcionales_publicos') = 'object' THEN p_perfil->'campos_opcionales_publicos'
    WHEN jsonb_typeof(p_perfil->'camposPublicos') = 'object' THEN p_perfil->'camposPublicos'
    ELSE '{}'::jsonb
  END;

  v_areas := CASE
    WHEN jsonb_typeof(p_perfil->'areas') = 'array' THEN p_perfil->'areas'
    WHEN jsonb_typeof(p_perfil->'areaIds') = 'array' THEN p_perfil->'areaIds'
    WHEN jsonb_typeof(p_perfil->'area_ids') = 'array' THEN p_perfil->'area_ids'
    ELSE '[]'::jsonb
  END;

  v_tipos := CASE
    WHEN jsonb_typeof(p_perfil->'tipos_caso') = 'array' THEN p_perfil->'tipos_caso'
    WHEN jsonb_typeof(p_perfil->'tiposCaso') = 'array' THEN p_perfil->'tiposCaso'
    WHEN jsonb_typeof(p_perfil->'tipoCasoIds') = 'array' THEN p_perfil->'tipoCasoIds'
    WHEN jsonb_typeof(p_perfil->'tipo_caso_ids') = 'array' THEN p_perfil->'tipo_caso_ids'
    ELSE '[]'::jsonb
  END;

  INSERT INTO public.perfiles_abogados (
    cuenta_id,
    nombre_profesional,
    descripcion,
    experiencia_anios,
    ciudad_atencion,
    activo,
    visibilidad,
    formacion_declarada,
    foto_publica,
    modalidad,
    horarios,
    tarifas_orientativas,
    medios_contacto,
    campos_opcionales_publicos
  ) VALUES (
    p_cuenta_id,
    v_nombre,
    v_descripcion,
    v_experiencia,
    v_ciudad,
    TRUE,
    v_visibilidad,
    v_formacion,
    v_foto,
    v_modalidad,
    v_horarios,
    v_tarifas,
    -- Medios de contacto: sólo claves conocidas con valor textual no vacío.
    (SELECT jsonb_object_agg(medios.clave, medios.valor)
       FROM (
         SELECT m.clave, btrim(v_medios->>m.clave) AS valor
         FROM unnest(ARRAY['correo', 'telefono', 'whatsapp', 'sitio_web', 'direccion']) AS m(clave)
       ) AS medios
      WHERE medios.valor IS NOT NULL
        AND medios.valor <> ''),
    -- Campos publicables: sólo las claves del contrato marcadas como true.
    COALESCE(
      (SELECT jsonb_object_agg(campo.clave, TRUE)
         FROM unnest(ARRAY[
           'foto_publica', 'formacion_declarada', 'modalidad', 'horarios',
           'tarifas_orientativas', 'medios_contacto'
         ]) AS campo(clave)
        WHERE v_campos->campo.clave = 'true'::jsonb),
      '{}'::jsonb
    )
  )
  ON CONFLICT (cuenta_id) DO NOTHING
  RETURNING id INTO v_perfil_id;

  IF v_perfil_id IS NULL THEN
    -- El perfil ya existía: se recupera su identificador para completar el resto.
    SELECT p.id INTO v_perfil_id FROM public.perfiles_abogados p WHERE p.cuenta_id = p_cuenta_id;
    IF v_perfil_id IS NULL THEN
      RETURN 'perfil_no_creado';
    END IF;
    v_resultado := 'perfil_existente';
  ELSE
    v_resultado := 'creado';
  END IF;

  -- Áreas jurídicas declaradas, validadas contra el catálogo existente.
  IF jsonb_array_length(v_areas) > 0 THEN
    FOR v_area IN
      SELECT a.id
      FROM (
        SELECT valor::uuid AS id
        FROM jsonb_array_elements_text(v_areas) AS t(valor)
        WHERE valor ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      ) AS declaradas
      JOIN public.areas_juridicas a ON a.id = declaradas.id
    LOOP
      INSERT INTO public.perfil_area (perfil_id, area_id)
      VALUES (v_perfil_id, v_area)
      ON CONFLICT (perfil_id, area_id) DO NOTHING;
    END LOOP;
  END IF;

  -- Tipos de caso declarados, validados contra el catálogo existente.
  IF jsonb_array_length(v_tipos) > 0 THEN
    FOR v_tipo IN
      SELECT tc.id
      FROM (
        SELECT valor::uuid AS id
        FROM jsonb_array_elements_text(v_tipos) AS t(valor)
        WHERE valor ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      ) AS declarados
      JOIN public.tipos_caso tc ON tc.id = declarados.id
    LOOP
      INSERT INTO public.perfil_tipo_caso (perfil_id, tipo_caso_id)
      VALUES (v_perfil_id, v_tipo)
      ON CONFLICT (perfil_id, tipo_caso_id) DO NOTHING;
    END LOOP;
  END IF;

  -- Presentación de datos verificables: pendiente y sin aprobación (la decisión y el
  -- alcance los registra la administración). No se crea ninguna revisión aquí.
  IF v_identificacion IS NOT NULL AND v_tarjeta IS NOT NULL THEN
    INSERT INTO public.versiones_profesionales (
      perfil_id, numero_version, identificacion_privada, tarjeta_profesional, estado_revision
    ) VALUES (
      v_perfil_id,
      1,
      v_identificacion,
      v_tarjeta,
      'pendiente'::estado_revision_prof
    )
    ON CONFLICT (perfil_id, numero_version) DO NOTHING;
  END IF;

  RETURN v_resultado;
END;
$_$;


ALTER FUNCTION "public"."crear_perfil_profesional_desde_metadatos"("p_cuenta_id" "uuid", "p_perfil" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ejecutar_revalidacion_periodica"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_dias_periodicidad integer;
    v_perfil record;
BEGIN
 -- LEXPORTAL_ADMIN_REVALIDACION
 IF NOT COALESCE(public.es_admin(),false) AND COALESCE(auth.role(),'')<>'service_role' AND NOT (session_user IN ('postgres','supabase_admin') AND current_setting('role',true) IN ('none','postgres','supabase_admin')) THEN
 RAISE EXCEPTION 'Se requiere administración' USING ERRCODE='42501';
 END IF;
    SELECT periodicidad_dias INTO v_dias_periodicidad
    FROM public.politica_revalidacion
    ORDER BY vigente_desde DESC
    LIMIT 1;

    -- Si no hay política configurada, abortar silenciosamente
    IF v_dias_periodicidad IS NULL THEN
        RETURN;
    END IF;

    -- 2. Iterar sobre los perfiles cuya fecha vigente expiró
    FOR v_perfil IN 
        SELECT id, cuenta_id 
        FROM public.perfiles_abogados
        WHERE visibilidad = 'publico' 
          AND fecha_verificacion_vigente + (v_dias_periodicidad * INTERVAL '1 day') < NOW()
    LOOP
        -- A. Suspender la visibilidad del perfil
        UPDATE public.perfiles_abogados
        SET visibilidad = 'oculto',
            motivo_suspension = 'Vencimiento del periodo de verificación (' || v_dias_periodicidad || ' días). Requiere nueva revisión.',
            suspendido_en = NOW()
        WHERE id = v_perfil.id;

        -- B. Generar notificación para el abogado
        INSERT INTO public.notificaciones (destinatario_id, evento)
        VALUES (v_perfil.cuenta_id, 'perfil_suspendido'::evento_noti);
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."ejecutar_revalidacion_periodica"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION public.enviar_aviso_correo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  -- Función Edge local (`supabase start`). En un proyecto alojado se sustituye por
  -- https://<referencia>.supabase.co/functions/v1/enviar-correos
  v_url text;
  v_secret text;
  v_headers jsonb;
  v_cuerpo jsonb;
  v_funcion text;
  v_firma text;
  v_resultado text;
  v_detalle text;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name='lexportal_mail_endpoint' ORDER BY created_at DESC LIMIT 1;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name='lexportal_mail_webhook_secret' ORDER BY created_at DESC LIMIT 1;
  v_headers := jsonb_build_object('Content-Type','application/json','x-lexportal-webhook-secret',v_secret);
  -- LEXPORTAL_RESPETA_PREFERENCIA
  IF NOT EXISTS (SELECT 1 FROM public.cuentas c WHERE c.id=NEW.destinatario_id AND c.avisos_correo) THEN
    UPDATE public.notificaciones SET estado_aviso_correo='no_aplica' WHERE id=NEW.id;
    RETURN NEW;
  END IF;
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

  IF v_url IS NULL OR v_secret IS NULL THEN
    v_resultado := 'error';
    v_detalle := 'Falta la configuración privada del envío de correo';
  ELSIF v_funcion IS NULL THEN
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
$function$
;


ALTER FUNCTION "public"."enviar_aviso_correo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."es_admin"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cuentas 
    WHERE id = auth.uid() AND rol = 'administrador'
  );
$$;


ALTER FUNCTION "public"."es_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."es_dueno_perfil"("p_perfil_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles_abogados 
    WHERE id = p_perfil_id AND cuenta_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."es_dueno_perfil"("p_perfil_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."es_participante_solicitud"("p_solicitud_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.solicitudes_contacto sc
    LEFT JOIN public.perfiles_abogados pa ON sc.abogado_perfil_id = pa.id
    WHERE sc.id = p_solicitud_id 
      AND (sc.ciudadano_id = auth.uid() OR pa.cuenta_id = auth.uid())
  );
$$;


ALTER FUNCTION "public"."es_participante_solicitud"("p_solicitud_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guardar_datos_practica"("p_perfil_id" "uuid", "p_datos" "jsonb", "p_areas" "uuid"[], "p_tipos" "uuid"[], "p_foto_ruta" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE
  v_perfil public.perfiles_abogados;
  v_areas uuid[]; v_tipos uuid[]; v_areas_antes uuid[]; v_tipos_antes uuid[];
  v_contacto jsonb; v_clave text;
BEGIN
  SELECT p.* INTO v_perfil FROM public.perfiles_abogados p JOIN public.cuentas c ON c.id=p.cuenta_id
  WHERE p.id=p_perfil_id AND p.cuenta_id=auth.uid() AND c.rol='abogado' AND c.estado='activa' FOR UPDATE OF p;
  IF NOT FOUND THEN RAISE EXCEPTION 'No tienes permiso para editar este perfil' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_datos) IS DISTINCT FROM 'object'
     OR coalesce(length(btrim(p_datos->>'nombre_profesional')),0) NOT BETWEEN 1 AND 200
     OR coalesce(length(btrim(p_datos->>'ciudad_atencion')),0) NOT BETWEEN 1 AND 200
     OR coalesce(length(btrim(p_datos->>'descripcion')),0) NOT BETWEEN 50 AND 500
     OR coalesce(p_datos->>'experiencia_anios','') !~ '^[0-9]{1,3}$'
  THEN RAISE EXCEPTION 'Revisa los datos de práctica'; END IF;
  FOR v_clave IN SELECT unnest(ARRAY['nombre_profesional','ciudad_atencion','descripcion','formacion_declarada','modalidad','horarios','tarifas_orientativas']) LOOP
    IF p_datos ? v_clave AND jsonb_typeof(p_datos->v_clave) NOT IN ('string','null') THEN RAISE EXCEPTION 'Formato de texto inválido'; END IF;
  END LOOP;
  IF length(coalesce(p_datos->>'formacion_declarada',''))>1000 OR length(coalesce(p_datos->>'horarios',''))>1000
     OR length(coalesce(p_datos->>'tarifas_orientativas',''))>500 THEN RAISE EXCEPTION 'Texto demasiado extenso'; END IF;
  IF nullif(p_datos->>'modalidad','') IS NOT NULL AND p_datos->>'modalidad' NOT IN ('Presencial','Virtual','Presencial y virtual')
     AND p_datos->>'modalidad' IS DISTINCT FROM v_perfil.modalidad THEN RAISE EXCEPTION 'Modalidad inválida'; END IF;
  SELECT coalesce(array_agg(area_id ORDER BY area_id),'{}') INTO v_areas_antes FROM public.perfil_area WHERE perfil_id=p_perfil_id;
  SELECT coalesce(array_agg(tipo_caso_id ORDER BY tipo_caso_id),'{}') INTO v_tipos_antes FROM public.perfil_tipo_caso WHERE perfil_id=p_perfil_id;
  SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}') INTO v_areas FROM unnest(p_areas) x;
  SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}') INTO v_tipos FROM unnest(p_tipos) x;
  IF v_areas IS DISTINCT FROM v_areas_antes OR v_tipos IS DISTINCT FROM v_tipos_antes THEN
    IF cardinality(v_areas) NOT BETWEEN 1 AND 8 OR cardinality(v_tipos) NOT BETWEEN 1 AND 8
      OR EXISTS(SELECT 1 FROM unnest(v_areas) x WHERE NOT EXISTS(SELECT 1 FROM public.areas_juridicas a WHERE a.id=x AND (a.activa OR x=ANY(v_areas_antes))))
      OR EXISTS(SELECT 1 FROM unnest(v_tipos) x WHERE NOT EXISTS(SELECT 1 FROM public.tipos_caso t WHERE t.id=x AND (t.activo OR x=ANY(v_tipos_antes))))
      OR EXISTS(SELECT 1 FROM unnest(v_tipos) x WHERE NOT EXISTS(SELECT 1 FROM public.area_tipo_caso r WHERE r.tipo_caso_id=x AND r.area_id=ANY(v_areas)))
    THEN RAISE EXCEPTION 'Revisa las áreas y los tipos de caso'; END IF;
  END IF;
  v_contacto := coalesce(v_perfil.medios_contacto,'{}'::jsonb);
  IF p_datos ? 'medios_contacto' THEN
    IF jsonb_typeof(p_datos->'medios_contacto') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Formato de contacto inválido'; END IF;
    FOR v_clave IN SELECT unnest(ARRAY['correo','telefono','whatsapp','sitio_web']) LOOP
      IF p_datos->'medios_contacto' ? v_clave THEN
        IF jsonb_typeof(p_datos->'medios_contacto'->v_clave) NOT IN ('string','null') THEN RAISE EXCEPTION 'Contacto inválido'; END IF;
        v_contacto := v_contacto || jsonb_build_object(v_clave,nullif(btrim(p_datos->'medios_contacto'->>v_clave),''));
      END IF;
    END LOOP;
  END IF;
  IF p_foto_ruta IS NOT NULL THEN
    IF NOT starts_with(p_foto_ruta,auth.uid()::text||'/foto/'||p_perfil_id::text||'/') OR p_foto_ruta LIKE '%..%'
      OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id='perfiles-publicos' AND o.name=p_foto_ruta
        AND o.metadata->>'mimetype' IN ('image/jpeg','image/png') AND (o.metadata->>'size')::bigint BETWEEN 1 AND 5242880)
    THEN RAISE EXCEPTION 'La fotografía no está disponible en el almacén privado'; END IF;
    UPDATE public.perfiles_abogados SET foto_publica=p_foto_ruta WHERE id=p_perfil_id;
  END IF;
  UPDATE public.perfiles_abogados SET nombre_profesional=btrim(p_datos->>'nombre_profesional'),descripcion=btrim(p_datos->>'descripcion'),
    experiencia_anios=(p_datos->>'experiencia_anios')::int,ciudad_atencion=btrim(p_datos->>'ciudad_atencion'),
    formacion_declarada=CASE WHEN p_datos ? 'formacion_declarada' THEN nullif(btrim(p_datos->>'formacion_declarada'),'') ELSE formacion_declarada END,
    modalidad=CASE WHEN p_datos ? 'modalidad' THEN nullif(btrim(p_datos->>'modalidad'),'') ELSE modalidad END,
    horarios=CASE WHEN p_datos ? 'horarios' THEN nullif(btrim(p_datos->>'horarios'),'') ELSE horarios END,
    tarifas_orientativas=CASE WHEN p_datos ? 'tarifas_orientativas' THEN nullif(btrim(p_datos->>'tarifas_orientativas'),'') ELSE tarifas_orientativas END,
    medios_contacto=v_contacto WHERE id=p_perfil_id;
  DELETE FROM public.perfil_area WHERE perfil_id=p_perfil_id AND NOT(area_id=ANY(v_areas));
  INSERT INTO public.perfil_area SELECT p_perfil_id,x FROM unnest(v_areas) x ON CONFLICT DO NOTHING;
  DELETE FROM public.perfil_tipo_caso WHERE perfil_id=p_perfil_id AND NOT(tipo_caso_id=ANY(v_tipos));
  INSERT INTO public.perfil_tipo_caso SELECT p_perfil_id,x FROM unnest(v_tipos) x ON CONFLICT DO NOTHING;
END $_$;


ALTER FUNCTION "public"."guardar_datos_practica"("p_perfil_id" "uuid", "p_datos" "jsonb", "p_areas" "uuid"[], "p_tipos" "uuid"[], "p_foto_ruta" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_rol rol_cuenta;
  v_documentos jsonb;
  v_perfil jsonb;
  v_resultado text;
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'rol', 'ciudadano') NOT IN ('ciudadano', 'abogado') THEN
    RAISE EXCEPTION 'El autorregistro solo admite ciudadanos y abogados' USING ERRCODE = '22023';
  END IF;
  v_rol := COALESCE(NEW.raw_user_meta_data->>'rol', 'ciudadano')::public.rol_cuenta;

  -- El alta y sus aceptaciones se confirman en la misma transacción de Auth.
  v_documentos := NEW.raw_user_meta_data->'documentos_aceptados';
  IF jsonb_typeof(v_documentos) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Debes aceptar los documentos legales vigentes' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM (
        SELECT DISTINCT ON (tipo) id
        FROM public.documentos_legales
        WHERE tipo IN ('terminos_condiciones','politica_privacidad','tratamiento_datos') AND publicada_en <= now()
        ORDER BY tipo, publicada_en DESC, id
      ) vigentes WHERE v_documentos @> jsonb_build_array(vigentes.id::text)) <> 3 THEN
    RAISE EXCEPTION 'Faltan aceptaciones legales vigentes' USING ERRCODE = '22023';
  END IF;


  INSERT INTO public.cuentas (
    id, rol, nombre_completo, correo, telefono, estado, avisos_correo
  ) VALUES (
    NEW.id,
    v_rol,
    COALESCE(NEW.raw_user_meta_data->>'nombre_completo', 'Usuario Sin Nombre'),
    NEW.email,
    NEW.raw_user_meta_data->>'telefono',
    'activa'::estado_cuenta,
    TRUE
  );

  -- Aceptaciones declaradas en el formulario de registro (CU 01 y CU 02).
  v_documentos := NEW.raw_user_meta_data->'documentos_aceptados';
  IF jsonb_typeof(v_documentos) = 'array' THEN
    INSERT INTO public.aceptaciones_legales (cuenta_id, documento_id)
    SELECT NEW.id, elemento::uuid
    FROM jsonb_array_elements_text(v_documentos) AS elemento
    JOIN public.documentos_legales d ON d.id = elemento::uuid
    WHERE elemento ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ON CONFLICT (cuenta_id, documento_id) DO NOTHING;
  END IF;

  -- Alta profesional (CU 02). Cualquier fallo se aísla: la cuenta ya está creada.
  IF v_rol = 'abogado'::rol_cuenta THEN
    v_perfil := NEW.raw_user_meta_data->'perfil_profesional';

    BEGIN
      v_resultado := public.crear_perfil_profesional_desde_metadatos(NEW.id, v_perfil);
    EXCEPTION WHEN OTHERS THEN
      v_resultado := 'error:' || SQLSTATE || ':' || SQLERRM;
    END;

    BEGIN
      INSERT INTO public.altas_profesionales_diagnostico (cuenta_id, resultado, detalle)
      VALUES (
        NEW.id,
        v_resultado,
        jsonb_build_object(
          'rol', v_rol,
          'tipo_metadatos_perfil', jsonb_typeof(v_perfil),
          'claves_metadatos_perfil', COALESCE(
            (SELECT jsonb_agg(clave) FROM jsonb_object_keys(v_perfil) AS clave),
            '[]'::jsonb
          ),
          'correo', NEW.email
        )
      );
    EXCEPTION WHEN OTHERS THEN
      -- El diagnóstico nunca debe impedir el alta de la cuenta.
      NULL;
    END;

    RAISE WARNING 'handle_new_user: alta profesional de % -> %', NEW.id, v_resultado;
  END IF;

  RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."iniciar_revision_profesional"("p_version_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_estado public.estado_revision_prof; v_revision uuid;
BEGIN
 IF NOT COALESCE(public.es_admin(),false) OR auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Se requiere administración autenticada' USING ERRCODE='42501';
 END IF;
 SELECT estado_revision INTO v_estado FROM public.versiones_profesionales WHERE id=p_version_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Versión no disponible' USING ERRCODE='22023'; END IF;
 SELECT id INTO v_revision FROM public.revisiones_profesionales
 WHERE version_id=p_version_id AND decidida_en IS NULL AND estado IN ('pendiente','en_revision')
 ORDER BY programada_en NULLS LAST,id LIMIT 1;
 IF v_revision IS NOT NULL THEN RETURN v_revision; END IF;
 IF v_estado NOT IN ('pendiente','en_revision') THEN
  RAISE EXCEPTION 'La versión ya fue decidida' USING ERRCODE='22023';
 END IF;
 UPDATE public.versiones_profesionales SET estado_revision='en_revision' WHERE id=p_version_id;
 INSERT INTO public.revisiones_profesionales(version_id,tipo,estado,programada_en,responsable_id)
 VALUES(p_version_id,'inicial','en_revision',now(),auth.uid()) RETURNING id INTO v_revision;
 RETURN v_revision;
END;
$$;


ALTER FUNCTION "public"."iniciar_revision_profesional"("p_version_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."nombres_abogados_participantes"("p_perfiles" "uuid"[]) RETURNS TABLE("perfil_id" "uuid", "nombre_profesional" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT p.id, p.nombre_profesional
  FROM public.perfiles_abogados p
  WHERE p.id = ANY (p_perfiles)
    AND (
      -- El titular del perfil.
      p.cuenta_id = (SELECT auth.uid())
      -- O un ciudadano con una solicitud dirigida a ese perfil.
      OR EXISTS (
        SELECT 1
        FROM public.solicitudes_contacto s
        WHERE s.abogado_perfil_id = p.id
          AND s.ciudadano_id = (SELECT auth.uid())
      )
    );
$$;


ALTER FUNCTION "public"."nombres_abogados_participantes"("p_perfiles" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notificar_evento_solicitud"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cuenta_abogado uuid;
BEGIN
  SELECT p.cuenta_id INTO v_cuenta_abogado
  FROM public.perfiles_abogados p
  WHERE p.id = NEW.abogado_perfil_id;

  IF TG_OP = 'INSERT' THEN
    IF v_cuenta_abogado IS NOT NULL AND v_cuenta_abogado <> NEW.ciudadano_id THEN
      INSERT INTO public.notificaciones (destinatario_id, evento, solicitud_contacto_id)
      VALUES (v_cuenta_abogado, 'nueva_solicitud'::evento_noti, NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    IF NEW.estado = 'aceptada'::estado_solicitud THEN
      INSERT INTO public.notificaciones (destinatario_id, evento, solicitud_contacto_id)
      VALUES (NEW.ciudadano_id, 'solicitud_aceptada'::evento_noti, NEW.id);
    ELSIF NEW.estado = 'rechazada'::estado_solicitud THEN
      INSERT INTO public.notificaciones (destinatario_id, evento, solicitud_contacto_id)
      VALUES (NEW.ciudadano_id, 'solicitud_rechazada'::evento_noti, NEW.id);
    ELSIF NEW.estado = 'cancelada'::estado_solicitud AND v_cuenta_abogado IS NOT NULL THEN
      INSERT INTO public.notificaciones (destinatario_id, evento, solicitud_contacto_id)
      VALUES (v_cuenta_abogado, 'solicitud_cancelada'::evento_noti, NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notificar_evento_solicitud"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notificar_mensaje_nuevo"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_solicitud uuid;
  v_ciudadano uuid;
  v_abogado uuid;
  v_destino uuid;
BEGIN
  SELECT c.solicitud_id, s.ciudadano_id, p.cuenta_id
  INTO v_solicitud, v_ciudadano, v_abogado
  FROM public.conversaciones c
  JOIN public.solicitudes_contacto s ON s.id = c.solicitud_id
  JOIN public.perfiles_abogados p ON p.id = s.abogado_perfil_id
  WHERE c.id = NEW.conversacion_id;

  -- El destinatario es el otro participante; nunca el autor del mensaje.
  v_destino := CASE WHEN NEW.autor_id = v_ciudadano THEN v_abogado ELSE v_ciudadano END;

  IF v_destino IS NULL OR v_destino = NEW.autor_id THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.notificaciones n
    WHERE n.destinatario_id = v_destino
      AND n.evento = 'nuevo_mensaje'::evento_noti
      AND n.solicitud_contacto_id = v_solicitud
      AND n.leida_en IS NULL
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notificaciones (destinatario_id, evento, mensaje_id, solicitud_contacto_id)
  VALUES (v_destino, 'nuevo_mensaje'::evento_noti, NEW.id, v_solicitud);

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notificar_mensaje_nuevo"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notificar_resolucion_privacidad"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.estado = 'resuelta'::estado_peticion_priv
     AND (OLD.estado IS NULL OR OLD.estado <> 'resuelta'::estado_peticion_priv) THEN
    INSERT INTO public.notificaciones (destinatario_id, evento, solicitud_privacidad_id)
    VALUES (NEW.titular_id, 'privacidad_resuelta'::evento_noti, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notificar_resolucion_privacidad"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notificar_suspension_perfil"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.visibilidad = 'oculto'::visibilidad_perfil
     AND OLD.visibilidad = 'publico'::visibilidad_perfil
     AND NEW.motivo_suspension IS NOT NULL THEN
    INSERT INTO public.notificaciones (destinatario_id, evento)
    VALUES (NEW.cuenta_id, 'perfil_suspendido'::evento_noti);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notificar_suspension_perfil"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."perfil_texto"("p_perfil" "jsonb", VARIADIC "p_claves" "text"[]) RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT NULLIF(btrim(t.valor), '')
  FROM unnest(p_claves) WITH ORDINALITY AS clave(nombre, orden)
  CROSS JOIN LATERAL (SELECT p_perfil->>clave.nombre AS valor) AS t
  WHERE t.valor IS NOT NULL
    AND btrim(t.valor) <> ''
  ORDER BY clave.orden
  LIMIT 1;
$$;


ALTER FUNCTION "public"."perfil_texto"("p_perfil" "jsonb", VARIADIC "p_claves" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."preparar_version_profesional"("p_perfil_id" "uuid", "p_tarjeta" "text", "p_identificacion" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE v_id uuid; v_identificacion text; v_numero int;
BEGIN
  PERFORM 1 FROM public.perfiles_abogados p JOIN public.cuentas c ON c.id=p.cuenta_id
  WHERE p.id=p_perfil_id AND p.cuenta_id=auth.uid() AND c.rol='abogado' AND c.estado='activa' FOR UPDATE OF p;
  IF NOT FOUND THEN RAISE EXCEPTION 'No tienes permiso para presentar esta versión' USING ERRCODE='42501'; END IF;
  IF length(btrim(p_tarjeta)) NOT BETWEEN 3 AND 40 OR p_tarjeta IS NULL THEN RAISE EXCEPTION 'Tarjeta profesional inválida'; END IF;
  SELECT identificacion_privada INTO v_identificacion FROM public.versiones_profesionales WHERE perfil_id=p_perfil_id ORDER BY numero_version DESC LIMIT 1;
  v_identificacion:=coalesce(nullif(btrim(p_identificacion),''),v_identificacion);
  IF v_identificacion IS NULL OR length(v_identificacion) NOT BETWEEN 3 AND 40 THEN RAISE EXCEPTION 'Falta la identificación privada'; END IF;
  SELECT id INTO v_id FROM public.versiones_profesionales WHERE perfil_id=p_perfil_id AND estado_revision='pendiente'
    AND tarjeta_profesional=btrim(p_tarjeta) AND identificacion_privada=v_identificacion ORDER BY numero_version DESC LIMIT 1;
  IF FOUND THEN RETURN v_id; END IF;
  SELECT coalesce(max(numero_version),0)+1 INTO v_numero FROM public.versiones_profesionales WHERE perfil_id=p_perfil_id;
  INSERT INTO public.versiones_profesionales(perfil_id,numero_version,identificacion_privada,tarjeta_profesional,estado_revision)
  VALUES(p_perfil_id,v_numero,v_identificacion,btrim(p_tarjeta),'pendiente') RETURNING id INTO v_id;
  RETURN v_id;
END $$;


ALTER FUNCTION "public"."preparar_version_profesional"("p_perfil_id" "uuid", "p_tarjeta" "text", "p_identificacion" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."procesar_revision_profesional"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_perfil_id UUID;
BEGIN
  -- Verificar si la revisión fue aprobada y si cambió de estado
  IF NEW.estado = 'aprobada'::estado_revision_prof AND (OLD.estado IS NULL OR OLD.estado <> 'aprobada'::estado_revision_prof) THEN
    
    -- Obtener a qué perfil pertenece esta versión
    SELECT perfil_id INTO v_perfil_id 
    FROM public.versiones_profesionales 
    WHERE id = NEW.version_id;

    -- 1. Actualizar el estado de la versión profesional
    UPDATE public.versiones_profesionales
    SET estado_revision = 'aprobada'::estado_revision_prof
    WHERE id = NEW.version_id;

    -- 2. Establecer esta versión como la aprobada vigente en el perfil
    UPDATE public.perfiles_abogados
    SET version_aprobada_id = NEW.version_id,
        fecha_verificacion_vigente = NOW()
    WHERE id = v_perfil_id;
    
    -- 3. Crear notificación para el abogado de que su revisión fue resuelta
    INSERT INTO public.notificaciones (
      destinatario_id,
      evento,
      revision_id
    )
    SELECT cuenta_id, 'revision_resuelta'::evento_noti, NEW.id
    FROM public.perfiles_abogados WHERE id = v_perfil_id;

  END IF;

  -- LEXPORTAL_DECISION_NO_FAVORABLE
 IF NEW.estado IN ('rechazada'::public.estado_revision_prof,'requiere_correcciones'::public.estado_revision_prof) AND (TG_OP='INSERT' OR OLD.estado IS DISTINCT FROM NEW.estado) THEN
  IF NEW.tipo='inicial'::public.tipo_revision_prof THEN
   UPDATE public.versiones_profesionales SET estado_revision=NEW.estado WHERE id=NEW.version_id AND id IS DISTINCT FROM (SELECT p.version_aprobada_id FROM public.perfiles_abogados p WHERE p.id=public.versiones_profesionales.perfil_id);
  END IF;
  INSERT INTO public.notificaciones(destinatario_id,evento,revision_id) SELECT p.cuenta_id,'revision_resuelta'::public.evento_noti,NEW.id FROM public.perfiles_abogados p JOIN public.versiones_profesionales v ON v.perfil_id=p.id WHERE v.id=NEW.version_id;
 END IF;
 RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."procesar_revision_profesional"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recuperar_perfil_profesional"("p_perfil" "jsonb" DEFAULT NULL::"jsonb", "p_documentos" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE
  v_uid uuid:=auth.uid(); v_id uuid; v_raw jsonb; v_normal jsonb; v_areas jsonb; v_tipos jsonb;
  v_key text; v_alias text; v_text text; v_result text; v_valid boolean:=true;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Inicia sesión para recuperar tu perfil' USING ERRCODE='42501'; END IF;
  -- Serializa dos reintentos para la misma cuenta, incluso desde clientes distintos.
  PERFORM 1 FROM public.cuentas c WHERE c.id=v_uid AND c.rol='abogado' AND c.estado='activa' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La cuenta no puede recuperar un perfil profesional' USING ERRCODE='42501'; END IF;
  SELECT u.raw_user_meta_data->'perfil_profesional' INTO v_raw FROM auth.users u
    WHERE u.id=v_uid AND u.email_confirmed_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Confirma tu correo antes de recuperar el perfil' USING ERRCODE='42501'; END IF;
  SELECT p.id INTO v_id FROM public.perfiles_abogados p WHERE p.cuenta_id=v_uid;
  IF FOUND THEN RETURN v_id; END IF; -- Nunca completar ni sobrescribir un perfil existente.

  v_raw:=coalesce(p_perfil,v_raw);
  IF jsonb_typeof(v_raw) IS DISTINCT FROM 'object' THEN
    IF p_perfil IS NULL THEN RETURN NULL; END IF;
    RAISE EXCEPTION 'Revisa los datos del perfil' USING ERRCODE='22023';
  END IF;
  v_normal:='{}'::jsonb;
  FOR v_key,v_alias IN SELECT * FROM (VALUES
    ('nombre_profesional','nombreProfesional'),('descripcion','descripcion'),('ciudad_atencion','ciudadAtencion'),
    ('experiencia_anios','experienciaAnios'),('formacion_declarada','formacionDeclarada'),('modalidad','modalidad'),
    ('horarios','horarios'),('tarifas_orientativas','tarifasOrientativas'),
    ('identificacion_privada','identificacionPrivada'),('tarjeta_profesional','tarjetaProfesional')) AS keys(k,a)
  LOOP
    IF EXISTS(SELECT 1 FROM jsonb_each(v_raw) e WHERE e.key IN (v_key,v_alias)
      AND jsonb_typeof(e.value) NOT IN ('null','string') AND NOT(v_key='experiencia_anios' AND jsonb_typeof(e.value)='number'))
    THEN v_valid:=false; END IF;
    v_text:=public.perfil_texto(v_raw,v_key,v_alias);
    v_normal:=v_normal||jsonb_build_object(v_key,v_text);
  END LOOP;
  v_valid:=v_valid AND coalesce(length(v_normal->>'nombre_profesional'),0) BETWEEN 1 AND 200
    AND coalesce(length(v_normal->>'ciudad_atencion'),0) BETWEEN 1 AND 200
    AND coalesce(length(v_normal->>'descripcion'),0) BETWEEN 50 AND 500
    AND coalesce(v_normal->>'experiencia_anios','') ~ '^[0-9]{1,3}$'
    AND coalesce(length(v_normal->>'identificacion_privada'),0) BETWEEN 3 AND 40
    AND coalesce(length(v_normal->>'tarjeta_profesional'),0) BETWEEN 3 AND 40
    AND length(coalesce(v_normal->>'formacion_declarada',''))<=1000
    AND length(coalesce(v_normal->>'horarios',''))<=1000
    AND length(coalesce(v_normal->>'tarifas_orientativas',''))<=500
    AND (v_normal->>'modalidad' IS NULL OR v_normal->>'modalidad' IN ('Presencial','Virtual','Presencial y virtual'));
  SELECT coalesce((SELECT value FROM jsonb_each(v_raw) WHERE key IN ('areas','areaIds','area_ids')
    AND jsonb_typeof(value)='array' ORDER BY CASE key WHEN 'areas' THEN 1 WHEN 'areaIds' THEN 2 ELSE 3 END LIMIT 1),'[]'::jsonb) INTO v_areas;
  SELECT coalesce((SELECT value FROM jsonb_each(v_raw) WHERE key IN ('tipos_caso','tiposCaso','tipoCasoIds','tipo_caso_ids')
    AND jsonb_typeof(value)='array' ORDER BY CASE key WHEN 'tipos_caso' THEN 1 WHEN 'tiposCaso' THEN 2 WHEN 'tipoCasoIds' THEN 3 ELSE 4 END LIMIT 1),'[]'::jsonb) INTO v_tipos;
  v_valid:=v_valid AND jsonb_array_length(v_areas) BETWEEN 1 AND 8 AND jsonb_array_length(v_tipos) BETWEEN 1 AND 8
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(v_areas||v_tipos) x
      WHERE (x ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') IS NOT TRUE);
  IF v_valid THEN
    v_valid:=NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(v_areas) x
        WHERE NOT EXISTS(SELECT 1 FROM public.areas_juridicas a WHERE a.id=x::uuid AND a.activa))
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(v_tipos) x
        WHERE NOT EXISTS(SELECT 1 FROM public.tipos_caso t WHERE t.id=x::uuid AND t.activo)
          OR NOT EXISTS(SELECT 1 FROM public.area_tipo_caso r WHERE r.tipo_caso_id=x::uuid AND v_areas @> jsonb_build_array(r.area_id::text)));
  END IF;
  IF NOT v_valid THEN
    IF p_perfil IS NULL THEN RETURN NULL; END IF;
    RAISE EXCEPTION 'Revisa los datos, la identificación y las especialidades del perfil' USING ERRCODE='22023';
  END IF;
  v_normal:=v_normal||jsonb_build_object('areas',v_areas,'tipos_caso',v_tipos,
    'medios_contacto',CASE WHEN jsonb_typeof(v_raw->'medios_contacto')='object' THEN v_raw->'medios_contacto'
      WHEN jsonb_typeof(v_raw->'mediosContacto')='object' THEN v_raw->'mediosContacto' ELSE '{}'::jsonb END,
    'campos_opcionales_publicos',CASE WHEN jsonb_typeof(v_raw->'campos_opcionales_publicos')='object' THEN v_raw->'campos_opcionales_publicos'
      WHEN jsonb_typeof(v_raw->'camposPublicos')='object' THEN v_raw->'camposPublicos' ELSE '{}'::jsonb END,
    'visibilidad',CASE WHEN v_raw->>'visibilidad'='publico' THEN 'publico' ELSE 'oculto' END);
  -- No aceptar roles, aprobaciones, fotografías arbitrarias ni otras claves privilegiadas.
  IF p_documentos IS NOT NULL THEN
    IF cardinality(p_documentos)<>3 OR (SELECT count(*) FROM (
      SELECT DISTINCT ON(tipo) id FROM public.documentos_legales
      WHERE tipo IN ('terminos_condiciones','politica_privacidad','tratamiento_datos') AND publicada_en<=now()
      ORDER BY tipo,publicada_en DESC,id) d WHERE d.id=ANY(p_documentos))<>3
    THEN RAISE EXCEPTION 'Revisa y acepta las versiones legales vigentes' USING ERRCODE='22023'; END IF;
  ELSIF (SELECT count(DISTINCT d.tipo) FROM public.aceptaciones_legales a JOIN public.documentos_legales d ON d.id=a.documento_id
      WHERE a.cuenta_id=v_uid AND d.tipo IN ('terminos_condiciones','politica_privacidad','tratamiento_datos'))<>3
  THEN RETURN NULL; -- Solicitar consentimiento explícito; nunca inferirlo de metadatos editables.
  END IF;
  -- Todas las escrituras se confirman juntas; un fallo revierte también las aceptaciones nuevas.
  IF p_documentos IS NOT NULL THEN
    INSERT INTO public.aceptaciones_legales(cuenta_id,documento_id)
      SELECT v_uid,d FROM unnest(p_documentos) d ON CONFLICT(cuenta_id,documento_id) DO NOTHING;
  END IF;
  v_result:=public.crear_perfil_profesional_desde_metadatos(v_uid,v_normal);
  SELECT p.id INTO v_id FROM public.perfiles_abogados p WHERE p.cuenta_id=v_uid;
  IF v_result<>'creado' OR v_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.versiones_profesionales v
    WHERE v.perfil_id=v_id AND v.numero_version=1 AND v.estado_revision='pendiente')
  THEN RAISE EXCEPTION 'No se pudo completar el perfil; vuelve a intentarlo' USING ERRCODE='P0001'; END IF;
  INSERT INTO public.altas_profesionales_diagnostico(cuenta_id,resultado,detalle)
    VALUES(v_uid,'recuperado',jsonb_build_object('origen',CASE WHEN p_perfil IS NULL THEN 'metadatos' ELSE 'formulario' END));
  RETURN v_id;
END $_$;


ALTER FUNCTION "public"."recuperar_perfil_profesional"("p_perfil" "jsonb", "p_documentos" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_evidencia_profesional"("p_version_id" "uuid", "p_ruta" "text", "p_tipo" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM 1 FROM public.versiones_profesionales v JOIN public.perfiles_abogados p ON p.id=v.perfil_id
  JOIN public.cuentas c ON c.id=p.cuenta_id WHERE v.id=p_version_id AND p.cuenta_id=auth.uid()
    AND c.rol='abogado' AND c.estado='activa' AND v.estado_revision='pendiente' FOR UPDATE OF v;
  IF NOT FOUND THEN RAISE EXCEPTION 'La versión no admite evidencias' USING ERRCODE='42501'; END IF;
  IF p_tipo NOT IN ('tarjeta_profesional','identificacion','soporte','documento_adjunto') OR p_tipo IS NULL THEN RAISE EXCEPTION 'Tipo de evidencia inválido'; END IF;
  SELECT id INTO v_id FROM public.evidencias_privadas WHERE version_id=p_version_id AND ruta_storage_privada=p_ruta LIMIT 1;
  IF FOUND THEN RETURN v_id; END IF;
  INSERT INTO public.evidencias_privadas(version_id,tipo,ruta_storage_privada) VALUES(p_version_id,p_tipo,p_ruta) RETURNING id INTO v_id;
  RETURN v_id;
END $$;


ALTER FUNCTION "public"."registrar_evidencia_profesional"("p_version_id" "uuid", "p_ruta" "text", "p_tipo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ruta_fotografia_publicable"("p_perfil_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT regexp_replace(p.foto_publica,'^https?://[^/]+/storage/v1/object/public/perfiles-publicos/','')
  FROM public.perfiles_abogados p WHERE p.id=p_perfil_id
    AND private.fotografia_publicable(regexp_replace(p.foto_publica,'^https?://[^/]+/storage/v1/object/public/perfiles-publicos/',''));
$$;


ALTER FUNCTION "public"."ruta_fotografia_publicable"("p_perfil_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validar_creacion_conversacion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_estado estado_solicitud;
BEGIN
  SELECT estado INTO v_estado
  FROM public.solicitudes_contacto
  WHERE id = NEW.solicitud_id;

  IF v_estado IS NULL OR v_estado <> 'aceptada'::estado_solicitud THEN
    RAISE EXCEPTION 'No se puede iniciar una conversación para una solicitud que no ha sido aceptada.';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validar_creacion_conversacion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validar_emisor_mensaje"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_ciudadano_id UUID;
  v_abogado_cuenta_id UUID;
BEGIN
  -- Obtener las cuentas de los participantes de la solicitud original
  SELECT s.ciudadano_id, p.cuenta_id 
  INTO v_ciudadano_id, v_abogado_cuenta_id
  FROM public.conversaciones c
  JOIN public.solicitudes_contacto s ON s.id = c.solicitud_id
  JOIN public.perfiles_abogados p ON p.id = s.abogado_perfil_id
  WHERE c.id = NEW.conversacion_id;

  -- Verificar si el autor_id pertenece a la conversación
  IF NEW.autor_id <> v_ciudadano_id AND NEW.autor_id <> v_abogado_cuenta_id THEN
    RAISE EXCEPTION 'El autor del mensaje no forma parte de esta conversación.';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validar_emisor_mensaje"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."aceptaciones_legales" (
    "cuenta_id" "uuid" NOT NULL,
    "documento_id" "uuid" NOT NULL,
    "aceptada_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."aceptaciones_legales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."altas_profesionales_diagnostico" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cuenta_id" "uuid" NOT NULL,
    "creada_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resultado" "text" NOT NULL,
    "detalle" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."altas_profesionales_diagnostico" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."area_tipo_caso" (
    "area_id" "uuid" NOT NULL,
    "tipo_caso_id" "uuid" NOT NULL
);


ALTER TABLE "public"."area_tipo_caso" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."areas_juridicas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "activa" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."areas_juridicas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."avisos_correo_diagnostico" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "notificacion_id" "uuid" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resultado" "text" NOT NULL,
    "detalle" "text"
);


ALTER TABLE "public"."avisos_correo_diagnostico" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversaciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "solicitud_id" "uuid" NOT NULL,
    "habilitada_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."conversaciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cuentas" (
    "id" "uuid" NOT NULL,
    "nombre_completo" "text" NOT NULL,
    "correo" "text" NOT NULL,
    "telefono" "text",
    "rol" "public"."rol_cuenta" NOT NULL,
    "estado" "public"."estado_cuenta" NOT NULL,
    "avisos_correo" boolean DEFAULT true NOT NULL,
    "creada_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cuentas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documentos_legales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo" "public"."tipo_doc_legal" NOT NULL,
    "version" "text" NOT NULL,
    "referencia_contenido" "text" NOT NULL,
    "publicada_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."documentos_legales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."evidencias_privadas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "version_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "ruta_storage_privada" "text" NOT NULL,
    "aportada_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "retener_hasta" timestamp with time zone
);


ALTER TABLE "public"."evidencias_privadas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mensajes_texto" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversacion_id" "uuid" NOT NULL,
    "autor_id" "uuid" NOT NULL,
    "contenido" "text" NOT NULL,
    "enviado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "retener_hasta" timestamp with time zone
);


ALTER TABLE "public"."mensajes_texto" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notificaciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "destinatario_id" "uuid" NOT NULL,
    "evento" "public"."evento_noti" NOT NULL,
    "solicitud_contacto_id" "uuid",
    "revision_id" "uuid",
    "mensaje_id" "uuid",
    "solicitud_privacidad_id" "uuid",
    "creada_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "leida_en" timestamp with time zone,
    "estado_aviso_correo" "public"."estado_envio_correo" DEFAULT 'pendiente'::"public"."estado_envio_correo" NOT NULL
);


ALTER TABLE "public"."notificaciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orientaciones" (
    "solicitud_id" "uuid" NOT NULL,
    "area_id" "uuid",
    "tipo_caso_id" "uuid",
    "comentario_general" "text",
    "creada_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."orientaciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."perfil_area" (
    "perfil_id" "uuid" NOT NULL,
    "area_id" "uuid" NOT NULL
);


ALTER TABLE "public"."perfil_area" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."perfil_tipo_caso" (
    "perfil_id" "uuid" NOT NULL,
    "tipo_caso_id" "uuid" NOT NULL
);


ALTER TABLE "public"."perfil_tipo_caso" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."perfiles_abogados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cuenta_id" "uuid" NOT NULL,
    "nombre_profesional" "text" NOT NULL,
    "descripcion" "text" NOT NULL,
    "experiencia_anios" integer NOT NULL,
    "ciudad_atencion" "text" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "visibilidad" "public"."visibilidad_perfil" DEFAULT 'oculto'::"public"."visibilidad_perfil" NOT NULL,
    "version_aprobada_id" "uuid",
    "fecha_verificacion_vigente" timestamp with time zone,
    "alcance_verificacion_vigente" "text",
    "formacion_declarada" "text",
    "foto_publica" "text",
    "modalidad" "text",
    "horarios" "text",
    "tarifas_orientativas" "text",
    "medios_contacto" "jsonb",
    "campos_opcionales_publicos" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "motivo_suspension" "text",
    "suspendido_en" timestamp with time zone
);


ALTER TABLE "public"."perfiles_abogados" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."politica_revalidacion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "periodicidad_dias" integer NOT NULL,
    "vigente_desde" timestamp with time zone DEFAULT "now"() NOT NULL,
    "configurada_por" "uuid" NOT NULL
);


ALTER TABLE "public"."politica_revalidacion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."revisiones_profesionales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "version_id" "uuid" NOT NULL,
    "tipo" "public"."tipo_revision_prof" NOT NULL,
    "estado" "public"."estado_revision_prof" DEFAULT 'pendiente'::"public"."estado_revision_prof" NOT NULL,
    "programada_en" timestamp with time zone,
    "responsable_id" "uuid",
    "fuente_oficial" "text",
    "resultado_consulta" "text",
    "consultada_en" timestamp with time zone,
    "decision" "text",
    "motivo" "text",
    "alcance" "text",
    "decidida_en" timestamp with time zone,
    "proxima_revision" timestamp with time zone
);


ALTER TABLE "public"."revisiones_profesionales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."solicitudes_contacto" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ciudadano_id" "uuid" NOT NULL,
    "abogado_perfil_id" "uuid" NOT NULL,
    "tipo_caso_id" "uuid",
    "sin_clasificar" boolean NOT NULL,
    "clasificacion_al_enviar" "jsonb" NOT NULL,
    "descripcion_breve" "text" NOT NULL,
    "ayuda_buscada" "text" NOT NULL,
    "estado" "public"."estado_solicitud" DEFAULT 'pendiente'::"public"."estado_solicitud" NOT NULL,
    "enviada_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "decidida_en" timestamp with time zone,
    "cancelada_en" timestamp with time zone,
    "motivo_rechazo" "text",
    CONSTRAINT "check_clasificacion" CHECK (((("sin_clasificar" = true) AND ("tipo_caso_id" IS NULL)) OR (("sin_clasificar" = false) AND ("tipo_caso_id" IS NOT NULL))))
);


ALTER TABLE "public"."solicitudes_contacto" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."solicitudes_privacidad" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "titular_id" "uuid" NOT NULL,
    "tipo" "public"."tipo_peticion_priv" NOT NULL,
    "estado" "public"."estado_peticion_priv" DEFAULT 'pendiente'::"public"."estado_peticion_priv" NOT NULL,
    "solicitada_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "responsable_id" "uuid",
    "respuesta" "text",
    "resuelta_en" timestamp with time zone,
    "medidas_aplicadas" "text"
);


ALTER TABLE "public"."solicitudes_privacidad" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."termino_area" (
    "termino_id" "uuid" NOT NULL,
    "area_id" "uuid" NOT NULL
);


ALTER TABLE "public"."termino_area" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."termino_tipo_caso" (
    "termino_id" "uuid" NOT NULL,
    "tipo_caso_id" "uuid" NOT NULL
);


ALTER TABLE "public"."termino_tipo_caso" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."terminos_busqueda" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "texto" "text" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."terminos_busqueda" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tipos_caso" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre_cotidiano" "text" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."tipos_caso" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."versiones_profesionales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "perfil_id" "uuid" NOT NULL,
    "numero_version" integer NOT NULL,
    "identificacion_privada" "text" NOT NULL,
    "tarjeta_profesional" "text" NOT NULL,
    "estado_revision" "public"."estado_revision_prof" DEFAULT 'pendiente'::"public"."estado_revision_prof" NOT NULL,
    "presentada_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."versiones_profesionales" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vista_indicadores_catalogo" WITH ("security_invoker"='on') AS
 SELECT 'Área Jurídica'::"text" AS "categoria",
    "a"."nombre" AS "elemento",
    "a"."activa" AS "esta_activo",
    "count"(DISTINCT "pa"."perfil_id") AS "total_perfiles_ofrecen",
    "count"(DISTINCT "o"."solicitud_id") AS "total_solicitudes_orientadas"
   FROM (("public"."areas_juridicas" "a"
     LEFT JOIN "public"."perfil_area" "pa" ON (("a"."id" = "pa"."area_id")))
     LEFT JOIN "public"."orientaciones" "o" ON (("a"."id" = "o"."area_id")))
  GROUP BY "a"."nombre", "a"."activa"
UNION ALL
 SELECT 'Tipo de Caso'::"text" AS "categoria",
    "tc"."nombre_cotidiano" AS "elemento",
    "tc"."activo" AS "esta_activo",
    "count"(DISTINCT "ptc"."perfil_id") AS "total_perfiles_ofrecen",
    "count"(DISTINCT "sc"."id") AS "total_solicitudes_orientadas"
   FROM (("public"."tipos_caso" "tc"
     LEFT JOIN "public"."perfil_tipo_caso" "ptc" ON (("tc"."id" = "ptc"."tipo_caso_id")))
     LEFT JOIN "public"."solicitudes_contacto" "sc" ON (("tc"."id" = "sc"."tipo_caso_id")))
  GROUP BY "tc"."nombre_cotidiano", "tc"."activo";


ALTER VIEW "public"."vista_indicadores_catalogo" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vista_indicadores_cuentas" WITH ("security_invoker"='on') AS
 SELECT "rol",
    "estado",
    "count"(*) AS "total_cuentas"
   FROM "public"."cuentas"
  GROUP BY "rol", "estado"
  ORDER BY "rol", "estado";


ALTER VIEW "public"."vista_indicadores_cuentas" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vista_indicadores_perfiles" WITH ("security_invoker"='on') AS
 SELECT "visibilidad",
    "activo",
        CASE
            WHEN ("version_aprobada_id" IS NOT NULL) THEN 'verificado'::"text"
            ELSE 'sin_verificacion_aprobada'::"text"
        END AS "estado_verificacion",
    "count"(*) AS "total_perfiles"
   FROM "public"."perfiles_abogados"
  GROUP BY "visibilidad", "activo",
        CASE
            WHEN ("version_aprobada_id" IS NOT NULL) THEN 'verificado'::"text"
            ELSE 'sin_verificacion_aprobada'::"text"
        END;


ALTER VIEW "public"."vista_indicadores_perfiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vista_indicadores_solicitudes" WITH ("security_invoker"='on') AS
 SELECT "estado",
    "sin_clasificar",
    "count"(*) AS "total_solicitudes"
   FROM "public"."solicitudes_contacto"
  GROUP BY "estado", "sin_clasificar"
  ORDER BY ("count"(*)) DESC;


ALTER VIEW "public"."vista_indicadores_solicitudes" OWNER TO "postgres";


ALTER TABLE ONLY "public"."aceptaciones_legales"
    ADD CONSTRAINT "aceptaciones_legales_pkey" PRIMARY KEY ("cuenta_id", "documento_id");



ALTER TABLE ONLY "public"."altas_profesionales_diagnostico"
    ADD CONSTRAINT "altas_profesionales_diagnostico_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."areas_juridicas"
    ADD CONSTRAINT "areas_juridicas_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."areas_juridicas"
    ADD CONSTRAINT "areas_juridicas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."area_tipo_caso"
    ADD CONSTRAINT "at_pkey" PRIMARY KEY ("area_id", "tipo_caso_id");



ALTER TABLE ONLY "public"."avisos_correo_diagnostico"
    ADD CONSTRAINT "avisos_correo_diagnostico_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversaciones"
    ADD CONSTRAINT "conversaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversaciones"
    ADD CONSTRAINT "conversaciones_solicitud_id_key" UNIQUE ("solicitud_id");



ALTER TABLE ONLY "public"."cuentas"
    ADD CONSTRAINT "cuentas_correo_key" UNIQUE ("correo");



ALTER TABLE ONLY "public"."cuentas"
    ADD CONSTRAINT "cuentas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documentos_legales"
    ADD CONSTRAINT "documentos_legales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."evidencias_privadas"
    ADD CONSTRAINT "evidencias_privadas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mensajes_texto"
    ADD CONSTRAINT "mensajes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notificaciones"
    ADD CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orientaciones"
    ADD CONSTRAINT "orientaciones_pkey" PRIMARY KEY ("solicitud_id");



ALTER TABLE ONLY "public"."perfil_area"
    ADD CONSTRAINT "pa_pkey" PRIMARY KEY ("perfil_id", "area_id");



ALTER TABLE ONLY "public"."perfiles_abogados"
    ADD CONSTRAINT "perfiles_abogados_cuenta_id_key" UNIQUE ("cuenta_id");



ALTER TABLE ONLY "public"."perfiles_abogados"
    ADD CONSTRAINT "perfiles_abogados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."politica_revalidacion"
    ADD CONSTRAINT "pol_rev_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."perfil_tipo_caso"
    ADD CONSTRAINT "pt_pkey" PRIMARY KEY ("perfil_id", "tipo_caso_id");



ALTER TABLE ONLY "public"."revisiones_profesionales"
    ADD CONSTRAINT "revisiones_prof_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."solicitudes_contacto"
    ADD CONSTRAINT "sol_contacto_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."solicitudes_privacidad"
    ADD CONSTRAINT "solicitudes_privacidad_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."termino_area"
    ADD CONSTRAINT "ta_pkey" PRIMARY KEY ("termino_id", "area_id");



ALTER TABLE ONLY "public"."terminos_busqueda"
    ADD CONSTRAINT "terminos_busqueda_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."terminos_busqueda"
    ADD CONSTRAINT "terminos_busqueda_texto_key" UNIQUE ("texto");



ALTER TABLE ONLY "public"."tipos_caso"
    ADD CONSTRAINT "tipos_caso_nombre_cotidiano_key" UNIQUE ("nombre_cotidiano");



ALTER TABLE ONLY "public"."tipos_caso"
    ADD CONSTRAINT "tipos_caso_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."termino_tipo_caso"
    ADD CONSTRAINT "tt_pkey" PRIMARY KEY ("termino_id", "tipo_caso_id");



ALTER TABLE ONLY "public"."versiones_profesionales"
    ADD CONSTRAINT "uq_perfil_id" UNIQUE ("perfil_id", "id");



ALTER TABLE ONLY "public"."versiones_profesionales"
    ADD CONSTRAINT "uq_perfil_version" UNIQUE ("perfil_id", "numero_version");



ALTER TABLE ONLY "public"."documentos_legales"
    ADD CONSTRAINT "uq_tipo_version" UNIQUE ("tipo", "version");



ALTER TABLE ONLY "public"."versiones_profesionales"
    ADD CONSTRAINT "versiones_profesionales_pkey" PRIMARY KEY ("id");



CREATE INDEX "altas_prof_diag_cuenta_idx" ON "public"."altas_profesionales_diagnostico" USING "btree" ("cuenta_id", "creada_en" DESC);



CREATE INDEX "avisos_correo_diag_notificacion_idx" ON "public"."avisos_correo_diagnostico" USING "btree" ("notificacion_id", "creado_en" DESC);



CREATE OR REPLACE TRIGGER "proteger_cuenta_campos" BEFORE INSERT OR UPDATE ON "public"."cuentas" FOR EACH ROW EXECUTE FUNCTION "private"."proteger_cuenta"();



CREATE OR REPLACE TRIGGER "proteger_perfil_campos" BEFORE INSERT OR UPDATE ON "public"."perfiles_abogados" FOR EACH ROW EXECUTE FUNCTION "private"."proteger_perfil"();



CREATE OR REPLACE TRIGGER "trg_al_cambiar_estado_solicitud" AFTER INSERT OR UPDATE OF "estado" ON "public"."solicitudes_contacto" FOR EACH ROW EXECUTE FUNCTION "public"."al_cambiar_estado_solicitud"();



CREATE OR REPLACE TRIGGER "trg_notificar_evento_solicitud" AFTER INSERT OR UPDATE OF "estado" ON "public"."solicitudes_contacto" FOR EACH ROW EXECUTE FUNCTION "public"."notificar_evento_solicitud"();



CREATE OR REPLACE TRIGGER "trg_notificar_mensaje_nuevo" AFTER INSERT ON "public"."mensajes_texto" FOR EACH ROW EXECUTE FUNCTION "public"."notificar_mensaje_nuevo"();



CREATE OR REPLACE TRIGGER "trg_notificar_resolucion_privacidad" AFTER UPDATE ON "public"."solicitudes_privacidad" FOR EACH ROW EXECUTE FUNCTION "public"."notificar_resolucion_privacidad"();



CREATE OR REPLACE TRIGGER "trg_notificar_suspension_perfil" AFTER UPDATE OF "visibilidad" ON "public"."perfiles_abogados" FOR EACH ROW EXECUTE FUNCTION "public"."notificar_suspension_perfil"();



CREATE OR REPLACE TRIGGER "trg_procesar_revision_profesional" AFTER INSERT OR UPDATE ON "public"."revisiones_profesionales" FOR EACH ROW EXECUTE FUNCTION "public"."procesar_revision_profesional"();



CREATE OR REPLACE TRIGGER "trg_validar_creacion_conversacion" BEFORE INSERT ON "public"."conversaciones" FOR EACH ROW EXECUTE FUNCTION "public"."validar_creacion_conversacion"();



CREATE OR REPLACE TRIGGER "trg_validar_emisor_mensaje" BEFORE INSERT ON "public"."mensajes_texto" FOR EACH ROW EXECUTE FUNCTION "public"."validar_emisor_mensaje"();



CREATE OR REPLACE TRIGGER "trigger_enviar_correo" AFTER INSERT ON "public"."notificaciones" FOR EACH ROW EXECUTE FUNCTION "public"."enviar_aviso_correo"();



CREATE OR REPLACE TRIGGER "validar_evidencia_presentada" BEFORE INSERT ON "public"."evidencias_privadas" FOR EACH ROW EXECUTE FUNCTION "private"."validar_evidencia_presentada"();



CREATE OR REPLACE TRIGGER "validar_version_presentada" BEFORE INSERT ON "public"."versiones_profesionales" FOR EACH ROW EXECUTE FUNCTION "private"."validar_version_presentada"();



ALTER TABLE ONLY "public"."aceptaciones_legales"
    ADD CONSTRAINT "aceptaciones_legales_cuenta_fk" FOREIGN KEY ("cuenta_id") REFERENCES "public"."cuentas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."aceptaciones_legales"
    ADD CONSTRAINT "aceptaciones_legales_doc_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos_legales"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."area_tipo_caso"
    ADD CONSTRAINT "at_area_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas_juridicas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."area_tipo_caso"
    ADD CONSTRAINT "at_tipo_fk" FOREIGN KEY ("tipo_caso_id") REFERENCES "public"."tipos_caso"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversaciones"
    ADD CONSTRAINT "chat_sol_fk" FOREIGN KEY ("solicitud_id") REFERENCES "public"."solicitudes_contacto"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cuentas"
    ADD CONSTRAINT "cuentas_auth_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."evidencias_privadas"
    ADD CONSTRAINT "evid_version_fk" FOREIGN KEY ("version_id") REFERENCES "public"."versiones_profesionales"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mensajes_texto"
    ADD CONSTRAINT "msg_autor_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."cuentas"("id");



ALTER TABLE ONLY "public"."mensajes_texto"
    ADD CONSTRAINT "msg_chat_fk" FOREIGN KEY ("conversacion_id") REFERENCES "public"."conversaciones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notificaciones"
    ADD CONSTRAINT "noti_dest_fk" FOREIGN KEY ("destinatario_id") REFERENCES "public"."cuentas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notificaciones"
    ADD CONSTRAINT "noti_msg_fk" FOREIGN KEY ("mensaje_id") REFERENCES "public"."mensajes_texto"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notificaciones"
    ADD CONSTRAINT "noti_priv_fk" FOREIGN KEY ("solicitud_privacidad_id") REFERENCES "public"."solicitudes_privacidad"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notificaciones"
    ADD CONSTRAINT "noti_rev_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."revisiones_profesionales"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notificaciones"
    ADD CONSTRAINT "noti_sol_fk" FOREIGN KEY ("solicitud_contacto_id") REFERENCES "public"."solicitudes_contacto"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orientaciones"
    ADD CONSTRAINT "ori_area_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas_juridicas"("id");



ALTER TABLE ONLY "public"."orientaciones"
    ADD CONSTRAINT "ori_sol_fk" FOREIGN KEY ("solicitud_id") REFERENCES "public"."solicitudes_contacto"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orientaciones"
    ADD CONSTRAINT "ori_tipo_fk" FOREIGN KEY ("tipo_caso_id") REFERENCES "public"."tipos_caso"("id");



ALTER TABLE ONLY "public"."perfil_area"
    ADD CONSTRAINT "pa_area_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas_juridicas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."perfil_area"
    ADD CONSTRAINT "pa_perfil_fk" FOREIGN KEY ("perfil_id") REFERENCES "public"."perfiles_abogados"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."perfiles_abogados"
    ADD CONSTRAINT "perfil_cuenta_fk" FOREIGN KEY ("cuenta_id") REFERENCES "public"."cuentas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."perfiles_abogados"
    ADD CONSTRAINT "perfil_version_aprobada_fk" FOREIGN KEY ("id", "version_aprobada_id") REFERENCES "public"."versiones_profesionales"("perfil_id", "id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."politica_revalidacion"
    ADD CONSTRAINT "pol_rev_config_fk" FOREIGN KEY ("configurada_por") REFERENCES "public"."cuentas"("id");



ALTER TABLE ONLY "public"."perfil_tipo_caso"
    ADD CONSTRAINT "pt_perfil_fk" FOREIGN KEY ("perfil_id") REFERENCES "public"."perfiles_abogados"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."perfil_tipo_caso"
    ADD CONSTRAINT "pt_tipo_fk" FOREIGN KEY ("tipo_caso_id") REFERENCES "public"."tipos_caso"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."revisiones_profesionales"
    ADD CONSTRAINT "rev_responsable_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."cuentas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."revisiones_profesionales"
    ADD CONSTRAINT "rev_version_fk" FOREIGN KEY ("version_id") REFERENCES "public"."versiones_profesionales"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."solicitudes_contacto"
    ADD CONSTRAINT "sol_abo_fk" FOREIGN KEY ("abogado_perfil_id") REFERENCES "public"."perfiles_abogados"("id");



ALTER TABLE ONLY "public"."solicitudes_contacto"
    ADD CONSTRAINT "sol_ciu_fk" FOREIGN KEY ("ciudadano_id") REFERENCES "public"."cuentas"("id");



ALTER TABLE ONLY "public"."solicitudes_privacidad"
    ADD CONSTRAINT "sol_priv_responsable_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."cuentas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."solicitudes_privacidad"
    ADD CONSTRAINT "sol_priv_titular_fk" FOREIGN KEY ("titular_id") REFERENCES "public"."cuentas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."solicitudes_contacto"
    ADD CONSTRAINT "sol_tipo_fk" FOREIGN KEY ("tipo_caso_id") REFERENCES "public"."tipos_caso"("id");



ALTER TABLE ONLY "public"."termino_area"
    ADD CONSTRAINT "ta_area_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas_juridicas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."termino_area"
    ADD CONSTRAINT "ta_term_fk" FOREIGN KEY ("termino_id") REFERENCES "public"."terminos_busqueda"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."termino_tipo_caso"
    ADD CONSTRAINT "tt_term_fk" FOREIGN KEY ("termino_id") REFERENCES "public"."terminos_busqueda"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."termino_tipo_caso"
    ADD CONSTRAINT "tt_tipo_fk" FOREIGN KEY ("tipo_caso_id") REFERENCES "public"."tipos_caso"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."versiones_profesionales"
    ADD CONSTRAINT "vers_prof_perfil_fk" FOREIGN KEY ("perfil_id") REFERENCES "public"."perfiles_abogados"("id") ON DELETE CASCADE;



CREATE POLICY "Abogados insertan/actualizan orientaciones" ON "public"."orientaciones" USING ("public"."es_participante_solicitud"("solicitud_id"));



CREATE POLICY "Actualizar cuentas propias o todas si es admin" ON "public"."cuentas" FOR UPDATE USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."es_admin"())) WITH CHECK ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."es_admin"()));



CREATE POLICY "Actualizar notificaciones propias o admin" ON "public"."notificaciones" FOR UPDATE USING ((("destinatario_id" = "auth"."uid"()) OR "public"."es_admin"()));



CREATE POLICY "Admins actualizan solicitudes privacidad" ON "public"."solicitudes_privacidad" FOR UPDATE USING ("public"."es_admin"());



CREATE POLICY "Admins actualizan versiones" ON "public"."versiones_profesionales" FOR UPDATE USING ("public"."es_admin"());



CREATE POLICY "Admins gestionan areas" ON "public"."areas_juridicas" USING ("public"."es_admin"());



CREATE POLICY "Admins gestionan documentos legales" ON "public"."documentos_legales" USING ("public"."es_admin"());



CREATE POLICY "Admins gestionan politica revalidacion" ON "public"."politica_revalidacion" USING ("public"."es_admin"());



CREATE POLICY "Admins gestionan relacion area_caso" ON "public"."area_tipo_caso" USING ("public"."es_admin"());



CREATE POLICY "Admins gestionan revisiones" ON "public"."revisiones_profesionales" USING ("public"."es_admin"());



CREATE POLICY "Admins gestionan termino_area" ON "public"."termino_area" USING ("public"."es_admin"());



CREATE POLICY "Admins gestionan termino_tipo_caso" ON "public"."termino_tipo_caso" USING ("public"."es_admin"());



CREATE POLICY "Admins gestionan terminos" ON "public"."terminos_busqueda" USING ("public"."es_admin"());



CREATE POLICY "Admins gestionan tipos caso" ON "public"."tipos_caso" USING ("public"."es_admin"());



CREATE POLICY "Admins leen el diagnostico de altas" ON "public"."altas_profesionales_diagnostico" FOR SELECT USING ("public"."es_admin"());



CREATE POLICY "Admins leen el diagnostico de avisos" ON "public"."avisos_correo_diagnostico" FOR SELECT USING ("public"."es_admin"());



CREATE POLICY "Autores insertan sus mensajes" ON "public"."mensajes_texto" FOR INSERT WITH CHECK ((("autor_id" = "auth"."uid"()) AND "public"."es_participante_solicitud"(( SELECT "conversaciones"."solicitud_id"
   FROM "public"."conversaciones"
  WHERE ("conversaciones"."id" = "mensajes_texto"."conversacion_id")))));



CREATE POLICY "Ciudadanos insertan sus solicitudes" ON "public"."solicitudes_contacto" FOR INSERT WITH CHECK (("ciudadano_id" = "auth"."uid"()));



CREATE POLICY "Dueños insertan evidencias" ON "public"."evidencias_privadas" FOR INSERT WITH CHECK ("public"."es_dueno_perfil"(( SELECT "versiones_profesionales"."perfil_id"
   FROM "public"."versiones_profesionales"
  WHERE ("versiones_profesionales"."id" = "evidencias_privadas"."version_id"))));



CREATE POLICY "Dueños insertan sus perfiles" ON "public"."perfiles_abogados" FOR INSERT WITH CHECK (("cuenta_id" = "auth"."uid"()));



CREATE POLICY "Dueños insertan versiones" ON "public"."versiones_profesionales" FOR INSERT WITH CHECK ("public"."es_dueno_perfil"("perfil_id"));



CREATE POLICY "Dueños o admins gestionan perfil_area" ON "public"."perfil_area" USING (("public"."es_dueno_perfil"("perfil_id") OR "public"."es_admin"()));



CREATE POLICY "Dueños o admins gestionan perfil_tipo_caso" ON "public"."perfil_tipo_caso" USING (("public"."es_dueno_perfil"("perfil_id") OR "public"."es_admin"()));



CREATE POLICY "Dueños y admins actualizan perfiles" ON "public"."perfiles_abogados" FOR UPDATE USING ((("cuenta_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."es_admin"())) WITH CHECK ((("cuenta_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."es_admin"()));



CREATE POLICY "Lectura publica catalogo" ON "public"."areas_juridicas" FOR SELECT USING (true);



CREATE POLICY "Lectura publica perfil_area" ON "public"."perfil_area" FOR SELECT USING (true);



CREATE POLICY "Lectura publica perfil_tipo_caso" ON "public"."perfil_tipo_caso" FOR SELECT USING (true);



CREATE POLICY "Lectura publica relacion area_caso" ON "public"."area_tipo_caso" FOR SELECT USING (true);



CREATE POLICY "Lectura publica termino_area" ON "public"."termino_area" FOR SELECT USING (true);



CREATE POLICY "Lectura publica termino_tipo_caso" ON "public"."termino_tipo_caso" FOR SELECT USING (true);



CREATE POLICY "Lectura publica terminos" ON "public"."terminos_busqueda" FOR SELECT USING (true);



CREATE POLICY "Lectura publica tipos caso" ON "public"."tipos_caso" FOR SELECT USING (true);



CREATE POLICY "Lectura pública de documentos legales" ON "public"."documentos_legales" FOR SELECT USING (true);



CREATE POLICY "Participantes o admins actualizan solicitudes" ON "public"."solicitudes_contacto" FOR UPDATE USING ((("ciudadano_id" = "auth"."uid"()) OR "public"."es_dueno_perfil"("abogado_perfil_id") OR "public"."es_admin"()));



CREATE POLICY "Usuarios crean sus solicitudes privacidad" ON "public"."solicitudes_privacidad" FOR INSERT WITH CHECK (("titular_id" = "auth"."uid"()));



CREATE POLICY "Usuarios insertan sus aceptaciones" ON "public"."aceptaciones_legales" FOR INSERT WITH CHECK (("cuenta_id" = "auth"."uid"()));



CREATE POLICY "Ver aceptaciones propias o todas si es admin" ON "public"."aceptaciones_legales" FOR SELECT USING ((("cuenta_id" = "auth"."uid"()) OR "public"."es_admin"()));



CREATE POLICY "Ver conversaciones como participante o admin" ON "public"."conversaciones" FOR SELECT USING (("public"."es_participante_solicitud"("solicitud_id") OR "public"."es_admin"()));



CREATE POLICY "Ver cuentas propias o todas si es admin" ON "public"."cuentas" FOR SELECT USING ((("id" = "auth"."uid"()) OR "public"."es_admin"()));



CREATE POLICY "Ver evidencias propias o admin" ON "public"."evidencias_privadas" FOR SELECT USING (("public"."es_dueno_perfil"(( SELECT "versiones_profesionales"."perfil_id"
   FROM "public"."versiones_profesionales"
  WHERE ("versiones_profesionales"."id" = "evidencias_privadas"."version_id"))) OR "public"."es_admin"()));



CREATE POLICY "Ver mensajes como participante o admin" ON "public"."mensajes_texto" FOR SELECT USING (("public"."es_participante_solicitud"(( SELECT "conversaciones"."solicitud_id"
   FROM "public"."conversaciones"
  WHERE ("conversaciones"."id" = "mensajes_texto"."conversacion_id"))) OR "public"."es_admin"()));



CREATE POLICY "Ver notificaciones propias o admin" ON "public"."notificaciones" FOR SELECT USING ((("destinatario_id" = "auth"."uid"()) OR "public"."es_admin"()));



CREATE POLICY "Ver orientaciones como participante o admin" ON "public"."orientaciones" FOR SELECT USING (("public"."es_participante_solicitud"("solicitud_id") OR "public"."es_admin"()));



CREATE POLICY "Ver perfiles publicos, propios o admin" ON "public"."perfiles_abogados" FOR SELECT TO "authenticated" USING ((("cuenta_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."es_admin"()));



CREATE POLICY "Ver revisiones propias o admin" ON "public"."revisiones_profesionales" FOR SELECT USING (("public"."es_dueno_perfil"(( SELECT "versiones_profesionales"."perfil_id"
   FROM "public"."versiones_profesionales"
  WHERE ("versiones_profesionales"."id" = "revisiones_profesionales"."version_id"))) OR "public"."es_admin"()));



CREATE POLICY "Ver solicitudes como participante o admin" ON "public"."solicitudes_contacto" FOR SELECT USING ((("ciudadano_id" = "auth"."uid"()) OR "public"."es_dueno_perfil"("abogado_perfil_id") OR "public"."es_admin"()));



CREATE POLICY "Ver solicitudes privacidad propias o admin" ON "public"."solicitudes_privacidad" FOR SELECT USING ((("titular_id" = "auth"."uid"()) OR "public"."es_admin"()));



CREATE POLICY "Ver versiones profesionales propias o admin" ON "public"."versiones_profesionales" FOR SELECT USING (("public"."es_dueno_perfil"("perfil_id") OR "public"."es_admin"()));



ALTER TABLE "public"."aceptaciones_legales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."altas_profesionales_diagnostico" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."area_tipo_caso" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."areas_juridicas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."avisos_correo_diagnostico" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversaciones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cuentas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."documentos_legales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."evidencias_privadas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mensajes_texto" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notificaciones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orientaciones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."perfil_area" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."perfil_tipo_caso" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."perfiles_abogados" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."politica_revalidacion" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."revisiones_profesionales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."solicitudes_contacto" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."solicitudes_privacidad" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."termino_area" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."termino_tipo_caso" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."terminos_busqueda" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tipos_caso" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."versiones_profesionales" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."mensajes_texto";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notificaciones";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






GRANT USAGE ON SCHEMA "private" TO "anon";
GRANT USAGE ON SCHEMA "private" TO "authenticated";

















































































































































































REVOKE ALL ON FUNCTION "private"."fotografia_publicable"("p_ruta" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."fotografia_publicable"("p_ruta" "text") TO "anon";
GRANT ALL ON FUNCTION "private"."fotografia_publicable"("p_ruta" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."fotografia_registrada"("p_ruta" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."fotografia_registrada"("p_ruta" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."proteger_cuenta"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."proteger_perfil"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."validar_evidencia_presentada"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."validar_version_presentada"() FROM PUBLIC;



GRANT ALL ON FUNCTION "public"."al_cambiar_estado_solicitud"() TO "anon";
GRANT ALL ON FUNCTION "public"."al_cambiar_estado_solicitud"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."al_cambiar_estado_solicitud"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."buscar_abogados"("p_busqueda" "text", "p_areas" "uuid"[], "p_tipos_caso" "uuid"[], "p_ciudad" "text", "p_perfil_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."buscar_abogados"("p_busqueda" "text", "p_areas" "uuid"[], "p_tipos_caso" "uuid"[], "p_ciudad" "text", "p_perfil_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."buscar_abogados"("p_busqueda" "text", "p_areas" "uuid"[], "p_tipos_caso" "uuid"[], "p_ciudad" "text", "p_perfil_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."buscar_abogados"("p_busqueda" "text", "p_areas" "uuid"[], "p_tipos_caso" "uuid"[], "p_ciudad" "text", "p_perfil_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."cambiar_estado_solicitud"("p_solicitud_id" "uuid", "p_nuevo_estado" "public"."estado_solicitud", "p_motivo_rechazo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cambiar_estado_solicitud"("p_solicitud_id" "uuid", "p_nuevo_estado" "public"."estado_solicitud", "p_motivo_rechazo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cambiar_estado_solicitud"("p_solicitud_id" "uuid", "p_nuevo_estado" "public"."estado_solicitud", "p_motivo_rechazo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."crear_perfil_profesional_desde_metadatos"("p_cuenta_id" "uuid", "p_perfil" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."crear_perfil_profesional_desde_metadatos"("p_cuenta_id" "uuid", "p_perfil" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ejecutar_revalidacion_periodica"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ejecutar_revalidacion_periodica"() TO "service_role";
GRANT ALL ON FUNCTION "public"."ejecutar_revalidacion_periodica"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."enviar_aviso_correo"() TO "anon";
GRANT ALL ON FUNCTION "public"."enviar_aviso_correo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enviar_aviso_correo"() TO "service_role";



GRANT ALL ON FUNCTION "public"."es_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."es_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."es_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."es_dueno_perfil"("p_perfil_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."es_dueno_perfil"("p_perfil_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."es_dueno_perfil"("p_perfil_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."es_participante_solicitud"("p_solicitud_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."es_participante_solicitud"("p_solicitud_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."es_participante_solicitud"("p_solicitud_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."guardar_datos_practica"("p_perfil_id" "uuid", "p_datos" "jsonb", "p_areas" "uuid"[], "p_tipos" "uuid"[], "p_foto_ruta" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guardar_datos_practica"("p_perfil_id" "uuid", "p_datos" "jsonb", "p_areas" "uuid"[], "p_tipos" "uuid"[], "p_foto_ruta" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."guardar_datos_practica"("p_perfil_id" "uuid", "p_datos" "jsonb", "p_areas" "uuid"[], "p_tipos" "uuid"[], "p_foto_ruta" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."iniciar_revision_profesional"("p_version_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."iniciar_revision_profesional"("p_version_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."iniciar_revision_profesional"("p_version_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."nombres_abogados_participantes"("p_perfiles" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."nombres_abogados_participantes"("p_perfiles" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."nombres_abogados_participantes"("p_perfiles" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."notificar_evento_solicitud"() TO "anon";
GRANT ALL ON FUNCTION "public"."notificar_evento_solicitud"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notificar_evento_solicitud"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notificar_mensaje_nuevo"() TO "anon";
GRANT ALL ON FUNCTION "public"."notificar_mensaje_nuevo"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notificar_mensaje_nuevo"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notificar_resolucion_privacidad"() TO "anon";
GRANT ALL ON FUNCTION "public"."notificar_resolucion_privacidad"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notificar_resolucion_privacidad"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notificar_suspension_perfil"() TO "anon";
GRANT ALL ON FUNCTION "public"."notificar_suspension_perfil"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notificar_suspension_perfil"() TO "service_role";



GRANT ALL ON FUNCTION "public"."perfil_texto"("p_perfil" "jsonb", VARIADIC "p_claves" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."perfil_texto"("p_perfil" "jsonb", VARIADIC "p_claves" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."perfil_texto"("p_perfil" "jsonb", VARIADIC "p_claves" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."preparar_version_profesional"("p_perfil_id" "uuid", "p_tarjeta" "text", "p_identificacion" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."preparar_version_profesional"("p_perfil_id" "uuid", "p_tarjeta" "text", "p_identificacion" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."preparar_version_profesional"("p_perfil_id" "uuid", "p_tarjeta" "text", "p_identificacion" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."procesar_revision_profesional"() TO "anon";
GRANT ALL ON FUNCTION "public"."procesar_revision_profesional"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."procesar_revision_profesional"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."recuperar_perfil_profesional"("p_perfil" "jsonb", "p_documentos" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recuperar_perfil_profesional"("p_perfil" "jsonb", "p_documentos" "uuid"[]) TO "service_role";
GRANT ALL ON FUNCTION "public"."recuperar_perfil_profesional"("p_perfil" "jsonb", "p_documentos" "uuid"[]) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."registrar_evidencia_profesional"("p_version_id" "uuid", "p_ruta" "text", "p_tipo" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."registrar_evidencia_profesional"("p_version_id" "uuid", "p_ruta" "text", "p_tipo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."registrar_evidencia_profesional"("p_version_id" "uuid", "p_ruta" "text", "p_tipo" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ruta_fotografia_publicable"("p_perfil_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ruta_fotografia_publicable"("p_perfil_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ruta_fotografia_publicable"("p_perfil_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ruta_fotografia_publicable"("p_perfil_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."validar_creacion_conversacion"() TO "anon";
GRANT ALL ON FUNCTION "public"."validar_creacion_conversacion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validar_creacion_conversacion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validar_emisor_mensaje"() TO "anon";
GRANT ALL ON FUNCTION "public"."validar_emisor_mensaje"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validar_emisor_mensaje"() TO "service_role";
























GRANT ALL ON TABLE "public"."aceptaciones_legales" TO "anon";
GRANT ALL ON TABLE "public"."aceptaciones_legales" TO "authenticated";
GRANT ALL ON TABLE "public"."aceptaciones_legales" TO "service_role";



GRANT ALL ON TABLE "public"."altas_profesionales_diagnostico" TO "anon";
GRANT ALL ON TABLE "public"."altas_profesionales_diagnostico" TO "authenticated";
GRANT ALL ON TABLE "public"."altas_profesionales_diagnostico" TO "service_role";



GRANT ALL ON TABLE "public"."area_tipo_caso" TO "anon";
GRANT ALL ON TABLE "public"."area_tipo_caso" TO "authenticated";
GRANT ALL ON TABLE "public"."area_tipo_caso" TO "service_role";



GRANT ALL ON TABLE "public"."areas_juridicas" TO "anon";
GRANT ALL ON TABLE "public"."areas_juridicas" TO "authenticated";
GRANT ALL ON TABLE "public"."areas_juridicas" TO "service_role";



GRANT ALL ON TABLE "public"."avisos_correo_diagnostico" TO "anon";
GRANT ALL ON TABLE "public"."avisos_correo_diagnostico" TO "authenticated";
GRANT ALL ON TABLE "public"."avisos_correo_diagnostico" TO "service_role";



GRANT ALL ON TABLE "public"."conversaciones" TO "anon";
GRANT ALL ON TABLE "public"."conversaciones" TO "authenticated";
GRANT ALL ON TABLE "public"."conversaciones" TO "service_role";



GRANT ALL ON TABLE "public"."cuentas" TO "anon";
GRANT ALL ON TABLE "public"."cuentas" TO "authenticated";
GRANT ALL ON TABLE "public"."cuentas" TO "service_role";



GRANT ALL ON TABLE "public"."documentos_legales" TO "anon";
GRANT ALL ON TABLE "public"."documentos_legales" TO "authenticated";
GRANT ALL ON TABLE "public"."documentos_legales" TO "service_role";



GRANT ALL ON TABLE "public"."evidencias_privadas" TO "anon";
GRANT ALL ON TABLE "public"."evidencias_privadas" TO "authenticated";
GRANT ALL ON TABLE "public"."evidencias_privadas" TO "service_role";



GRANT ALL ON TABLE "public"."mensajes_texto" TO "anon";
GRANT ALL ON TABLE "public"."mensajes_texto" TO "authenticated";
GRANT ALL ON TABLE "public"."mensajes_texto" TO "service_role";



GRANT ALL ON TABLE "public"."notificaciones" TO "anon";
GRANT ALL ON TABLE "public"."notificaciones" TO "authenticated";
GRANT ALL ON TABLE "public"."notificaciones" TO "service_role";



GRANT ALL ON TABLE "public"."orientaciones" TO "anon";
GRANT ALL ON TABLE "public"."orientaciones" TO "authenticated";
GRANT ALL ON TABLE "public"."orientaciones" TO "service_role";



GRANT ALL ON TABLE "public"."perfil_area" TO "anon";
GRANT ALL ON TABLE "public"."perfil_area" TO "authenticated";
GRANT ALL ON TABLE "public"."perfil_area" TO "service_role";



GRANT ALL ON TABLE "public"."perfil_tipo_caso" TO "anon";
GRANT ALL ON TABLE "public"."perfil_tipo_caso" TO "authenticated";
GRANT ALL ON TABLE "public"."perfil_tipo_caso" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."perfiles_abogados" TO "anon";
GRANT ALL ON TABLE "public"."perfiles_abogados" TO "authenticated";
GRANT ALL ON TABLE "public"."perfiles_abogados" TO "service_role";



GRANT ALL ON TABLE "public"."politica_revalidacion" TO "anon";
GRANT ALL ON TABLE "public"."politica_revalidacion" TO "authenticated";
GRANT ALL ON TABLE "public"."politica_revalidacion" TO "service_role";



GRANT ALL ON TABLE "public"."revisiones_profesionales" TO "anon";
GRANT ALL ON TABLE "public"."revisiones_profesionales" TO "authenticated";
GRANT ALL ON TABLE "public"."revisiones_profesionales" TO "service_role";



GRANT ALL ON TABLE "public"."solicitudes_contacto" TO "anon";
GRANT ALL ON TABLE "public"."solicitudes_contacto" TO "authenticated";
GRANT ALL ON TABLE "public"."solicitudes_contacto" TO "service_role";



GRANT ALL ON TABLE "public"."solicitudes_privacidad" TO "anon";
GRANT ALL ON TABLE "public"."solicitudes_privacidad" TO "authenticated";
GRANT ALL ON TABLE "public"."solicitudes_privacidad" TO "service_role";



GRANT ALL ON TABLE "public"."termino_area" TO "anon";
GRANT ALL ON TABLE "public"."termino_area" TO "authenticated";
GRANT ALL ON TABLE "public"."termino_area" TO "service_role";



GRANT ALL ON TABLE "public"."termino_tipo_caso" TO "anon";
GRANT ALL ON TABLE "public"."termino_tipo_caso" TO "authenticated";
GRANT ALL ON TABLE "public"."termino_tipo_caso" TO "service_role";



GRANT ALL ON TABLE "public"."terminos_busqueda" TO "anon";
GRANT ALL ON TABLE "public"."terminos_busqueda" TO "authenticated";
GRANT ALL ON TABLE "public"."terminos_busqueda" TO "service_role";



GRANT ALL ON TABLE "public"."tipos_caso" TO "anon";
GRANT ALL ON TABLE "public"."tipos_caso" TO "authenticated";
GRANT ALL ON TABLE "public"."tipos_caso" TO "service_role";



GRANT ALL ON TABLE "public"."versiones_profesionales" TO "anon";
GRANT ALL ON TABLE "public"."versiones_profesionales" TO "authenticated";
GRANT ALL ON TABLE "public"."versiones_profesionales" TO "service_role";



GRANT ALL ON TABLE "public"."vista_indicadores_catalogo" TO "anon";
GRANT ALL ON TABLE "public"."vista_indicadores_catalogo" TO "authenticated";
GRANT ALL ON TABLE "public"."vista_indicadores_catalogo" TO "service_role";



GRANT ALL ON TABLE "public"."vista_indicadores_cuentas" TO "anon";
GRANT ALL ON TABLE "public"."vista_indicadores_cuentas" TO "authenticated";
GRANT ALL ON TABLE "public"."vista_indicadores_cuentas" TO "service_role";



GRANT ALL ON TABLE "public"."vista_indicadores_perfiles" TO "anon";
GRANT ALL ON TABLE "public"."vista_indicadores_perfiles" TO "authenticated";
GRANT ALL ON TABLE "public"."vista_indicadores_perfiles" TO "service_role";



GRANT ALL ON TABLE "public"."vista_indicadores_solicitudes" TO "anon";
GRANT ALL ON TABLE "public"."vista_indicadores_solicitudes" TO "authenticated";
GRANT ALL ON TABLE "public"."vista_indicadores_solicitudes" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
































SET LOCAL search_path = public, pg_temp;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE POLICY "evidencias_delete_own" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'evidencias-privadas'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "evidencias_insert_own" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'evidencias-privadas'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text) AND (EXISTS ( SELECT 1
   FROM cuentas c
  WHERE ((c.id = auth.uid()) AND (c.rol = 'abogado'::rol_cuenta))))));
CREATE POLICY "evidencias_registradas_inmutables_delete" ON "storage"."objects" AS RESTRICTIVE FOR DELETE TO "authenticated" USING (((bucket_id <> 'evidencias-privadas'::text) OR (NOT (EXISTS ( SELECT 1
   FROM evidencias_privadas e
  WHERE (e.ruta_storage_privada = objects.name))))));
CREATE POLICY "evidencias_registradas_inmutables_update" ON "storage"."objects" AS RESTRICTIVE FOR UPDATE TO "authenticated" USING (((bucket_id <> 'evidencias-privadas'::text) OR (NOT (EXISTS ( SELECT 1
   FROM evidencias_privadas e
  WHERE (e.ruta_storage_privada = objects.name))))));
CREATE POLICY "evidencias_select_own_or_admin" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'evidencias-privadas'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR es_admin())));
CREATE POLICY "evidencias_update_own" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'evidencias-privadas'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "perfiles_publicos_delete_own" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'perfiles-publicos'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (NOT private.fotografia_registrada(name))));
CREATE POLICY "perfiles_publicos_insert_own" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'perfiles-publicos'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (EXISTS ( SELECT 1
   FROM cuentas c
  WHERE ((c.id = ( SELECT auth.uid() AS uid)) AND (c.rol = 'abogado'::rol_cuenta) AND (c.estado = 'activa'::estado_cuenta))))));
CREATE POLICY "perfiles_publicos_lectura" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (((bucket_id = 'perfiles-publicos'::text) AND (((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) OR es_admin() OR private.fotografia_publicable(name))));


SELECT cron.schedule('revalidacion_diaria_perfiles','0 0 * * *','SELECT public.ejecutar_revalidacion_periodica();');
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='revalidacion_diaria_perfiles'),active := false);
ALTER FUNCTION public.al_cambiar_estado_solicitud() SET search_path = public, pg_temp;
ALTER FUNCTION public.procesar_revision_profesional() SET search_path = public, pg_temp;
