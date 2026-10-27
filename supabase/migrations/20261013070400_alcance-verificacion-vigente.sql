-- ==============================================================================
-- ALCANCE DE LA VERIFICACIÓN VIGENTE (CU 03 y CU 08)
-- ==============================================================================
-- El trigger original fijaba `version_aprobada_id` y `fecha_verificacion_vigente`
-- pero no `alcance_verificacion_vigente`, de modo que el perfil público no podía
-- informar el alcance de la verificación que la guía exige mostrar. Se conserva el
-- alcance anterior cuando la decisión no registra uno nuevo.

CREATE OR REPLACE FUNCTION public.procesar_revision_profesional()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_perfil_id UUID;
BEGIN
  IF NEW.estado = 'aprobada'::estado_revision_prof
     AND (OLD.estado IS NULL OR OLD.estado <> 'aprobada'::estado_revision_prof) THEN

    SELECT perfil_id INTO v_perfil_id
    FROM public.versiones_profesionales
    WHERE id = NEW.version_id;

    -- 1. La versión presentada queda aprobada.
    UPDATE public.versiones_profesionales
    SET estado_revision = 'aprobada'::estado_revision_prof
    WHERE id = NEW.version_id;

    -- 2. El perfil conserva como vigente la versión aprobada, con la fecha y el
    --    alcance que la decisión administrativa registró.
    UPDATE public.perfiles_abogados
    SET version_aprobada_id = NEW.version_id,
        fecha_verificacion_vigente = COALESCE(NEW.decidida_en, NOW()),
        alcance_verificacion_vigente = COALESCE(
          NULLIF(btrim(COALESCE(NEW.alcance, '')), ''),
          alcance_verificacion_vigente
        )
    WHERE id = v_perfil_id;

    -- 3. Aviso interno al abogado (CU 15).
    INSERT INTO public.notificaciones (destinatario_id, evento, revision_id)
    SELECT cuenta_id, 'revision_resuelta'::evento_noti, NEW.id
    FROM public.perfiles_abogados WHERE id = v_perfil_id;
  END IF;

  RETURN NEW;
END;
$$;
