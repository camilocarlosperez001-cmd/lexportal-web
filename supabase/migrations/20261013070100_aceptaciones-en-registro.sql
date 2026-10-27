-- ==============================================================================
-- ACEPTACIONES LEGALES REGISTRADAS AL CREAR LA CUENTA (CU 01 y CU 02)
-- ==============================================================================
-- Con la confirmación por correo activa (supabase/config.toml) el alta no devuelve
-- sesión, de modo que el cliente no puede insertar en aceptaciones_legales (la
-- política exige cuenta_id = auth.uid()). La aplicación envía los identificadores
-- de los documentos aceptados en los metadatos del usuario y este trigger los
-- registra con la fecha de aceptación, conservando la versión aceptada.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_documentos jsonb;
BEGIN
  INSERT INTO public.cuentas (
    id,
    rol,
    nombre_completo,
    correo,
    telefono,
    estado,
    avisos_correo
  ) VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'rol')::rol_cuenta, 'ciudadano'::rol_cuenta),
    COALESCE(NEW.raw_user_meta_data->>'nombre_completo', 'Usuario Sin Nombre'),
    NEW.email,
    NEW.raw_user_meta_data->>'telefono',
    'activa'::estado_cuenta,
    TRUE
  );

  -- Aceptaciones declaradas en el formulario de registro: sólo se registran
  -- documentos publicados y con identificador con formato válido.
  v_documentos := NEW.raw_user_meta_data->'documentos_aceptados';
  IF jsonb_typeof(v_documentos) = 'array' THEN
    INSERT INTO public.aceptaciones_legales (cuenta_id, documento_id)
    SELECT NEW.id, elemento::uuid
    FROM jsonb_array_elements_text(v_documentos) AS elemento
    JOIN public.documentos_legales d ON d.id = elemento::uuid
    WHERE elemento ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ON CONFLICT (cuenta_id, documento_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
