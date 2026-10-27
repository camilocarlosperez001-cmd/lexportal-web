-- Inicio transaccional e idempotente; conserva versiones, evidencias y decisiones.
CREATE OR REPLACE FUNCTION public.iniciar_revision_profesional(p_version_id uuid)
-- El trigger histórico de revisiones resuelve enums sin calificar.
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_estado public.estado_revision_prof; v_revision uuid;
BEGIN
 IF NOT COALESCE(public.es_admin(),false) OR auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Se requiere administración autenticada' USING ERRCODE='42501';
 END IF;
 SELECT estado_revision INTO v_estado FROM public.versiones_profesionales WHERE id=p_version_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Versión no disponible' USING ERRCODE='22023'; END IF;
 SELECT id INTO v_revision FROM public.revisiones_profesionales
 WHERE version_id=p_version_id AND decidida_en IS NULL AND estado IN ('pendiente','en_revision')
 ORDER BY programada_en NULLS LAST,id LIMIT 1;
 IF v_revision IS NOT NULL THEN RETURN v_revision; END IF;
 IF v_estado NOT IN ('pendiente','en_revision') THEN
  RAISE EXCEPTION 'La versión ya fue decidida' USING ERRCODE='22023';
 END IF;
 UPDATE public.versiones_profesionales SET estado_revision='en_revision' WHERE id=p_version_id;
 INSERT INTO public.revisiones_profesionales(version_id,tipo,estado,programada_en,responsable_id)
 VALUES(p_version_id,'inicial','en_revision',now(),auth.uid()) RETURNING id INTO v_revision;
 RETURN v_revision;
END;
$$;
REVOKE ALL ON FUNCTION public.iniciar_revision_profesional(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.iniciar_revision_profesional(uuid) TO authenticated;

-- Mantener el cuerpo de la RPC periódica sin copiarlo ni cambiar su firma.
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.ejecutar_revalidacion_periodica()'::regprocedure) INTO definition;
 IF position('LEXPORTAL_ADMIN_REVALIDACION' IN definition)=0 THEN
  definition:=regexp_replace(definition,E'BEGIN\\s*',E'BEGIN\n -- LEXPORTAL_ADMIN_REVALIDACION\n IF NOT COALESCE(public.es_admin(),false) AND COALESCE(auth.role(),'''')<>''service_role'' AND NOT (session_user IN (''postgres'',''supabase_admin'') AND current_setting(''role'',true) IN (''none'',''postgres'',''supabase_admin'')) THEN\n RAISE EXCEPTION ''Se requiere administración'' USING ERRCODE=''42501'';\n END IF;\n');
  IF position('LEXPORTAL_ADMIN_REVALIDACION' IN definition)=0 THEN RAISE EXCEPTION 'No se encontró el cuerpo de la RPC'; END IF;
  EXECUTE definition;
 END IF;
END;
$migration$;
REVOKE ALL ON FUNCTION public.ejecutar_revalidacion_periodica() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ejecutar_revalidacion_periodica() TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
