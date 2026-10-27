-- ==============================================================================
-- BÚSQUEDA DE ABOGADOS: FIRMA Y COLUMNAS DEL CONTRATO GENERADO (CU 05, 06, 07 y 08)
-- ==============================================================================
-- La migración 20261013034119 definió buscar_abogados(text, uuid[], uuid[]) y
-- devolvía 9 columnas. Los tipos generados (src/types/supabase.ts) declaran además
-- el argumento p_ciudad y las columnas alcance_verificacion_vigente y
-- campos_opcionales_publicos, que el perfil público necesita para mostrar el
-- alcance de la verificación y para decidir qué campos opcionales se publican.
-- Se sustituye la firma anterior para que el esquema y los tipos coincidan y para
-- que el filtro por ciudad se resuelva en el servidor.

DROP FUNCTION IF EXISTS public.buscar_abogados(text, uuid[], uuid[]);

CREATE OR REPLACE FUNCTION public.buscar_abogados(
  p_busqueda text DEFAULT NULL,
  p_areas uuid[] DEFAULT NULL,
  p_tipos_caso uuid[] DEFAULT NULL,
  p_ciudad text DEFAULT NULL
)
RETURNS TABLE (
  perfil_id uuid,
  nombre_profesional text,
  descripcion text,
  experiencia_anios integer,
  ciudad_atencion text,
  foto_publica text,
  modalidad text,
  tarifas_orientativas text,
  alcance_verificacion_vigente text,
  campos_opcionales_publicos jsonb,
  fecha_verificacion_vigente timestamptz,
  areas jsonb,
  tipos_caso jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH perfiles_filtrados AS (
    SELECT
      p.id,
      p.nombre_profesional,
      p.descripcion,
      p.experiencia_anios,
      p.ciudad_atencion,
      p.foto_publica,
      p.modalidad,
      p.tarifas_orientativas,
      p.alcance_verificacion_vigente,
      p.campos_opcionales_publicos,
      p.fecha_verificacion_vigente
    FROM public.perfiles_abogados p
    WHERE
      -- 1. Condiciones estrictas de visibilidad y verificación (CU 05 y CU 08)
      p.visibilidad = 'publico'
      AND p.activo = true
      AND p.version_aprobada_id IS NOT NULL

      -- 2. Texto libre: nombre, descripción, áreas, tipos de caso y términos (CU 05)
      AND (
        p_busqueda IS NULL OR btrim(p_busqueda) = '' OR
        p.nombre_profesional ILIKE '%' || btrim(p_busqueda) || '%' OR
        p.descripcion ILIKE '%' || btrim(p_busqueda) || '%' OR
        EXISTS (
          SELECT 1 FROM public.perfil_area pa
          JOIN public.areas_juridicas aj ON pa.area_id = aj.id
          LEFT JOIN public.termino_area ta ON ta.area_id = aj.id
          LEFT JOIN public.terminos_busqueda tb ON tb.id = ta.termino_id
          WHERE pa.perfil_id = p.id
            AND (aj.nombre ILIKE '%' || btrim(p_busqueda) || '%' OR tb.texto ILIKE '%' || btrim(p_busqueda) || '%')
        ) OR
        EXISTS (
          SELECT 1 FROM public.perfil_tipo_caso ptc
          JOIN public.tipos_caso tc ON ptc.tipo_caso_id = tc.id
          LEFT JOIN public.termino_tipo_caso ttc ON ttc.tipo_caso_id = tc.id
          LEFT JOIN public.terminos_busqueda tb ON tb.id = ttc.termino_id
          WHERE ptc.perfil_id = p.id
            AND (tc.nombre_cotidiano ILIKE '%' || btrim(p_busqueda) || '%' OR tb.texto ILIKE '%' || btrim(p_busqueda) || '%')
        )
      )

      -- 3. Filtro por áreas jurídicas (CU 06)
      AND (
        p_areas IS NULL OR array_length(p_areas, 1) IS NULL OR
        EXISTS (
          SELECT 1 FROM public.perfil_area pa
          WHERE pa.perfil_id = p.id AND pa.area_id = ANY(p_areas)
        )
      )

      -- 4. Filtro por tipos de caso (CU 07)
      AND (
        p_tipos_caso IS NULL OR array_length(p_tipos_caso, 1) IS NULL OR
        EXISTS (
          SELECT 1 FROM public.perfil_tipo_caso ptc
          WHERE ptc.perfil_id = p.id AND ptc.tipo_caso_id = ANY(p_tipos_caso)
        )
      )

      -- 5. Filtro por ciudad de atención (CU 08)
      AND (
        p_ciudad IS NULL OR btrim(p_ciudad) = '' OR
        p.ciudad_atencion ILIKE '%' || btrim(p_ciudad) || '%'
      )
  )
  SELECT
    pf.id,
    pf.nombre_profesional,
    pf.descripcion,
    pf.experiencia_anios,
    pf.ciudad_atencion,
    pf.foto_publica,
    pf.modalidad,
    pf.tarifas_orientativas,
    pf.alcance_verificacion_vigente,
    pf.campos_opcionales_publicos,
    pf.fecha_verificacion_vigente,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('id', a.id, 'nombre', a.nombre))
       FROM public.perfil_area pa
       JOIN public.areas_juridicas a ON pa.area_id = a.id
       WHERE pa.perfil_id = pf.id), '[]'::jsonb
    ) AS areas,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('id', tc.id, 'nombre', tc.nombre_cotidiano))
       FROM public.perfil_tipo_caso ptc
       JOIN public.tipos_caso tc ON ptc.tipo_caso_id = tc.id
       WHERE ptc.perfil_id = pf.id), '[]'::jsonb
    ) AS tipos_caso
  FROM perfiles_filtrados pf
  ORDER BY pf.experiencia_anios DESC;
END;
$$;
