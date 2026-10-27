-- ==============================================================================
-- 0. FUNCIONES AUXILIARES DE SEGURIDAD (Evitan recursividad y mejoran rendimiento)
-- ==============================================================================

-- Verifica si el usuario actual es administrador
CREATE OR REPLACE FUNCTION public.es_admin() 
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cuentas 
    WHERE id = auth.uid() AND rol = 'administrador'
  );
$$;

-- Verifica si el usuario actual es el dueño de un perfil de abogado específico
CREATE OR REPLACE FUNCTION public.es_dueno_perfil(p_perfil_id uuid) 
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles_abogados 
    WHERE id = p_perfil_id AND cuenta_id = auth.uid()
  );
$$;

-- Verifica si el usuario actual es el creador (ciudadano) o el receptor (abogado) de una solicitud
CREATE OR REPLACE FUNCTION public.es_participante_solicitud(p_solicitud_id uuid) 
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.solicitudes_contacto sc
    LEFT JOIN public.perfiles_abogados pa ON sc.abogado_perfil_id = pa.id
    WHERE sc.id = p_solicitud_id 
      AND (sc.ciudadano_id = auth.uid() OR pa.cuenta_id = auth.uid())
  );
$$;

-- ==============================================================================
-- 1. HABILITAR RLS EN TODAS LAS TABLAS
-- ==============================================================================

ALTER TABLE public.cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_legales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aceptaciones_legales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitudes_privacidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles_abogados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.versiones_profesionales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidencias_privadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revisiones_profesionales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.politica_revalidacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.areas_juridicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_caso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.area_tipo_caso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminos_busqueda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.termino_area ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.termino_tipo_caso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfil_area ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfil_tipo_caso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitudes_contacto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orientaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensajes_texto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 2. POLÍTICAS: IDENTIDAD Y PRIVACIDAD
-- ==============================================================================

-- CUENTAS: El usuario puede ver/editar su propia cuenta. Admins ven/editan todo.
CREATE POLICY "Ver cuentas propias o todas si es admin" ON public.cuentas FOR SELECT 
USING (id = auth.uid() OR es_admin());

CREATE POLICY "Actualizar cuentas propias o todas si es admin" ON public.cuentas FOR UPDATE 
USING (id = auth.uid() OR es_admin());

-- DOCUMENTOS LEGALES: Públicos para lectura. Solo admins pueden insertar/actualizar.
CREATE POLICY "Lectura pública de documentos legales" ON public.documentos_legales FOR SELECT USING (true);
CREATE POLICY "Admins gestionan documentos legales" ON public.documentos_legales FOR ALL USING (es_admin());

-- ACEPTACIONES LEGALES: El usuario ve las suyas. Admins ven todas. Inserción solo por el propio usuario.
CREATE POLICY "Ver aceptaciones propias o todas si es admin" ON public.aceptaciones_legales FOR SELECT 
USING (cuenta_id = auth.uid() OR es_admin());

CREATE POLICY "Usuarios insertan sus aceptaciones" ON public.aceptaciones_legales FOR INSERT 
WITH CHECK (cuenta_id = auth.uid());

-- SOLICITUDES PRIVACIDAD: Usuario ve/crea las suyas. Admins ven/actualizan todas.
CREATE POLICY "Ver solicitudes privacidad propias o admin" ON public.solicitudes_privacidad FOR SELECT 
USING (titular_id = auth.uid() OR es_admin());

CREATE POLICY "Usuarios crean sus solicitudes privacidad" ON public.solicitudes_privacidad FOR INSERT 
WITH CHECK (titular_id = auth.uid());

CREATE POLICY "Admins actualizan solicitudes privacidad" ON public.solicitudes_privacidad FOR UPDATE 
USING (es_admin());

-- ==============================================================================
-- 3. POLÍTICAS: PERFIL Y VERIFICACIÓN
-- ==============================================================================

-- PERFILES ABOGADOS: Lectura pública si está 'publico'. Dueños o admins ven todo.
CREATE POLICY "Ver perfiles publicos, propios o admin" ON public.perfiles_abogados FOR SELECT 
USING (visibilidad = 'publico' OR cuenta_id = auth.uid() OR es_admin());

CREATE POLICY "Dueños y admins actualizan perfiles" ON public.perfiles_abogados FOR UPDATE 
USING (cuenta_id = auth.uid() OR es_admin());

CREATE POLICY "Dueños insertan sus perfiles" ON public.perfiles_abogados FOR INSERT 
WITH CHECK (cuenta_id = auth.uid());

-- VERSIONES PROFESIONALES: Solo el dueño del perfil o el admin pueden leer y escribir.
CREATE POLICY "Ver versiones profesionales propias o admin" ON public.versiones_profesionales FOR SELECT 
USING (es_dueno_perfil(perfil_id) OR es_admin());

CREATE POLICY "Dueños insertan versiones" ON public.versiones_profesionales FOR INSERT 
WITH CHECK (es_dueno_perfil(perfil_id));

CREATE POLICY "Admins actualizan versiones" ON public.versiones_profesionales FOR UPDATE 
USING (es_admin());

-- EVIDENCIAS PRIVADAS: Visibles/insertables solo por el dueño de la versión o admin.
CREATE POLICY "Ver evidencias propias o admin" ON public.evidencias_privadas FOR SELECT 
USING (es_dueno_perfil((SELECT perfil_id FROM public.versiones_profesionales WHERE id = version_id)) OR es_admin());

CREATE POLICY "Dueños insertan evidencias" ON public.evidencias_privadas FOR INSERT 
WITH CHECK (es_dueno_perfil((SELECT perfil_id FROM public.versiones_profesionales WHERE id = version_id)));

