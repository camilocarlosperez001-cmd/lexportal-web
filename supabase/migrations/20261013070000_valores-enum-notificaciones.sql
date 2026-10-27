-- ==============================================================================
-- EVENTOS DE NOTIFICACIÓN: VALORES DE ENUM REQUERIDOS POR LOS TRIGGERS
-- ==============================================================================
-- Los tipos generados (src/types/supabase.ts) ya declaran 'solicitud_cancelada' y
-- 'perfil_suspendido'. Se aseguran aquí para los entornos creados sólo con las
-- migraciones del repositorio. PostgreSQL 12+ permite ALTER TYPE ... ADD VALUE
-- dentro de una transacción siempre que el valor no se use en la misma transacción.

ALTER TYPE public.evento_noti ADD VALUE IF NOT EXISTS 'solicitud_cancelada';
ALTER TYPE public.evento_noti ADD VALUE IF NOT EXISTS 'perfil_suspendido';
ALTER TYPE public.evento_noti ADD VALUE IF NOT EXISTS 'solicitud_aceptada';
ALTER TYPE public.evento_noti ADD VALUE IF NOT EXISTS 'solicitud_rechazada';

-- Estado de revisión usado al solicitar correcciones al abogado (CU 03).
ALTER TYPE public.estado_revision_prof ADD VALUE IF NOT EXISTS 'requiere_correcciones';

-- Tipos de petición de privacidad previstos en la guía (CU 19).
ALTER TYPE public.tipo_peticion_priv ADD VALUE IF NOT EXISTS 'desactivacion';
ALTER TYPE public.tipo_peticion_priv ADD VALUE IF NOT EXISTS 'supresion';
