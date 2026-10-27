-- Corrección anunciada: conservar firma, privilegios, versiones y evidencias existentes.
CREATE OR REPLACE FUNCTION public.preparar_version_profesional(p_perfil_id uuid,p_tarjeta text,p_identificacion text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_identificacion text; v_numero int;
BEGIN
  PERFORM 1 FROM public.perfiles_abogados p JOIN public.cuentas c ON c.id=p.cuenta_id
  WHERE p.id=p_perfil_id AND p.cuenta_id=auth.uid() AND c.rol='abogado' AND c.estado='activa' FOR UPDATE OF p;
  IF NOT FOUND THEN RAISE EXCEPTION 'No tienes permiso para presentar esta versión' USING ERRCODE='42501'; END IF;
  IF length(btrim(p_tarjeta)) NOT BETWEEN 3 AND 40 OR p_tarjeta IS NULL THEN RAISE EXCEPTION 'Tarjeta profesional inválida'; END IF;
  SELECT identificacion_privada INTO v_identificacion FROM public.versiones_profesionales WHERE perfil_id=p_perfil_id ORDER BY numero_version DESC LIMIT 1;
  v_identificacion:=coalesce(nullif(btrim(p_identificacion),''),v_identificacion);
  IF v_identificacion IS NULL OR length(v_identificacion) NOT BETWEEN 3 AND 40 THEN RAISE EXCEPTION 'Falta la identificación privada'; END IF;
  SELECT id INTO v_id FROM public.versiones_profesionales WHERE perfil_id=p_perfil_id AND estado_revision='pendiente'
    AND tarjeta_profesional=btrim(p_tarjeta) AND identificacion_privada=v_identificacion ORDER BY numero_version DESC LIMIT 1;
  IF FOUND THEN RETURN v_id; END IF;
  SELECT coalesce(max(numero_version),0)+1 INTO v_numero FROM public.versiones_profesionales WHERE perfil_id=p_perfil_id;
  INSERT INTO public.versiones_profesionales(perfil_id,numero_version,identificacion_privada,tarjeta_profesional,estado_revision)
  VALUES(p_perfil_id,v_numero,v_identificacion,btrim(p_tarjeta),'pendiente') RETURNING id INTO v_id;
  RETURN v_id;
END $$;
-- CREATE OR REPLACE conserva los grants y la misma firma uuid,text,text.
NOTIFY pgrst, 'reload schema';
