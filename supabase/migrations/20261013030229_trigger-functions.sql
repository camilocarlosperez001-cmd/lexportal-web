ALTER TYPE evento_noti ADD VALUE 'solicitud_aceptada';
ALTER TYPE evento_noti ADD VALUE 'solicitud_rechazada';

-- ==============================================================================
-- 1. SINCRONIZACIÓN AUTOMÁTICA DE USUARIOS (auth.users -> public.cuentas)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.cuentas (
    id,
    rol,
    nombre_completo,
    correo,
    telefono,
    estado,
    avisos_correo
  ) VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'rol')::rol_cuenta, 'ciudadano'::rol_cuenta),
    COALESCE(NEW.raw_user_meta_data->>'nombre_completo', 'Usuario Sin Nombre'),
    NEW.email,
    NEW.raw_user_meta_data->>'telefono',
    'activa'::estado_cuenta,
    TRUE
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ==============================================================================
-- 2. APROBACIÓN AUTOMÁTICA DE VERSIÓN PROFESIONAL
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.procesar_revision_profesional()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_perfil_id UUID;
BEGIN
  -- Verificar si la revisión fue aprobada y si cambió de estado
  IF NEW.estado = 'aprobada'::estado_revision_prof AND (OLD.estado IS NULL OR OLD.estado <> 'aprobada'::estado_revision_prof) THEN
    
    -- Obtener a qué perfil pertenece esta versión
    SELECT perfil_id INTO v_perfil_id 
    FROM public.versiones_profesionales 
    WHERE id = NEW.version_id;

    -- 1. Actualizar el estado de la versión profesional
    UPDATE public.versiones_profesionales
    SET estado_revision = 'aprobada'::estado_revision_prof
    WHERE id = NEW.version_id;

    -- 2. Establecer esta versión como la aprobada vigente en el perfil
    UPDATE public.perfiles_abogados
    SET version_aprobada_id = NEW.version_id,
        fecha_verificacion_vigente = NOW()
    WHERE id = v_perfil_id;
    
    -- 3. Crear notificación para el abogado de que su revisión fue resuelta
    INSERT INTO public.notificaciones (
      destinatario_id,
      evento,
      revision_id
    )
    SELECT cuenta_id, 'revision_resuelta'::evento_noti, NEW.id
    FROM public.perfiles_abogados WHERE id = v_perfil_id;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_procesar_revision_profesional ON public.revisiones_profesionales;
CREATE TRIGGER trg_procesar_revision_profesional
  AFTER INSERT OR UPDATE ON public.revisiones_profesionales
  FOR EACH ROW
  EXECUTE FUNCTION public.procesar_revision_profesional();


-- ==============================================================================
-- 3. APERTURA DE CONVERSACIÓN AL ACEPTAR SOLICITUD
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.al_cambiar_estado_solicitud()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Cuando la solicitud pasa a estado 'aceptada'
  IF NEW.estado = 'aceptada'::estado_solicitud AND (OLD.estado IS NULL OR OLD.estado <> 'aceptada'::estado_solicitud) THEN
    
    -- Crear conversación si no existe previamente
    INSERT INTO public.conversaciones (solicitud_id)
    VALUES (NEW.id)
    ON CONFLICT (solicitud_id) DO NOTHING;

    -- (Nota: Para notificar aceptación o rechazo, debes agregar esos eventos 
    -- al ENUM evento_noti. Ver notas al final).

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_al_cambiar_estado_solicitud ON public.solicitudes_contacto;
CREATE TRIGGER trg_al_cambiar_estado_solicitud
  AFTER INSERT OR UPDATE OF estado ON public.solicitudes_contacto
  FOR EACH ROW
  EXECUTE FUNCTION public.al_cambiar_estado_solicitud();


-- ==============================================================================
-- 4. VALIDACIONES DE SERVIDOR (CONVERSACIONES Y MENSAJES)
-- ==============================================================================

-- A. Prevenir creación de conversaciones si la solicitud no está aceptada
CREATE OR REPLACE FUNCTION public.validar_creacion_conversacion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_estado estado_solicitud;
BEGIN
  SELECT estado INTO v_estado
  FROM public.solicitudes_contacto
  WHERE id = NEW.solicitud_id;

  IF v_estado IS NULL OR v_estado <> 'aceptada'::estado_solicitud THEN
    RAISE EXCEPTION 'No se puede iniciar una conversación para una solicitud que no ha sido aceptada.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_creacion_conversacion ON public.conversaciones;
CREATE TRIGGER trg_validar_creacion_conversacion
  BEFORE INSERT ON public.conversaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_creacion_conversacion();


-- B. Validar pertenencia del autor al enviar mensajes de texto
CREATE OR REPLACE FUNCTION public.validar_emisor_mensaje()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_ciudadano_id UUID;
  v_abogado_cuenta_id UUID;
BEGIN
  -- Obtener las cuentas de los participantes de la solicitud original
  SELECT s.ciudadano_id, p.cuenta_id 
  INTO v_ciudadano_id, v_abogado_cuenta_id
  FROM public.conversaciones c
  JOIN public.solicitudes_contacto s ON s.id = c.solicitud_id
  JOIN public.perfiles_abogados p ON p.id = s.abogado_perfil_id
  WHERE c.id = NEW.conversacion_id;

  -- Verificar si el autor_id pertenece a la conversación
  IF NEW.autor_id <> v_ciudadano_id AND NEW.autor_id <> v_abogado_cuenta_id THEN
    RAISE EXCEPTION 'El autor del mensaje no forma parte de esta conversación.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_emisor_mensaje ON public.mensajes_texto;
CREATE TRIGGER trg_validar_emisor_mensaje
  BEFORE INSERT ON public.mensajes_texto
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_emisor_mensaje();


-- ==============================================================================
-- 5. FUNCIÓN RPC PARA CAMBIO SEGURO DE ESTADO DE SOLICITUD
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.cambiar_estado_solicitud(
  p_solicitud_id UUID,
  p_nuevo_estado estado_solicitud,
  p_motivo_rechazo TEXT DEFAULT NULL -- Añadido soporte para rechazos
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_abogado_cuenta_id UUID;
BEGIN
  -- Obtener la cuenta asociada al perfil del abogado en la solicitud
  SELECT p.cuenta_id INTO v_abogado_cuenta_id
  FROM public.solicitudes_contacto s
  JOIN public.perfiles_abogados p ON p.id = s.abogado_perfil_id
  WHERE s.id = p_solicitud_id;

  -- Validar que quien invoca la función sea exactamente el abogado asignado
  IF auth.uid() IS NULL OR auth.uid() <> v_abogado_cuenta_id THEN
    RAISE EXCEPTION 'No tiene permisos para modificar esta solicitud.';
  END IF;

  -- Actualizar el estado y guardar fecha de decisión / motivo de rechazo
  UPDATE public.solicitudes_contacto
  SET estado = p_nuevo_estado,
      decidida_en = NOW(),
      motivo_rechazo = p_motivo_rechazo
  WHERE id = p_solicitud_id;
END;
$$;