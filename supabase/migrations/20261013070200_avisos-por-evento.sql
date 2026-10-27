-- ==============================================================================
-- AVISOS INTERNOS POR EVENTO (CU 15)
-- ==============================================================================
-- El cliente no puede insertar en public.notificaciones (no existe política de
-- inserción para usuarios autenticados). Los avisos internos se generan en el
-- servidor, de modo que se conservan aunque falle el envío del correo.
-- El correo lo despacha el trigger trigger_enviar_correo sobre esta misma tabla.

-- 1. Nueva solicitud y decisiones sobre la solicitud (CU 09 y CU 10).
CREATE OR REPLACE FUNCTION public.notificar_evento_solicitud()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cuenta_abogado uuid;
BEGIN
  SELECT p.cuenta_id INTO v_cuenta_abogado
  FROM public.perfiles_abogados p
  WHERE p.id = NEW.abogado_perfil_id;

  IF TG_OP = 'INSERT' THEN
    IF v_cuenta_abogado IS NOT NULL AND v_cuenta_abogado <> NEW.ciudadano_id THEN
      INSERT INTO public.notificaciones (destinatario_id, evento, solicitud_contacto_id)
      VALUES (v_cuenta_abogado, 'nueva_solicitud'::evento_noti, NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    IF NEW.estado = 'aceptada'::estado_solicitud THEN
      INSERT INTO public.notificaciones (destinatario_id, evento, solicitud_contacto_id)
      VALUES (NEW.ciudadano_id, 'solicitud_aceptada'::evento_noti, NEW.id);
    ELSIF NEW.estado = 'rechazada'::estado_solicitud THEN
      INSERT INTO public.notificaciones (destinatario_id, evento, solicitud_contacto_id)
      VALUES (NEW.ciudadano_id, 'solicitud_rechazada'::evento_noti, NEW.id);
    ELSIF NEW.estado = 'cancelada'::estado_solicitud AND v_cuenta_abogado IS NOT NULL THEN
      INSERT INTO public.notificaciones (destinatario_id, evento, solicitud_contacto_id)
      VALUES (v_cuenta_abogado, 'solicitud_cancelada'::evento_noti, NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_evento_solicitud ON public.solicitudes_contacto;
CREATE TRIGGER trg_notificar_evento_solicitud
  AFTER INSERT OR UPDATE OF estado ON public.solicitudes_contacto
  FOR EACH ROW
  EXECUTE FUNCTION public.notificar_evento_solicitud();

-- 2. Mensaje nuevo: avisa al otro participante (CU 11).
CREATE OR REPLACE FUNCTION public.notificar_mensaje_nuevo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_solicitud uuid;
  v_ciudadano uuid;
  v_abogado uuid;
  v_destino uuid;
BEGIN
  SELECT c.solicitud_id, s.ciudadano_id, p.cuenta_id
  INTO v_solicitud, v_ciudadano, v_abogado
  FROM public.conversaciones c
  JOIN public.solicitudes_contacto s ON s.id = c.solicitud_id
  JOIN public.perfiles_abogados p ON p.id = s.abogado_perfil_id
  WHERE c.id = NEW.conversacion_id;

  v_destino := CASE WHEN NEW.autor_id = v_ciudadano THEN v_abogado ELSE v_ciudadano END;

  IF v_destino IS NOT NULL AND v_destino <> NEW.autor_id THEN
    INSERT INTO public.notificaciones (destinatario_id, evento, mensaje_id, solicitud_contacto_id)
    VALUES (v_destino, 'nuevo_mensaje'::evento_noti, NEW.id, v_solicitud);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_mensaje_nuevo ON public.mensajes_texto;
CREATE TRIGGER trg_notificar_mensaje_nuevo
  AFTER INSERT ON public.mensajes_texto
  FOR EACH ROW
  EXECUTE FUNCTION public.notificar_mensaje_nuevo();

-- 3. Resolución de una petición de privacidad (CU 19).
CREATE OR REPLACE FUNCTION public.notificar_resolucion_privacidad()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.estado = 'resuelta'::estado_peticion_priv
     AND (OLD.estado IS NULL OR OLD.estado <> 'resuelta'::estado_peticion_priv) THEN
    INSERT INTO public.notificaciones (destinatario_id, evento, solicitud_privacidad_id)
    VALUES (NEW.titular_id, 'privacidad_resuelta'::evento_noti, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_resolucion_privacidad ON public.solicitudes_privacidad;
CREATE TRIGGER trg_notificar_resolucion_privacidad
  AFTER UPDATE ON public.solicitudes_privacidad
  FOR EACH ROW
  EXECUTE FUNCTION public.notificar_resolucion_privacidad();

-- 4. Suspensión de un perfil verificable (CU 18).
CREATE OR REPLACE FUNCTION public.notificar_suspension_perfil()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.visibilidad = 'oculto'::visibilidad_perfil
     AND OLD.visibilidad = 'publico'::visibilidad_perfil
     AND NEW.motivo_suspension IS NOT NULL THEN
    INSERT INTO public.notificaciones (destinatario_id, evento)
    VALUES (NEW.cuenta_id, 'perfil_suspendido'::evento_noti);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_suspension_perfil ON public.perfiles_abogados;
CREATE TRIGGER trg_notificar_suspension_perfil
  AFTER UPDATE OF visibilidad ON public.perfiles_abogados
  FOR EACH ROW
  EXECUTE FUNCTION public.notificar_suspension_perfil();
