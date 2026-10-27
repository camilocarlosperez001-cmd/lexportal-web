-- ==============================================================================
-- DIAGNÓSTICO OBSERVABLE DEL ALTA PROFESIONAL
-- ==============================================================================
-- Motivo: el trigger `handle_new_user` puede salir por un RETURN anticipado cuando
-- faltan datos, y ese caso no dejaba rastro (la cuenta y las aceptaciones sí se
-- creaban, pero el perfil no). Ahora:
--   1. la creación del perfil vive en una función con resultado explícito;
--   2. cada alta profesional registra su resultado en una tabla de diagnóstico;
--   3. el trigger emite un WARNING con el resultado, visible en los logs de Postgres.
-- La función es idempotente, así que también sirve para reprocesar altas anteriores.

CREATE TABLE IF NOT EXISTS public.altas_profesionales_diagnostico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_id uuid NOT NULL,
  creada_en timestamptz NOT NULL DEFAULT now(),
  resultado text NOT NULL,
  detalle jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.altas_profesionales_diagnostico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins leen el diagnostico de altas" ON public.altas_profesionales_diagnostico;
CREATE POLICY "Admins leen el diagnostico de altas"
ON public.altas_profesionales_diagnostico FOR SELECT
USING (public.es_admin());

CREATE INDEX IF NOT EXISTS altas_prof_diag_cuenta_idx
  ON public.altas_profesionales_diagnostico (cuenta_id, creada_en DESC);

-- ==============================================================================
-- CREACIÓN DEL PERFIL A PARTIR DE LOS METADATOS
-- ==============================================================================
-- Devuelve un resultado legible:
--   sin_cuenta | sin_metadatos_perfil | datos_incompletos:<campos> |
--   creado | perfil_existente | version_creada
-- Nunca inventa datos: si falta un campo obligatorio de la tabla, informa cuál.

CREATE OR REPLACE FUNCTION public.crear_perfil_profesional_desde_metadatos(
  p_cuenta_id uuid,
  p_perfil jsonb
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_perfil_id uuid;
  v_area uuid;
  v_tipo uuid;
  v_experiencia integer;
  v_faltantes text[] := ARRAY[]::text[];
  v_resultado text;
BEGIN
  IF p_cuenta_id IS NULL THEN
    RETURN 'sin_cuenta';
  END IF;

  IF jsonb_typeof(p_perfil) IS DISTINCT FROM 'object' THEN
    RETURN 'sin_metadatos_perfil';
  END IF;

  -- Campos NOT NULL de perfiles_abogados: se informa exactamente cuál falta.
  IF btrim(COALESCE(p_perfil->>'nombre_profesional', '')) = '' THEN
    v_faltantes := v_faltantes || 'nombre_profesional';
  END IF;
  IF btrim(COALESCE(p_perfil->>'descripcion', '')) = '' THEN
    v_faltantes := v_faltantes || 'descripcion';
  END IF;
  IF btrim(COALESCE(p_perfil->>'ciudad_atencion', '')) = '' THEN
    v_faltantes := v_faltantes || 'ciudad_atencion';
  END IF;
  IF COALESCE(p_perfil->>'experiencia_anios', '') !~ '^\d+$' THEN
    v_faltantes := v_faltantes || 'experiencia_anios';
  END IF;

  IF array_length(v_faltantes, 1) IS NOT NULL THEN
    RETURN 'datos_incompletos:' || array_to_string(v_faltantes, ',');
  END IF;

  v_experiencia := (p_perfil->>'experiencia_anios')::integer;

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
    btrim(p_perfil->>'nombre_profesional'),
    btrim(p_perfil->>'descripcion'),
    v_experiencia,
    btrim(p_perfil->>'ciudad_atencion'),
    TRUE,
    'oculto'::visibilidad_perfil,
    NULLIF(btrim(COALESCE(p_perfil->>'formacion_declarada', '')), ''),
    NULLIF(btrim(COALESCE(p_perfil->>'foto_publica', '')), ''),
    NULLIF(btrim(COALESCE(p_perfil->>'modalidad', '')), ''),
    NULLIF(btrim(COALESCE(p_perfil->>'horarios', '')), ''),
    NULLIF(btrim(COALESCE(p_perfil->>'tarifas_orientativas', '')), ''),
    -- Medios de contacto: sólo claves conocidas con valor textual no vacío.
    (SELECT jsonb_object_agg(medios.clave, medios.valor)
       FROM (
         SELECT m.clave, btrim(p_perfil->'medios_contacto'->>m.clave) AS valor
         FROM unnest(ARRAY['correo', 'telefono', 'whatsapp', 'sitio_web', 'direccion']) AS m(clave)
       ) AS medios
      WHERE jsonb_typeof(p_perfil->'medios_contacto') = 'object'
        AND medios.valor IS NOT NULL
        AND medios.valor <> ''),
    -- Campos publicables: sólo las claves del contrato marcadas como true.
    COALESCE(
      (SELECT jsonb_object_agg(campo.clave, TRUE)
         FROM unnest(ARRAY[
           'foto_publica', 'formacion_declarada', 'modalidad', 'horarios',
           'tarifas_orientativas', 'medios_contacto'
         ]) AS campo(clave)
        WHERE p_perfil->'campos_opcionales_publicos'->campo.clave = 'true'::jsonb),
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
  IF jsonb_typeof(p_perfil->'areas') = 'array' THEN
    FOR v_area IN
      SELECT a.id
      FROM (
        SELECT valor::uuid AS id
        FROM jsonb_array_elements_text(p_perfil->'areas') AS t(valor)
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
  IF jsonb_typeof(p_perfil->'tipos_caso') = 'array' THEN
    FOR v_tipo IN
      SELECT tc.id
      FROM (
        SELECT valor::uuid AS id
        FROM jsonb_array_elements_text(p_perfil->'tipos_caso') AS t(valor)
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
  IF btrim(COALESCE(p_perfil->>'identificacion_privada', '')) <> ''
     AND btrim(COALESCE(p_perfil->>'tarjeta_profesional', '')) <> '' THEN
    INSERT INTO public.versiones_profesionales (
      perfil_id, numero_version, identificacion_privada, tarjeta_profesional, estado_revision
    ) VALUES (
      v_perfil_id,
      1,
      btrim(p_perfil->>'identificacion_privada'),
      btrim(p_perfil->>'tarjeta_profesional'),
      'pendiente'::estado_revision_prof
    )
    ON CONFLICT (perfil_id, numero_version) DO NOTHING;
  END IF;

  RETURN v_resultado;
END;
$$;

-- ==============================================================================
-- TRIGGER DE ALTA: CUENTA, ACEPTACIONES Y PERFIL PROFESIONAL
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rol rol_cuenta;
  v_documentos jsonb;
  v_perfil jsonb;
  v_resultado text;
BEGIN
  v_rol := COALESCE((NEW.raw_user_meta_data->>'rol')::rol_cuenta, 'ciudadano'::rol_cuenta);

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

  -- Alta profesional (CU 02): sólo para cuentas profesionales. El resultado queda
  -- registrado para poder diagnosticar una alta incompleta.
  IF v_rol = 'abogado'::rol_cuenta THEN
    v_perfil := NEW.raw_user_meta_data->'perfil_profesional';
    v_resultado := public.crear_perfil_profesional_desde_metadatos(NEW.id, v_perfil);

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

    RAISE WARNING 'handle_new_user: alta profesional de % -> %', NEW.id, v_resultado;
  END IF;

  RETURN NEW;
END;
$$;
