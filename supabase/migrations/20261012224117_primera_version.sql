-- ==============================================================================
-- MODELO RELACIONAL PARA SUPABASE (POSTGRESQL)
-- ==============================================================================

-- 1. CREACIÓN DE TIPOS ENUM (Valores de ejemplo, ajustables a tu lógica de negocio)
CREATE TYPE rol_cuenta AS ENUM ('ciudadano', 'abogado', 'administrador');
CREATE TYPE estado_cuenta AS ENUM ('activa', 'suspendida', 'inactiva');
CREATE TYPE tipo_doc_legal AS ENUM ('terminos_condiciones', 'politica_privacidad', 'tratamiento_datos');
CREATE TYPE tipo_peticion_priv AS ENUM ('acceso', 'rectificacion', 'cancelacion', 'oposicion');
CREATE TYPE estado_peticion_priv AS ENUM ('pendiente', 'en_proceso', 'resuelta');
CREATE TYPE visibilidad_perfil AS ENUM ('publico', 'oculto');
CREATE TYPE estado_revision_prof AS ENUM ('pendiente', 'en_revision', 'aprobada', 'rechazada');
CREATE TYPE tipo_revision_prof AS ENUM ('inicial', 'revalidacion', 'reporte');
CREATE TYPE estado_solicitud AS ENUM ('pendiente', 'aceptada', 'rechazada', 'cancelada');
CREATE TYPE evento_noti AS ENUM ('nueva_solicitud', 'nuevo_mensaje', 'revision_resuelta', 'privacidad_resuelta');
CREATE TYPE estado_envio_correo AS ENUM ('no_aplica', 'pendiente', 'enviado', 'fallido');

-- ==============================================================================
-- PAQUETE: IDENTIDAD Y PRIVACIDAD
-- ==============================================================================

