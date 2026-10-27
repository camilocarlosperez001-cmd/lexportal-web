-- Nueva RPC de recuperación propia; reutiliza el creador interno sin exponerlo.
-- No hace backfill ni cambia cuentas, perfiles, roles o aceptaciones existentes.
CREATE FUNCTION public.recuperar_perfil_profesional(
  p_perfil jsonb DEFAULT NULL, p_documentos uuid[] DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
END $$;
REVOKE ALL ON FUNCTION public.recuperar_perfil_profesional(jsonb,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.recuperar_perfil_profesional(jsonb,uuid[]) TO authenticated;
-- Conservar el creador con cuenta explícita como función interna, sin acceso del cliente.
REVOKE EXECUTE ON FUNCTION public.crear_perfil_profesional_desde_metadatos(uuid,jsonb) FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
