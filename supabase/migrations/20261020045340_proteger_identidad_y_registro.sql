-- Corrección incremental: conserva las cuentas y perfiles existentes.
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
$$;

-- Complemento de handle_new_user; no modifica registros existentes.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.proteger_cuenta()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public AS $$
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
CREATE TRIGGER proteger_cuenta_campos BEFORE INSERT OR UPDATE ON public.cuentas
FOR EACH ROW EXECUTE FUNCTION private.proteger_cuenta();

CREATE OR REPLACE FUNCTION private.proteger_perfil()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public AS $$
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
CREATE TRIGGER proteger_perfil_campos BEFORE INSERT OR UPDATE ON public.perfiles_abogados
FOR EACH ROW EXECUTE FUNCTION private.proteger_perfil();

-- Conservar autorización por fila además de la protección por columna.
ALTER POLICY "Actualizar cuentas propias o todas si es admin" ON public.cuentas
USING (id = (SELECT auth.uid()) OR public.es_admin())
WITH CHECK (id = (SELECT auth.uid()) OR public.es_admin());
ALTER POLICY "Dueños y admins actualizan perfiles" ON public.perfiles_abogados
USING (cuenta_id = (SELECT auth.uid()) OR public.es_admin())
WITH CHECK (cuenta_id = (SELECT auth.uid()) OR public.es_admin());

-- Funciones internas privilegiadas: solo los triggers y procesos de confianza.
REVOKE EXECUTE ON FUNCTION public.crear_perfil_profesional_desde_metadatos(uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ejecutar_revalidacion_periodica() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.proteger_cuenta() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.proteger_perfil() FROM PUBLIC, anon, authenticated;

-- La lectura pública también respeta actividad y verificación.
ALTER POLICY "Ver perfiles publicos, propios o admin" ON public.perfiles_abogados
USING ((visibilidad = 'publico' AND activo AND version_aprobada_id IS NOT NULL)
       OR cuenta_id = (SELECT auth.uid()) OR public.es_admin());
