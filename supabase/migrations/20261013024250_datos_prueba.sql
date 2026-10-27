-- ==============================================================================
-- 1. IDENTIDAD Y PRIVACIDAD
-- ==============================================================================

-- (OPCIONAL) Si estás probando localmente y tienes acceso al esquema auth, 
-- puedes insertar los usuarios dummy así (descomentar si es necesario):
-- INSERT INTO auth.users (instance_id, id, aud, role, email) VALUES 
-- ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'admin@test.com'),
-- ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'abogado@test.com'),
-- ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'ciudadano@test.com');

-- Insertar Cuentas
INSERT INTO public.cuentas (id, nombre_completo, correo, telefono, rol, estado) VALUES
('11111111-1111-1111-1111-111111111111', 'Admin Principal', 'admin@test.com', '3001111111', 'administrador', 'activa'),
('22222222-2222-2222-2222-222222222222', 'Juan Pérez', 'abogado@test.com', '3002222222', 'abogado', 'activa'),
('33333333-3333-3333-3333-333333333333', 'María Gómez', 'ciudadano@test.com', '3003333333', 'ciudadano', 'activa');

-- Insertar Documentos Legales
INSERT INTO public.documentos_legales (id, tipo, version, referencia_contenido) VALUES
('d1111111-1111-1111-1111-111111111111', 'terminos_condiciones', '1.0', 'https://misitio.com/terminos-v1.pdf'),
('d2222222-2222-2222-2222-222222222222', 'politica_privacidad', '1.0', 'https://misitio.com/privacidad-v1.pdf');

-- Aceptaciones Legales
INSERT INTO public.aceptaciones_legales (cuenta_id, documento_id) VALUES
('22222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111'),
('33333333-3333-3333-3333-333333333333', 'd1111111-1111-1111-1111-111111111111');

-- Solicitudes de Privacidad
INSERT INTO public.solicitudes_privacidad (id, titular_id, tipo, estado) VALUES
('sp111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'acceso', 'pendiente');

-- ==============================================================================
-- 2. CATÁLOGO Y DECLARACIONES
-- ==============================================================================

-- Áreas Jurídicas
INSERT INTO public.areas_juridicas (id, nombre) VALUES
('a1111111-1111-1111-1111-111111111111', 'Derecho Laboral'),
('a2222222-2222-2222-2222-222222222222', 'Derecho de Familia');

-- Tipos de Caso
INSERT INTO public.tipos_caso (id, nombre_cotidiano) VALUES
('c1111111-1111-1111-1111-111111111111', 'Despido Injustificado'),
('c2222222-2222-2222-2222-222222222222', 'Divorcio o Separación');

-- Relación Área - Tipo de Caso
INSERT INTO public.area_tipo_caso (area_id, tipo_caso_id) VALUES
('a1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111'),
('a2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222');

-- Términos de Búsqueda
INSERT INTO public.terminos_busqueda (id, texto) VALUES
('t1111111-1111-1111-1111-111111111111', 'liquidación'),
('t2222222-2222-2222-2222-222222222222', 'cuota alimentaria');

-- ==============================================================================
-- 3. PERFIL Y VERIFICACIÓN (Resolviendo la dependencia circular)
-- ==============================================================================

-- 3.1 Insertar el perfil inicial sin la versión aprobada
INSERT INTO public.perfiles_abogados (id, cuenta_id, nombre_profesional, descripcion, experiencia_anios, ciudad_atencion, visibilidad) VALUES
('p1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Dr. Juan Pérez', 'Especialista en derecho laboral y defensa de trabajadores.', 12, 'Bogotá', 'publico');

-- 3.2 Insertar la versión profesional apuntando al perfil
INSERT INTO public.versiones_profesionales (id, perfil_id, numero_version, identificacion_privada, tarjeta_profesional, estado_revision) VALUES
('v1111111-1111-1111-1111-111111111111', 'p1111111-1111-1111-1111-111111111111', 1, 'CC10203040', 'TP123456', 'aprobada');

-- 3.3 Actualizar el perfil para apuntar a la versión aprobada
UPDATE public.perfiles_abogados 
SET version_aprobada_id = 'v1111111-1111-1111-1111-111111111111' 
WHERE id = 'p1111111-1111-1111-1111-111111111111';

-- Especialidades del Perfil
INSERT INTO public.perfil_area (perfil_id, area_id) VALUES
('p1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111'); -- Laboral

INSERT INTO public.perfil_tipo_caso (perfil_id, tipo_caso_id) VALUES
('p1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111'); -- Despido Injustificado

-- Revisiones
INSERT INTO public.revisiones_profesionales (id, version_id, tipo, estado, responsable_id) VALUES
('r1111111-1111-1111-1111-111111111111', 'v1111111-1111-1111-1111-111111111111', 'inicial', 'aprobada', '11111111-1111-1111-1111-111111111111');

-- ==============================================================================
-- 4. CONTACTO Y COMUNICACIÓN
-- ==============================================================================

-- Solicitud de Contacto
INSERT INTO public.solicitudes_contacto (id, ciudadano_id, abogado_perfil_id, tipo_caso_id, sin_clasificar, clasificacion_al_enviar, descripcion_breve, ayuda_buscada, estado) VALUES
('s1111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'p1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', false, '{"area": "Derecho Laboral"}'::jsonb, 'Me despidieron sin pagarme la liquidación.', 'Quiero saber si puedo interponer una demanda.', 'aceptada');

-- Orientación (Respuesta estructural de la solicitud)
INSERT INTO public.orientaciones (solicitud_id, area_id, comentario_general) VALUES
('s1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'Su caso tiene fundamento, necesitamos revisar su contrato.');

-- Conversación iniciada
INSERT INTO public.conversaciones (id, solicitud_id) VALUES
('chat1111-1111-1111-1111-111111111111', 's1111111-1111-1111-1111-111111111111');

-- Mensajes del Chat
INSERT INTO public.mensajes_texto (id, conversacion_id, autor_id, contenido) VALUES
('m1111111-1111-1111-1111-111111111111', 'chat1111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'Buenas tardes doctor, gracias por aceptar mi solicitud.'),
('m2222222-2222-2222-2222-222222222222', 'chat1111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Buenas tardes María, por favor envíeme su contrato al correo.');

-- Notificaciones
INSERT INTO public.notificaciones (id, destinatario_id, evento, solicitud_contacto_id) VALUES
('n1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'nueva_solicitud', 's1111111-1111-1111-1111-111111111111');