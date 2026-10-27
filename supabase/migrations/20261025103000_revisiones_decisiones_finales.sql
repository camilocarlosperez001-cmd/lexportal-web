-- Conservar aprobación y contratos existentes, sincronizar decisiones iniciales no favorables.
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.procesar_revision_profesional()'::regprocedure) INTO definition;
 IF position('LEXPORTAL_DECISION_NO_FAVORABLE' IN definition)=0 THEN
  definition:=regexp_replace(definition,E'RETURN NEW;',E'-- LEXPORTAL_DECISION_NO_FAVORABLE\n IF NEW.estado IN (''rechazada''::public.estado_revision_prof,''requiere_correcciones''::public.estado_revision_prof) AND (TG_OP=''INSERT'' OR OLD.estado IS DISTINCT FROM NEW.estado) THEN\n  IF NEW.tipo=''inicial''::public.tipo_revision_prof THEN\n   UPDATE public.versiones_profesionales SET estado_revision=NEW.estado WHERE id=NEW.version_id AND id IS DISTINCT FROM (SELECT p.version_aprobada_id FROM public.perfiles_abogados p WHERE p.id=public.versiones_profesionales.perfil_id);\n  END IF;\n  INSERT INTO public.notificaciones(destinatario_id,evento,revision_id) SELECT p.cuenta_id,''revision_resuelta''::public.evento_noti,NEW.id FROM public.perfiles_abogados p JOIN public.versiones_profesionales v ON v.perfil_id=p.id WHERE v.id=NEW.version_id;\n END IF;\n RETURN NEW;');
  IF position('LEXPORTAL_DECISION_NO_FAVORABLE' IN definition)=0 THEN RAISE EXCEPTION 'No se localizó el retorno del trigger';END IF;
  EXECUTE definition;
 END IF;
END;
$migration$;
NOTIFY pgrst,'reload schema';
