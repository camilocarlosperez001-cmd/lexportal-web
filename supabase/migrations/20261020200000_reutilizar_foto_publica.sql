-- Consolidación solicitada: conservar columna y bucket de la web.
-- No se trasladan ni eliminan archivos. Detenerse si las estructuras nuevas tienen datos.
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.fotografias_perfil)
    OR EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='fotografias-privadas')
  THEN RAISE EXCEPTION 'Hay fotografías nuevas: reconciliar sus referencias y archivos antes de continuar'; END IF;
END $$;

UPDATE storage.buckets SET public=false WHERE id='perfiles-publicos';

-- Aceptar las URLs históricas sin modificar las filas, y rutas para cargas nuevas.
CREATE OR REPLACE FUNCTION private.fotografia_publicable(p_ruta text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles_abogados p JOIN public.cuentas c ON c.id=p.cuenta_id
    WHERE regexp_replace(p.foto_publica,'^https?://[^/]+/storage/v1/object/public/perfiles-publicos/','')=p_ruta
      AND split_part(p_ruta,'/',1)=p.cuenta_id::text
      AND p.activo AND c.estado='activa' AND c.rol='abogado'
      AND p.visibilidad='publico' AND p.version_aprobada_id IS NOT NULL
      AND p.fecha_verificacion_vigente IS NOT NULL
      AND p.campos_opcionales_publicos->'foto_publica'='true'::jsonb
  );
$$;
CREATE OR REPLACE FUNCTION private.fotografia_registrada(p_ruta text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS(SELECT 1 FROM public.perfiles_abogados p
    WHERE regexp_replace(p.foto_publica,'^https?://[^/]+/storage/v1/object/public/perfiles-publicos/','')=p_ruta);
$$;
CREATE OR REPLACE FUNCTION public.ruta_fotografia_publicable(p_perfil_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT regexp_replace(p.foto_publica,'^https?://[^/]+/storage/v1/object/public/perfiles-publicos/','')
  FROM public.perfiles_abogados p WHERE p.id=p_perfil_id
    AND private.fotografia_publicable(regexp_replace(p.foto_publica,'^https?://[^/]+/storage/v1/object/public/perfiles-publicos/',''));
$$;

DROP POLICY perfiles_publicos_lectura ON storage.objects;
CREATE POLICY perfiles_publicos_lectura ON storage.objects FOR SELECT TO anon,authenticated
USING (bucket_id='perfiles-publicos' AND (
  (storage.foldername(name))[1]=(SELECT auth.uid())::text OR public.es_admin()
  OR private.fotografia_publicable(name)));
DROP POLICY perfiles_publicos_insert_own ON storage.objects;
CREATE POLICY perfiles_publicos_insert_own ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='perfiles-publicos' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text
  AND EXISTS(SELECT 1 FROM public.cuentas c WHERE c.id=(SELECT auth.uid()) AND c.rol='abogado' AND c.estado='activa'));
-- Sustituir fotos creando otra ruta; no sobrescribir la foto referenciada.
DROP POLICY perfiles_publicos_update_own ON storage.objects;
DROP POLICY perfiles_publicos_delete_own ON storage.objects;
CREATE POLICY perfiles_publicos_delete_own ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='perfiles-publicos' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text
  AND NOT private.fotografia_registrada(name));

DROP POLICY fotografias_lectura ON storage.objects;
DROP POLICY fotografias_insertar ON storage.objects;
DROP POLICY fotografias_limpiar_cargas ON storage.objects;
DROP TABLE public.fotografias_perfil;
-- El ejecutor retira el bucket vacío con Storage API, sin borrar metadatos a mano.

CREATE OR REPLACE FUNCTION public.guardar_datos_practica(
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
END $$;
REVOKE ALL ON FUNCTION public.guardar_datos_practica(uuid,jsonb,uuid[],uuid[],text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.guardar_datos_practica(uuid,jsonb,uuid[],uuid[],text) TO authenticated;


NOTIFY pgrst, 'reload schema';
