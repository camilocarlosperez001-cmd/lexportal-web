-- Nueva migración, sin actualizar ni trasladar datos existentes.
CREATE TABLE public.fotografias_perfil (
  perfil_id uuid PRIMARY KEY REFERENCES public.perfiles_abogados(id) ON DELETE CASCADE,
  ruta_storage_privada text NOT NULL UNIQUE,
  actualizada_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fotografias_perfil ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fotografias_perfil FROM anon, authenticated;
GRANT SELECT ON public.fotografias_perfil TO authenticated;
CREATE POLICY fotos_titular_admin ON public.fotografias_perfil FOR SELECT TO authenticated
USING (public.es_dueno_perfil(perfil_id) OR public.es_admin());

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('fotografias-privadas','fotografias-privadas',false,5242880,ARRAY['image/jpeg','image/png']);

-- La lectura pública exige todos los consentimientos. No se crean URLs públicas/firmadas.
CREATE FUNCTION private.fotografia_publicable(p_ruta text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.fotografias_perfil f
    JOIN public.perfiles_abogados p ON p.id=f.perfil_id
    JOIN public.cuentas c ON c.id=p.cuenta_id
    WHERE f.ruta_storage_privada=p_ruta AND p.activo AND c.estado='activa'
      AND p.visibilidad='publico' AND p.version_aprobada_id IS NOT NULL
      AND p.fecha_verificacion_vigente IS NOT NULL
      AND p.campos_opcionales_publicos->'foto_publica'='true'::jsonb
  );
$$;
REVOKE ALL ON FUNCTION private.fotografia_publicable(text) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.fotografia_publicable(text) TO anon, authenticated;
CREATE FUNCTION public.ruta_fotografia_publicable(p_perfil_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT f.ruta_storage_privada FROM public.fotografias_perfil f
  WHERE f.perfil_id=p_perfil_id AND private.fotografia_publicable(f.ruta_storage_privada);
$$;
REVOKE ALL ON FUNCTION public.ruta_fotografia_publicable(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ruta_fotografia_publicable(uuid) TO anon, authenticated;
CREATE POLICY fotografias_lectura ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id='fotografias-privadas' AND (
  (storage.foldername(name))[1]=(SELECT auth.uid())::text OR public.es_admin()
  OR private.fotografia_publicable(name)));
CREATE POLICY fotografias_insertar ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='fotografias-privadas'
  AND (storage.foldername(name))[1]=(SELECT auth.uid())::text
  AND EXISTS (SELECT 1 FROM public.cuentas c WHERE c.id=(SELECT auth.uid()) AND c.rol='abogado' AND c.estado='activa'));
-- Solo se retiran cargas sin referencia; nunca la fotografía guardada.
CREATE FUNCTION private.fotografia_registrada(p_ruta text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS(SELECT 1 FROM public.fotografias_perfil WHERE ruta_storage_privada=p_ruta);
$$;
REVOKE ALL ON FUNCTION private.fotografia_registrada(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.fotografia_registrada(text) TO authenticated;
CREATE POLICY fotografias_limpiar_cargas ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='fotografias-privadas' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text
  AND NOT private.fotografia_registrada(name));

CREATE FUNCTION public.guardar_datos_practica(
  p_perfil_id uuid, p_datos jsonb, p_areas uuid[], p_tipos uuid[], p_foto_ruta text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
      OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id='fotografias-privadas' AND o.name=p_foto_ruta
        AND o.metadata->>'mimetype' IN ('image/jpeg','image/png') AND (o.metadata->>'size')::bigint BETWEEN 1 AND 5242880)
    THEN RAISE EXCEPTION 'La fotografía no está disponible en el almacén privado'; END IF;
    INSERT INTO public.fotografias_perfil(perfil_id,ruta_storage_privada) VALUES(p_perfil_id,p_foto_ruta)
    ON CONFLICT(perfil_id) DO UPDATE SET ruta_storage_privada=excluded.ruta_storage_privada,actualizada_en=now();
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
END $$;
REVOKE ALL ON FUNCTION public.guardar_datos_practica(uuid,jsonb,uuid[],uuid[],text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.guardar_datos_practica(uuid,jsonb,uuid[],uuid[],text) TO authenticated;

-- Serializa números de versión y reutiliza la presentación pendiente en reintentos.
CREATE FUNCTION private.validar_version_presentada() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.role()='authenticated' AND NOT public.es_admin() THEN
    IF NEW.estado_revision<>'pendiente' OR NOT EXISTS(SELECT 1 FROM public.perfiles_abogados p
      JOIN public.cuentas c ON c.id=p.cuenta_id WHERE p.id=NEW.perfil_id AND p.cuenta_id=auth.uid() AND c.rol='abogado' AND c.estado='activa')
    THEN RAISE EXCEPTION 'Solo puedes presentar versiones propias pendientes' USING ERRCODE='42501'; END IF;
    NEW.presentada_en:=now();
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.validar_version_presentada() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER validar_version_presentada BEFORE INSERT ON public.versiones_profesionales
FOR EACH ROW EXECUTE FUNCTION private.validar_version_presentada();

CREATE FUNCTION public.preparar_version_profesional(p_perfil_id uuid,p_tarjeta text,p_identificacion text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_identificacion text; v_numero int;
BEGIN
  PERFORM 1 FROM public.perfiles_abogados p JOIN public.cuentas c ON c.id=p.cuenta_id
  WHERE p.id=p_perfil_id AND p.cuenta_id=auth.uid() AND c.rol='abogado' AND c.estado='activa' FOR UPDATE OF p;
  IF NOT FOUND THEN RAISE EXCEPTION 'No tienes permiso para presentar esta versión' USING ERRCODE='42501'; END IF;
  IF length(btrim(p_tarjeta)) NOT BETWEEN 3 AND 40 OR p_tarjeta IS NULL THEN RAISE EXCEPTION 'Tarjeta profesional inválida'; END IF;
  SELECT id INTO v_id FROM public.versiones_profesionales WHERE perfil_id=p_perfil_id AND estado_revision='pendiente'
    AND tarjeta_profesional=btrim(p_tarjeta) ORDER BY numero_version DESC LIMIT 1;
  IF FOUND THEN RETURN v_id; END IF;
  SELECT identificacion_privada INTO v_identificacion FROM public.versiones_profesionales WHERE perfil_id=p_perfil_id ORDER BY numero_version DESC LIMIT 1;
  v_identificacion:=coalesce(nullif(btrim(p_identificacion),''),v_identificacion);
  IF v_identificacion IS NULL OR length(v_identificacion) NOT BETWEEN 3 AND 40 THEN RAISE EXCEPTION 'Falta la identificación privada'; END IF;
  SELECT coalesce(max(numero_version),0)+1 INTO v_numero FROM public.versiones_profesionales WHERE perfil_id=p_perfil_id;
  INSERT INTO public.versiones_profesionales(perfil_id,numero_version,identificacion_privada,tarjeta_profesional,estado_revision)
  VALUES(p_perfil_id,v_numero,v_identificacion,btrim(p_tarjeta),'pendiente') RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.preparar_version_profesional(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.preparar_version_profesional(uuid,text,text) TO authenticated;

CREATE FUNCTION private.validar_evidencia_presentada() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
REVOKE ALL ON FUNCTION private.validar_evidencia_presentada() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER validar_evidencia_presentada BEFORE INSERT ON public.evidencias_privadas
FOR EACH ROW EXECUTE FUNCTION private.validar_evidencia_presentada();

CREATE FUNCTION public.registrar_evidencia_profesional(p_version_id uuid,p_ruta text,p_tipo text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
REVOKE ALL ON FUNCTION public.registrar_evidencia_profesional(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.registrar_evidencia_profesional(uuid,text,text) TO authenticated;

-- Los soportes registrados no se sustituyen ni eliminan mediante Storage.
CREATE POLICY evidencias_registradas_inmutables_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
USING (bucket_id<>'evidencias-privadas' OR NOT EXISTS(SELECT 1 FROM public.evidencias_privadas e WHERE e.ruta_storage_privada=name));
CREATE POLICY evidencias_registradas_inmutables_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
USING (bucket_id<>'evidencias-privadas' OR NOT EXISTS(SELECT 1 FROM public.evidencias_privadas e WHERE e.ruta_storage_privada=name));

NOTIFY pgrst, 'reload schema';
