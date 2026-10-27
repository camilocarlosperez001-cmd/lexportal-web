-- Añade una guardia a la función existente sin copiar su URL ni credenciales locales.
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.enviar_aviso_correo()'::regprocedure) INTO definition;
 IF position('LEXPORTAL_RESPETA_PREFERENCIA' IN definition)>0 THEN RAISE EXCEPTION 'Guardia ya instalada'; END IF;
 definition:=regexp_replace(definition,E'BEGIN\\s*',E'BEGIN\n  -- LEXPORTAL_RESPETA_PREFERENCIA\n  IF NOT EXISTS (SELECT 1 FROM public.cuentas c WHERE c.id=NEW.destinatario_id AND c.avisos_correo) THEN\n    UPDATE public.notificaciones SET estado_aviso_correo=''no_aplica'' WHERE id=NEW.id;\n    RETURN NEW;\n  END IF;\n');
 IF position('LEXPORTAL_RESPETA_PREFERENCIA' IN definition)=0 THEN RAISE EXCEPTION 'No se pudo localizar el cuerpo'; END IF;
 EXECUTE definition;
END;
$migration$;
