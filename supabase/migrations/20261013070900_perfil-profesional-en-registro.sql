-- ==============================================================================
-- PERFIL PROFESIONAL CREADO EN EL REGISTRO (CU 02)
-- ==============================================================================
-- Con `enable_confirmations = true` (supabase/config.toml) el alta no devuelve sesión,
-- de modo que el cliente no puede escribir en perfiles_abogados, versiones_profesionales
-- ni en las declaraciones: sus políticas exigen cuenta_id = auth.uid(). El CU 02 pide,
-- en cambio, que el sistema cree la cuenta, el perfil y la presentación de datos
-- verificables en el mismo registro, con las evidencias sin publicar.
--
-- La aplicación envía los datos profesionales en los metadatos del usuario
-- (`perfil_profesional`) y este trigger los persiste de forma controlada:
--   * el perfil siempre queda con visibilidad 'oculto', activo y SIN versión aprobada,
--     fecha ni alcance de verificación (nada se publica sin decisión administrativa);
--   * sólo se aceptan claves conocidas de campos publicables y valores textuales;
--   * las áreas y tipos de caso se validan contra el catálogo antes de relacionarse;
--   * la versión inicial queda 'pendiente' y sin evidencias: los archivos se adjuntan
--     después de confirmar el correo, cuando ya existe sesión del titular.
-- Si faltan los datos mínimos, la cuenta se crea igual y el alta se completa luego
-- desde «Mi perfil profesional».

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rol rol_cuenta;
  v_documentos jsonb;
  v_perfil jsonb;
  v_perfil_id uuid;
  v_area uuid;
  v_tipo uuid;
  v_experiencia integer;
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

  -- Aceptaciones declaradas en el formulario de registro (CU 01 y CU 02): sólo se
  -- registran documentos publicados y con identificador con formato válido.
  v_documentos := NEW.raw_user_meta_data->'documentos_aceptados';
  IF jsonb_typeof(v_documentos) = 'array' THEN
    INSERT INTO public.aceptaciones_legales (cuenta_id, documento_id)
    SELECT NEW.id, elemento::uuid
    FROM jsonb_array_elements_text(v_documentos) AS elemento
    JOIN public.documentos_legales d ON d.id = elemento::uuid
    WHERE elemento ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ON CONFLICT (cuenta_id, documento_id) DO NOTHING;
  END IF;

  -- Perfil profesional del registro: sólo para cuentas profesionales con datos mínimos.
  v_perfil := NEW.raw_user_meta_data->'perfil_profesional';
  IF v_rol <> 'abogado'::rol_cuenta OR jsonb_typeof(v_perfil) <> 'object' THEN
    RETURN NEW;
  END IF;

  IF btrim(COALESCE(v_perfil->>'nombre_profesional', '')) = ''
     OR btrim(COALESCE(v_perfil->>'descripcion', '')) = ''
     OR btrim(COALESCE(v_perfil->>'ciudad_atencion', '')) = ''
     OR COALESCE(v_perfil->>'experiencia_anios', '') !~ '^\d+$' THEN
    RETURN NEW;
  END IF;

  v_experiencia := (v_perfil->>'experiencia_anios')::integer;

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
    NEW.id,
    btrim(v_perfil->>'nombre_profesional'),
    btrim(v_perfil->>'descripcion'),
    v_experiencia,
    btrim(v_perfil->>'ciudad_atencion'),
    TRUE,
    'oculto'::visibilidad_perfil,
    NULLIF(btrim(COALESCE(v_perfil->>'formacion_declarada', '')), ''),
    NULLIF(btrim(COALESCE(v_perfil->>'foto_publica', '')), ''),
    NULLIF(btrim(COALESCE(v_perfil->>'modalidad', '')), ''),
    NULLIF(btrim(COALESCE(v_perfil->>'horarios', '')), ''),
    NULLIF(btrim(COALESCE(v_perfil->>'tarifas_orientativas', '')), ''),
    -- Medios de contacto: sólo claves conocidas con valor textual no vacío.
    (SELECT jsonb_object_agg(clave, valor)
       FROM (
         SELECT m.clave, btrim(v_perfil->'medios_contacto'->>m.clave) AS valor
         FROM unnest(ARRAY['correo', 'telefono', 'whatsapp', 'sitio_web', 'direccion']) AS m(clave)
       ) AS medios
      WHERE jsonb_typeof(v_perfil->'medios_contacto') = 'object'
        AND medios.valor IS NOT NULL
        AND medios.valor <> ''),
    -- Campos publicables: sólo las claves del contrato marcadas como true.
    COALESCE(
      (SELECT jsonb_object_agg(campo.clave, TRUE)
         FROM unnest(ARRAY[
           'foto_publica', 'formacion_declarada', 'modalidad', 'horarios',
           'tarifas_orientativas', 'medios_contacto'
         ]) AS campo(clave)
        WHERE v_perfil->'campos_opcionales_publicos'->campo.clave = 'true'::jsonb),
      '{}'::jsonb
    )
  )
  ON CONFLICT (cuenta_id) DO NOTHING
  RETURNING id INTO v_perfil_id;

  IF v_perfil_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Áreas jurídicas declaradas, validadas contra el catálogo existente.
  IF jsonb_typeof(v_perfil->'areas') = 'array' THEN
    FOR v_area IN
      SELECT a.id
      FROM (
        SELECT valor::uuid AS id
        FROM jsonb_array_elements_text(v_perfil->'areas') AS t(valor)
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
  IF jsonb_typeof(v_perfil->'tipos_caso') = 'array' THEN
    FOR v_tipo IN
      SELECT tc.id
      FROM (
        SELECT valor::uuid AS id
        FROM jsonb_array_elements_text(v_perfil->'tipos_caso') AS t(valor)
        WHERE valor ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      ) AS declarados
      JOIN public.tipos_caso tc ON tc.id = declarados.id
    LOOP
      INSERT INTO public.perfil_tipo_caso (perfil_id, tipo_caso_id)
      VALUES (v_perfil_id, v_tipo)
      ON CONFLICT (perfil_id, tipo_caso_id) DO NOTHING;
    END LOOP;
  END IF;

  -- Presentación de datos verificables: pendiente y sin aprobación. La decisión y el
  -- alcance los registra la administración (CU 03); aquí no se crea ninguna revisión.
  IF btrim(COALESCE(v_perfil->>'identificacion_privada', '')) <> ''
     AND btrim(COALESCE(v_perfil->>'tarjeta_profesional', '')) <> '' THEN
    INSERT INTO public.versiones_profesionales (
      perfil_id, numero_version, identificacion_privada, tarjeta_profesional, estado_revision
    ) VALUES (
      v_perfil_id,
      1,
      btrim(v_perfil->>'identificacion_privada'),
      btrim(v_perfil->>'tarjeta_profesional'),
      'pendiente'::estado_revision_prof
    )
    ON CONFLICT (perfil_id, numero_version) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
