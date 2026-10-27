-- ==============================================================================
-- NORMALIZACIÓN DEL CONTRATO DE METADATOS DEL ALTA PROFESIONAL (CU 02)
-- ==============================================================================
-- Problema corregido: la aplicación enviaba las claves en camelCase
-- (nombreProfesional, ciudadAtencion, experienciaAnios, areaIds, tipoCasoIds,
-- camposPublicos, mediosContacto, identificacionPrivada, tarjetaProfesional) y la
-- función leía los nombres del esquema en snake_case. El resultado era un alta a
-- medias y silenciosa: el único campo que coincidía era `descripcion`, de modo que
-- la función respondía `datos_incompletos:nombre_profesional,ciudad_atencion,
-- experiencia_anios` y no creaba el perfil ni, por tanto, las declaraciones ni la
-- versión inicial.
--
-- La función pasa a leer la primera clave no vacía entre los nombres del esquema y
-- sus alias en camelCase. Así:
--   * el contrato canónico son los nombres del esquema (el cliente se ha ajustado);
--   * las altas ya registradas con la convención anterior se pueden reprocesar con
--     `crear_perfil_profesional_desde_metadatos` sin volver a registrarse.

-- ------------------------------------------------------------------------------
-- Ayuda: primer valor textual no vacío entre varias claves candidatas
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.perfil_texto(p_perfil jsonb, VARIADIC p_claves text[])
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(btrim(t.valor), '')
  FROM unnest(p_claves) WITH ORDINALITY AS clave(nombre, orden)
  CROSS JOIN LATERAL (SELECT p_perfil->>clave.nombre AS valor) AS t
  WHERE t.valor IS NOT NULL
    AND btrim(t.valor) <> ''
  ORDER BY clave.orden
  LIMIT 1;
$$;

-- ------------------------------------------------------------------------------
-- Creación del perfil a partir de los metadatos
-- ------------------------------------------------------------------------------
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
    'oculto'::visibilidad_perfil,
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
$$;
