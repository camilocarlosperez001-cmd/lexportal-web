-- Cambio de contrato autorizado: reutilizar buscar_abogados para búsqueda/detalle.
-- Sin cambios de datos, tablas, buckets ni vistas. No usar CASCADE al sustituir la RPC.
ALTER POLICY "Ver perfiles publicos, propios o admin" ON public.perfiles_abogados
TO authenticated USING (cuenta_id=(SELECT auth.uid()) OR public.es_admin());
REVOKE SELECT ON public.perfiles_abogados FROM anon;
GRANT SELECT ON public.perfiles_abogados TO authenticated;

DROP FUNCTION public.buscar_abogados(text,uuid[],uuid[],text);
CREATE FUNCTION public.buscar_abogados(
  p_busqueda text DEFAULT NULL,
  p_areas uuid[] DEFAULT NULL,
  p_tipos_caso uuid[] DEFAULT NULL,
  p_ciudad text DEFAULT NULL,
  p_perfil_id uuid DEFAULT NULL
) RETURNS TABLE (
  perfil_id uuid, nombre_profesional text, descripcion text, experiencia_anios integer,
  ciudad_atencion text, foto_publica text, modalidad text, tarifas_orientativas text,
  fecha_verificacion_vigente timestamptz, alcance_verificacion_vigente text,
  campos_opcionales_publicos jsonb, areas jsonb, tipos_caso jsonb,
  formacion_declarada text, horarios text, medios_contacto jsonb
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
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
REVOKE ALL ON FUNCTION public.buscar_abogados(text,uuid[],uuid[],text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_abogados(text,uuid[],uuid[],text,uuid) TO anon,authenticated,service_role;

-- Fotografía y directorio comparten condiciones de elegibilidad; no exponer archivos
-- de una cuenta inactiva ni de una versión que ya no esté aprobada.
CREATE OR REPLACE FUNCTION private.fotografia_publicable(p_ruta text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
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
NOTIFY pgrst,'reload schema';
