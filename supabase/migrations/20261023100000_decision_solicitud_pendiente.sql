CREATE OR REPLACE FUNCTION public.cambiar_estado_solicitud(p_solicitud_id uuid,p_nuevo_estado public.estado_solicitud,p_motivo_rechazo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_estado public.estado_solicitud; v_titular uuid;
BEGIN
  SELECT s.estado,p.cuenta_id INTO v_estado,v_titular FROM public.solicitudes_contacto s
  JOIN public.perfiles_abogados p ON p.id=s.abogado_perfil_id WHERE s.id=p_solicitud_id FOR UPDATE OF s;
  IF auth.uid() IS NULL OR v_titular IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'No tienes permiso para decidir esta solicitud' USING ERRCODE='42501'; END IF;
  IF p_nuevo_estado IS NULL OR p_nuevo_estado NOT IN ('aceptada','rechazada') THEN RAISE EXCEPTION 'Decisión inválida' USING ERRCODE='22023'; END IF;
  IF v_estado IS DISTINCT FROM 'pendiente'::public.estado_solicitud THEN RAISE EXCEPTION 'La solicitud ya no está pendiente' USING ERRCODE='22023'; END IF;
  UPDATE public.solicitudes_contacto SET estado=p_nuevo_estado,decidida_en=now(),
    motivo_rechazo=CASE WHEN p_nuevo_estado='rechazada' THEN nullif(btrim(p_motivo_rechazo),'') ELSE NULL END
    WHERE id=p_solicitud_id;
END $$;
NOTIFY pgrst,'reload schema';
