-- ==============================================================================
-- UN AVISO SIN LEER POR CONVERSACIÓN (CU 11 y CU 15)
-- ==============================================================================
-- El trigger de mensajes creaba una notificación por cada mensaje insertado, y cada
-- notificación dispara un correo. En una conversación seguida eso significa una decena
-- de avisos y de correos por una sola conversación: ruido para el destinatario y riesgo
-- de throttling del servidor SMTP.
--
-- Regla: mientras el destinatario tenga un aviso de mensaje sin leer de esa misma
-- conversación, los mensajes siguientes no crean otro. En cuanto lo lee (o abre el
-- chat y lo marca), el siguiente mensaje vuelve a avisar. El aviso interno sigue
-- conservándose aunque falle el correo.

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

  -- El destinatario es el otro participante; nunca el autor del mensaje.
  v_destino := CASE WHEN NEW.autor_id = v_ciudadano THEN v_abogado ELSE v_ciudadano END;

  IF v_destino IS NULL OR v_destino = NEW.autor_id THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.notificaciones n
    WHERE n.destinatario_id = v_destino
      AND n.evento = 'nuevo_mensaje'::evento_noti
      AND n.solicitud_contacto_id = v_solicitud
      AND n.leida_en IS NULL
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notificaciones (destinatario_id, evento, mensaje_id, solicitud_contacto_id)
  VALUES (v_destino, 'nuevo_mensaje'::evento_noti, NEW.id, v_solicitud);

  RETURN NEW;
END;
$$;

-- El trigger `trg_notificar_mensaje_nuevo` ya existe y apunta a esta función; con
-- CREATE OR REPLACE queda aplicada la nueva regla sin recrearlo.