CREATE TABLE public.cuentas (
    id uuid NOT NULL, -- PK y FK hacia auth.users
    nombre_completo text NOT NULL,
    correo text NOT NULL UNIQUE,
    telefono text,
    rol rol_cuenta NOT NULL,
    estado estado_cuenta NOT NULL,
    avisos_correo boolean NOT NULL DEFAULT true,
    creada_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT cuentas_pkey PRIMARY KEY (id),
    CONSTRAINT cuentas_auth_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.documentos_legales (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tipo tipo_doc_legal NOT NULL,
    version text NOT NULL,
    referencia_contenido text NOT NULL, -- Ej: URL de storage o contenido en markdown
    publicada_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT documentos_legales_pkey PRIMARY KEY (id),
    CONSTRAINT uq_tipo_version UNIQUE (tipo, version)
);

CREATE TABLE public.aceptaciones_legales (
    cuenta_id uuid NOT NULL,
    documento_id uuid NOT NULL,
    aceptada_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT aceptaciones_legales_pkey PRIMARY KEY (cuenta_id, documento_id),
    CONSTRAINT aceptaciones_legales_cuenta_fk FOREIGN KEY (cuenta_id) REFERENCES public.cuentas(id) ON DELETE CASCADE,
    CONSTRAINT aceptaciones_legales_doc_fk FOREIGN KEY (documento_id) REFERENCES public.documentos_legales(id) ON DELETE CASCADE
);

CREATE TABLE public.solicitudes_privacidad (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    titular_id uuid NOT NULL,
    tipo tipo_peticion_priv NOT NULL,
    estado estado_peticion_priv NOT NULL DEFAULT 'pendiente',
    solicitada_en timestamptz NOT NULL DEFAULT now(),
    responsable_id uuid, -- Opcional, admin que resuelve
    respuesta text,
    resuelta_en timestamptz,
    medidas_aplicadas text,
    CONSTRAINT solicitudes_privacidad_pkey PRIMARY KEY (id),
    CONSTRAINT sol_priv_titular_fk FOREIGN KEY (titular_id) REFERENCES public.cuentas(id) ON DELETE CASCADE,
    CONSTRAINT sol_priv_responsable_fk FOREIGN KEY (responsable_id) REFERENCES public.cuentas(id) ON DELETE SET NULL
);

-- ==============================================================================
-- PAQUETE: PERFIL Y VERIFICACIÓN
-- ==============================================================================

CREATE TABLE public.perfiles_abogados (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    cuenta_id uuid NOT NULL UNIQUE,
    nombre_profesional text NOT NULL,
    descripcion text NOT NULL,
    experiencia_anios integer NOT NULL,
    ciudad_atencion text NOT NULL,
    activo boolean NOT NULL DEFAULT true,
    visibilidad visibilidad_perfil NOT NULL DEFAULT 'oculto',
    version_aprobada_id uuid, -- FK se añade al final para evitar dependencia circular
    fecha_verificacion_vigente timestamptz,
    alcance_verificacion_vigente text,
    formacion_declarada text,
    foto_publica text,
    modalidad text,
    horarios text,
    tarifas_orientativas text,
    medios_contacto jsonb,
    campos_opcionales_publicos jsonb NOT NULL DEFAULT '{}'::jsonb,
    motivo_suspension text,
    suspendido_en timestamptz,
    CONSTRAINT perfiles_abogados_pkey PRIMARY KEY (id),
    CONSTRAINT perfil_cuenta_fk FOREIGN KEY (cuenta_id) REFERENCES public.cuentas(id) ON DELETE CASCADE
);

CREATE TABLE public.versiones_profesionales (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    perfil_id uuid NOT NULL,
    numero_version integer NOT NULL,
    identificacion_privada text NOT NULL,
    tarjeta_profesional text NOT NULL,
    estado_revision estado_revision_prof NOT NULL DEFAULT 'pendiente',
    presentada_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT versiones_profesionales_pkey PRIMARY KEY (id),
    CONSTRAINT vers_prof_perfil_fk FOREIGN KEY (perfil_id) REFERENCES public.perfiles_abogados(id) ON DELETE CASCADE,
    CONSTRAINT uq_perfil_version UNIQUE (perfil_id, numero_version),
    CONSTRAINT uq_perfil_id UNIQUE (perfil_id, id) -- REQUERIDO para la FK compuesta desde perfiles_abogados
);

-- RESOLUCIÓN DE LA RELACIÓN CIRCULAR (Versión Vigente Aprobada)
-- Garantiza que la versión aprobada en el perfil pertenezca a ese mismo perfil
ALTER TABLE public.perfiles_abogados
    ADD CONSTRAINT perfil_version_aprobada_fk 
    FOREIGN KEY (id, version_aprobada_id) 
    REFERENCES public.versiones_profesionales(perfil_id, id) ON DELETE SET NULL;

CREATE TABLE public.evidencias_privadas (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    version_id uuid NOT NULL,
    tipo text NOT NULL,
    ruta_storage_privada text NOT NULL,
    aportada_en timestamptz NOT NULL DEFAULT now(),
    retener_hasta timestamptz,
    CONSTRAINT evidencias_privadas_pkey PRIMARY KEY (id),
    CONSTRAINT evid_version_fk FOREIGN KEY (version_id) REFERENCES public.versiones_profesionales(id) ON DELETE CASCADE
);

CREATE TABLE public.revisiones_profesionales (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    version_id uuid NOT NULL,
    tipo tipo_revision_prof NOT NULL,
    estado estado_revision_prof NOT NULL DEFAULT 'pendiente',
    programada_en timestamptz,
    responsable_id uuid,
    fuente_oficial text,
    resultado_consulta text,
    consultada_en timestamptz,
    decision text,
    motivo text,
    alcance text,
    decidida_en timestamptz,
    proxima_revision timestamptz,
    CONSTRAINT revisiones_prof_pkey PRIMARY KEY (id),
    CONSTRAINT rev_version_fk FOREIGN KEY (version_id) REFERENCES public.versiones_profesionales(id) ON DELETE CASCADE,
    CONSTRAINT rev_responsable_fk FOREIGN KEY (responsable_id) REFERENCES public.cuentas(id) ON DELETE SET NULL
);

CREATE TABLE public.politica_revalidacion (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    periodicidad_dias integer NOT NULL,
    vigente_desde timestamptz NOT NULL DEFAULT now(),
    configurada_por uuid NOT NULL,
    CONSTRAINT pol_rev_pkey PRIMARY KEY (id),
    CONSTRAINT pol_rev_config_fk FOREIGN KEY (configurada_por) REFERENCES public.cuentas(id)
);

-- ==============================================================================
-- PAQUETE: CATÁLOGO Y DECLARACIONES
-- ==============================================================================

CREATE TABLE public.areas_juridicas (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    nombre text NOT NULL UNIQUE,
    activa boolean NOT NULL DEFAULT true,
    CONSTRAINT areas_juridicas_pkey PRIMARY KEY (id)
);

CREATE TABLE public.tipos_caso (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    nombre_cotidiano text NOT NULL UNIQUE,
    activo boolean NOT NULL DEFAULT true,
    CONSTRAINT tipos_caso_pkey PRIMARY KEY (id)
);

CREATE TABLE public.area_tipo_caso (
    area_id uuid NOT NULL,
    tipo_caso_id uuid NOT NULL,
    CONSTRAINT at_pkey PRIMARY KEY (area_id, tipo_caso_id),
    CONSTRAINT at_area_fk FOREIGN KEY (area_id) REFERENCES public.areas_juridicas(id) ON DELETE CASCADE,
    CONSTRAINT at_tipo_fk FOREIGN KEY (tipo_caso_id) REFERENCES public.tipos_caso(id) ON DELETE CASCADE
);

CREATE TABLE public.terminos_busqueda (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    texto text NOT NULL UNIQUE,
    activo boolean NOT NULL DEFAULT true,
    CONSTRAINT terminos_busqueda_pkey PRIMARY KEY (id)
);

CREATE TABLE public.termino_area (
    termino_id uuid NOT NULL,
    area_id uuid NOT NULL,
    CONSTRAINT ta_pkey PRIMARY KEY (termino_id, area_id),
    CONSTRAINT ta_term_fk FOREIGN KEY (termino_id) REFERENCES public.terminos_busqueda(id) ON DELETE CASCADE,
    CONSTRAINT ta_area_fk FOREIGN KEY (area_id) REFERENCES public.areas_juridicas(id) ON DELETE CASCADE
);

CREATE TABLE public.termino_tipo_caso (
    termino_id uuid NOT NULL,
    tipo_caso_id uuid NOT NULL,
    CONSTRAINT tt_pkey PRIMARY KEY (termino_id, tipo_caso_id),
    CONSTRAINT tt_term_fk FOREIGN KEY (termino_id) REFERENCES public.terminos_busqueda(id) ON DELETE CASCADE,
    CONSTRAINT tt_tipo_fk FOREIGN KEY (tipo_caso_id) REFERENCES public.tipos_caso(id) ON DELETE CASCADE
);

CREATE TABLE public.perfil_area (
    perfil_id uuid NOT NULL,
    area_id uuid NOT NULL,
    CONSTRAINT pa_pkey PRIMARY KEY (perfil_id, area_id),
    CONSTRAINT pa_perfil_fk FOREIGN KEY (perfil_id) REFERENCES public.perfiles_abogados(id) ON DELETE CASCADE,
    CONSTRAINT pa_area_fk FOREIGN KEY (area_id) REFERENCES public.areas_juridicas(id) ON DELETE CASCADE
);

CREATE TABLE public.perfil_tipo_caso (
    perfil_id uuid NOT NULL,
    tipo_caso_id uuid NOT NULL,
    CONSTRAINT pt_pkey PRIMARY KEY (perfil_id, tipo_caso_id),
    CONSTRAINT pt_perfil_fk FOREIGN KEY (perfil_id) REFERENCES public.perfiles_abogados(id) ON DELETE CASCADE,
    CONSTRAINT pt_tipo_fk FOREIGN KEY (tipo_caso_id) REFERENCES public.tipos_caso(id) ON DELETE CASCADE
);

-- ==============================================================================
-- PAQUETE: CONTACTO Y COMUNICACIÓN
-- ==============================================================================

CREATE TABLE public.solicitudes_contacto (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    ciudadano_id uuid NOT NULL,
    abogado_perfil_id uuid NOT NULL,
    tipo_caso_id uuid, -- Opcional, dependiendo de sin_clasificar
    sin_clasificar boolean NOT NULL,
    clasificacion_al_enviar jsonb NOT NULL,
    descripcion_breve text NOT NULL,
    ayuda_buscada text NOT NULL,
    estado estado_solicitud NOT NULL DEFAULT 'pendiente',
    enviada_en timestamptz NOT NULL DEFAULT now(),
    decidida_en timestamptz,
    cancelada_en timestamptz,
    motivo_rechazo text,
    CONSTRAINT sol_contacto_pkey PRIMARY KEY (id),
    CONSTRAINT sol_ciu_fk FOREIGN KEY (ciudadano_id) REFERENCES public.cuentas(id),
    CONSTRAINT sol_abo_fk FOREIGN KEY (abogado_perfil_id) REFERENCES public.perfiles_abogados(id),
    CONSTRAINT sol_tipo_fk FOREIGN KEY (tipo_caso_id) REFERENCES public.tipos_caso(id),
    -- Regla validada en la BD: Si no está clasificada, tipo_caso_id debe ser null. Si está clasificada, no debe ser null.
    CONSTRAINT check_clasificacion CHECK (
        (sin_clasificar = true AND tipo_caso_id IS NULL) OR 
        (sin_clasificar = false AND tipo_caso_id IS NOT NULL)
    )
);

CREATE TABLE public.orientaciones (
    solicitud_id uuid NOT NULL, -- PK y FK (Relación 1 a 1 exacta)
    area_id uuid,
    tipo_caso_id uuid,
    comentario_general text,
    creada_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT orientaciones_pkey PRIMARY KEY (solicitud_id),
    CONSTRAINT ori_sol_fk FOREIGN KEY (solicitud_id) REFERENCES public.solicitudes_contacto(id) ON DELETE CASCADE,
    CONSTRAINT ori_area_fk FOREIGN KEY (area_id) REFERENCES public.areas_juridicas(id),
    CONSTRAINT ori_tipo_fk FOREIGN KEY (tipo_caso_id) REFERENCES public.tipos_caso(id)
);

CREATE TABLE public.conversaciones (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    solicitud_id uuid NOT NULL UNIQUE, -- Garantiza máximo 1 chat por solicitud
    habilitada_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT conversaciones_pkey PRIMARY KEY (id),
    CONSTRAINT chat_sol_fk FOREIGN KEY (solicitud_id) REFERENCES public.solicitudes_contacto(id) ON DELETE CASCADE
);

CREATE TABLE public.mensajes_texto (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    conversacion_id uuid NOT NULL,
    autor_id uuid NOT NULL,
    contenido text NOT NULL,
    enviado_en timestamptz NOT NULL DEFAULT now(),
    retener_hasta timestamptz,
    CONSTRAINT mensajes_pkey PRIMARY KEY (id),
    CONSTRAINT msg_chat_fk FOREIGN KEY (conversacion_id) REFERENCES public.conversaciones(id) ON DELETE CASCADE,
    CONSTRAINT msg_autor_fk FOREIGN KEY (autor_id) REFERENCES public.cuentas(id)
);

CREATE TABLE public.notificaciones (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    destinatario_id uuid NOT NULL,
    evento evento_noti NOT NULL,
    solicitud_contacto_id uuid,
    revision_id uuid,
    mensaje_id uuid,
    solicitud_privacidad_id uuid,
    creada_en timestamptz NOT NULL DEFAULT now(),
    leida_en timestamptz,
    estado_aviso_correo estado_envio_correo NOT NULL DEFAULT 'pendiente',
    CONSTRAINT notificaciones_pkey PRIMARY KEY (id),
    CONSTRAINT noti_dest_fk FOREIGN KEY (destinatario_id) REFERENCES public.cuentas(id) ON DELETE CASCADE,
    CONSTRAINT noti_sol_fk FOREIGN KEY (solicitud_contacto_id) REFERENCES public.solicitudes_contacto(id) ON DELETE CASCADE,
    CONSTRAINT noti_rev_fk FOREIGN KEY (revision_id) REFERENCES public.revisiones_profesionales(id) ON DELETE CASCADE,
    CONSTRAINT noti_msg_fk FOREIGN KEY (mensaje_id) REFERENCES public.mensajes_texto(id) ON DELETE CASCADE,
    CONSTRAINT noti_priv_fk FOREIGN KEY (solicitud_privacidad_id) REFERENCES public.solicitudes_privacidad(id) ON DELETE CASCADE
);