-- REVISIONES PROFESIONALES: Visibles por el dueño de la versión o admin. Solo admin modifica.
CREATE POLICY "Ver revisiones propias o admin" ON public.revisiones_profesionales FOR SELECT 
USING (es_dueno_perfil((SELECT perfil_id FROM public.versiones_profesionales WHERE id = version_id)) OR es_admin());

CREATE POLICY "Admins gestionan revisiones" ON public.revisiones_profesionales FOR ALL USING (es_admin());

-- POLÍTICA REVALIDACIÓN: Solo visible y modificable por admins.
CREATE POLICY "Admins gestionan politica revalidacion" ON public.politica_revalidacion FOR ALL USING (es_admin());

-- ==============================================================================
-- 4. POLÍTICAS: CATÁLOGO Y DECLARACIONES
-- ==============================================================================

-- ÁREAS, TIPOS DE CASO, TÉRMINOS: Lectura pública. Admins pueden modificar.
CREATE POLICY "Lectura publica catalogo" ON public.areas_juridicas FOR SELECT USING (true);
CREATE POLICY "Admins gestionan areas" ON public.areas_juridicas FOR ALL USING (es_admin());

CREATE POLICY "Lectura publica tipos caso" ON public.tipos_caso FOR SELECT USING (true);
CREATE POLICY "Admins gestionan tipos caso" ON public.tipos_caso FOR ALL USING (es_admin());

CREATE POLICY "Lectura publica relacion area_caso" ON public.area_tipo_caso FOR SELECT USING (true);
CREATE POLICY "Admins gestionan relacion area_caso" ON public.area_tipo_caso FOR ALL USING (es_admin());

CREATE POLICY "Lectura publica terminos" ON public.terminos_busqueda FOR SELECT USING (true);
CREATE POLICY "Admins gestionan terminos" ON public.terminos_busqueda FOR ALL USING (es_admin());

CREATE POLICY "Lectura publica termino_area" ON public.termino_area FOR SELECT USING (true);
CREATE POLICY "Admins gestionan termino_area" ON public.termino_area FOR ALL USING (es_admin());

CREATE POLICY "Lectura publica termino_tipo_caso" ON public.termino_tipo_caso FOR SELECT USING (true);
CREATE POLICY "Admins gestionan termino_tipo_caso" ON public.termino_tipo_caso FOR ALL USING (es_admin());

-- PERFIL_AREA y PERFIL_TIPO_CASO: Lectura pública. Edición por dueños o admins.
CREATE POLICY "Lectura publica perfil_area" ON public.perfil_area FOR SELECT USING (true);
CREATE POLICY "Dueños o admins gestionan perfil_area" ON public.perfil_area FOR ALL 
USING (es_dueno_perfil(perfil_id) OR es_admin());

CREATE POLICY "Lectura publica perfil_tipo_caso" ON public.perfil_tipo_caso FOR SELECT USING (true);
CREATE POLICY "Dueños o admins gestionan perfil_tipo_caso" ON public.perfil_tipo_caso FOR ALL 
USING (es_dueno_perfil(perfil_id) OR es_admin());

-- ==============================================================================
-- 5. POLÍTICAS: CONTACTO Y COMUNICACIÓN
-- ==============================================================================

-- SOLICITUDES CONTACTO: Visibles por ciudadano emisor, abogado receptor y admin.
CREATE POLICY "Ver solicitudes como participante o admin" ON public.solicitudes_contacto FOR SELECT 
USING (ciudadano_id = auth.uid() OR es_dueno_perfil(abogado_perfil_id) OR es_admin());

CREATE POLICY "Ciudadanos insertan sus solicitudes" ON public.solicitudes_contacto FOR INSERT 
WITH CHECK (ciudadano_id = auth.uid());

CREATE POLICY "Participantes o admins actualizan solicitudes" ON public.solicitudes_contacto FOR UPDATE 
USING (ciudadano_id = auth.uid() OR es_dueno_perfil(abogado_perfil_id) OR es_admin());

-- ORIENTACIONES: Visibles por emisor/receptor de la solicitud. Abogados insertan/actualizan.
CREATE POLICY "Ver orientaciones como participante o admin" ON public.orientaciones FOR SELECT 
USING (es_participante_solicitud(solicitud_id) OR es_admin());

CREATE POLICY "Abogados insertan/actualizan orientaciones" ON public.orientaciones FOR ALL 
USING (es_participante_solicitud(solicitud_id));

-- CONVERSACIONES: Visibles por participantes.
CREATE POLICY "Ver conversaciones como participante o admin" ON public.conversaciones FOR SELECT 
USING (es_participante_solicitud(solicitud_id) OR es_admin());

-- MENSAJES TEXTO: Visibles por participantes. Solo autor inserta.
CREATE POLICY "Ver mensajes como participante o admin" ON public.mensajes_texto FOR SELECT 
USING (es_participante_solicitud((SELECT solicitud_id FROM public.conversaciones WHERE id = conversacion_id)) OR es_admin());

CREATE POLICY "Autores insertan sus mensajes" ON public.mensajes_texto FOR INSERT 
WITH CHECK (autor_id = auth.uid() AND es_participante_solicitud((SELECT solicitud_id FROM public.conversaciones WHERE id = conversacion_id)));

-- NOTIFICACIONES: Solo visibles y gestionadas por el destinatario o admins.
CREATE POLICY "Ver notificaciones propias o admin" ON public.notificaciones FOR SELECT 
USING (destinatario_id = auth.uid() OR es_admin());

CREATE POLICY "Actualizar notificaciones propias o admin" ON public.notificaciones FOR UPDATE 
USING (destinatario_id = auth.uid() OR es_admin());