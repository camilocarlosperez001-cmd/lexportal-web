-- ==============================================================================
-- DIAGNÓSTICO DEL ALTA PROFESIONAL (CU 02)
-- ==============================================================================
-- Ejecuta los pasos en orden en el SQL Editor de Supabase (o con `psql`).
-- Sustituye el correo del paso 3 por el de la cuenta profesional que no obtuvo perfil.

-- ------------------------------------------------------------------------------
-- 1. ¿Está instalada la versión del trigger que crea el perfil?
--    Si el cuerpo NO menciona `crear_perfil_profesional_desde_metadatos`, la migración
--    20261013071000 no llegó a aplicarse (o se aplicó otra anterior).
-- ------------------------------------------------------------------------------
SELECT p.proname,
       pg_get_functiondef(p.oid) AS definicion
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('handle_new_user', 'crear_perfil_profesional_desde_metadatos');

-- ------------------------------------------------------------------------------
-- 2. ¿Está el trigger enganchado a auth.users y habilitado?
-- ------------------------------------------------------------------------------
SELECT t.tgname,
       t.tgenabled,
       pg_get_triggerdef(t.oid) AS definicion
FROM pg_trigger t
WHERE t.tgrelid = 'auth.users'::regclass
  AND NOT t.tgisinternal;

-- ------------------------------------------------------------------------------
-- 3. ¿Qué metadatos guardó el servidor en el registro?
--    - `tipo_metadatos_perfil` debe ser `object`.
--    - `experiencia_valida` debe ser true.
--    - Si `tipo_metadatos_perfil` es `null` o `null` (jsonb), el cliente no envió los
--      datos profesionales: revisa que el asistente sea la versión actual.
-- ------------------------------------------------------------------------------
SELECT u.id,
       u.email,
       u.created_at,
       u.raw_user_meta_data->>'rol'                                        AS rol,
       jsonb_typeof(u.raw_user_meta_data->'perfil_profesional')            AS tipo_metadatos_perfil,
       btrim(COALESCE(u.raw_user_meta_data->'perfil_profesional'->>'nombre_profesional', '')) AS nombre,
       length(btrim(COALESCE(u.raw_user_meta_data->'perfil_profesional'->>'descripcion', ''))) AS largo_descripcion,
       btrim(COALESCE(u.raw_user_meta_data->'perfil_profesional'->>'ciudad_atencion', ''))    AS ciudad,
       u.raw_user_meta_data->'perfil_profesional'->>'experiencia_anios'    AS experiencia,
       (u.raw_user_meta_data->'perfil_profesional'->>'experiencia_anios') ~ '^[0-9]+$' AS experiencia_valida,
       (u.raw_user_meta_data->'perfil_profesional'->'areas') IS NOT NULL  AS trae_areas,
       jsonb_array_length(COALESCE(u.raw_user_meta_data->'perfil_profesional'->'areas', '[]'::jsonb)) AS num_areas,
       jsonb_array_length(COALESCE(u.raw_user_meta_data->'perfil_profesional'->'tipos_caso', '[]'::jsonb)) AS num_tipos,
       btrim(COALESCE(u.raw_user_meta_data->'perfil_profesional'->>'identificacion_privada', '')) <> '' AS trae_identificacion,
       btrim(COALESCE(u.raw_user_meta_data->'perfil_profesional'->>'tarjeta_profesional', '')) <> ''   AS trae_tarjeta
FROM auth.users u
WHERE u.email = 'CORREO_DEL_ABOGADO@ejemplo.com';

-- ------------------------------------------------------------------------------
-- 3.b Claves realmente enviadas dentro de los metadatos del perfil.
--     Sirve para cuentas registradas antes de que existiera la tabla de diagnóstico:
--     si aparecen `nombreProfesional`, `areaIds`, etc., el cliente usaba camelCase y
--     la migración 20261013071200 (que acepta ambos nombres) es la que lo resuelve.
-- ------------------------------------------------------------------------------
SELECT u.email,
       clave,
       jsonb_typeof(u.raw_user_meta_data->'perfil_profesional'->clave) AS tipo,
       left(u.raw_user_meta_data->'perfil_profesional'->>clave, 60)     AS valor
FROM auth.users u
CROSS JOIN LATERAL jsonb_object_keys(u.raw_user_meta_data->'perfil_profesional') AS clave
WHERE u.raw_user_meta_data->>'rol' = 'abogado'
ORDER BY u.created_at DESC, clave;

-- ------------------------------------------------------------------------------
-- 4. ¿Qué dijo el trigger? (requiere la migración 20261013071000)
--    `resultado` explica el motivo: sin_metadatos_perfil, datos_incompletos:<campos>,
--    creado, perfil_existente...
-- ------------------------------------------------------------------------------
SELECT d.creada_en, d.cuenta_id, d.resultado, d.detalle, c.correo, c.rol
FROM public.altas_profesionales_diagnostico d
LEFT JOIN public.cuentas c ON c.id = d.cuenta_id
ORDER BY d.creada_en DESC
LIMIT 20;

-- ------------------------------------------------------------------------------
-- 5. ¿Existe ya el perfil? (la cuenta puede existir sin perfil)
-- ------------------------------------------------------------------------------
SELECT c.correo, c.rol, c.creada_en,
       p.id AS perfil_id, p.nombre_profesional, p.visibilidad,
       p.version_aprobada_id,
       (SELECT count(*) FROM public.versiones_profesionales v WHERE v.perfil_id = p.id) AS versiones,
       (SELECT count(*) FROM public.perfil_area pa WHERE pa.perfil_id = p.id)           AS areas,
       (SELECT count(*) FROM public.perfil_tipo_caso pt WHERE pt.perfil_id = p.id)      AS tipos
FROM public.cuentas c
LEFT JOIN public.perfiles_abogados p ON p.cuenta_id = c.id
WHERE c.rol = 'abogado'
ORDER BY c.creada_en DESC
LIMIT 20;

-- ------------------------------------------------------------------------------
-- 6. Prueba y REPROCESO (idempotente).
--    Vuelve a ejecutar la creación del perfil con los metadatos ya guardados; sirve
--    para las altas anteriores a la migración y devuelve el motivo si algo falta.
--    No publica nada: el perfil queda 'oculto' y sin verificación aprobada.
-- ------------------------------------------------------------------------------
SELECT u.email,
       public.crear_perfil_profesional_desde_metadatos(
         u.id,
         u.raw_user_meta_data->'perfil_profesional'
       ) AS resultado
FROM auth.users u
WHERE u.raw_user_meta_data->>'rol' = 'abogado'
ORDER BY u.created_at DESC
LIMIT 20;

-- ------------------------------------------------------------------------------
-- 7. Avisos por correo: extensión, triggers y resultado del despacho.
--    `schema "net" does not exist` (3F000) significa que pg_net quedó instalada en
--    otro esquema; lo resuelve la migración 20261013071300.
-- ------------------------------------------------------------------------------
SELECT extname, extnamespace::regnamespace AS esquema
FROM pg_extension
WHERE extname IN ('pg_net', 'pg_cron');

SELECT n.nspname AS esquema, p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('net', 'extensions') AND p.proname LIKE 'http%';

SELECT t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) AS definicion
FROM pg_trigger t
WHERE t.tgrelid = 'public.notificaciones'::regclass AND NOT t.tgisinternal;

-- `estado_aviso_correo`: pendiente (en cola), enviado, fallido o no_aplica (preferencia
-- desactivada). Un `fallido` aquí no afecta a la decisión registrada.
SELECT id, destinatario_id, evento, estado_aviso_correo, creada_en, leida_en
FROM public.notificaciones
ORDER BY creada_en DESC
LIMIT 15;


-- ¿Dónde vive realmente http_post? Si está en `extensions` y no en `net`, la migración
-- 20261013071700 lo invoca igualmente; para dejarlo en el esquema canónico:
--   CREATE EXTENSION pg_net;   -- (crea el esquema `net`)
SELECT e.extname, n.nspname AS esquema_extension, e.extversion
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname = 'pg_net';

SELECT n.nspname AS esquema, p.proname, pg_get_function_arguments(p.oid) AS firma
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'http_post'
ORDER BY n.nspname;

-- ------------------------------------------------------------------------------
-- 8. Avisos por mensaje nuevo: trigger instalado y entrega real del correo.
--    OJO: `net.http_post` es asíncrono. Que la inserción no falle NO significa que el
--    correo se haya enviado: el resultado de la llamada HTTP queda en net._http_response
--    y, si la Edge Function no está sirviéndose, el aviso se queda en 'pendiente'.
-- ------------------------------------------------------------------------------
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'public.mensajes_texto'::regclass AND NOT tgisinternal;

-- ¿Está la versión con la regla de un aviso sin leer por conversación?
SELECT p.proname,
       position('leida_en IS NULL' in pg_get_functiondef(p.oid)) > 0 AS tiene_regla_antiduplicado
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'notificar_mensaje_nuevo';

-- Últimos avisos de mensaje: `pendiente` con el correo ya enviado no existe; si se
-- quedan en `pendiente` indefinidamente, la función Edge no estaba corriendo.
SELECT id, destinatario_id, solicitud_contacto_id, mensaje_id,
       estado_aviso_correo, creada_en, leida_en
FROM public.notificaciones
WHERE evento = 'nuevo_mensaje'
ORDER BY creada_en DESC
LIMIT 10;

-- Resultado de las últimas llamadas HTTP del webhook (pg_net). `content` trae lo que
-- respondió la Edge Function: si falló, el motivo exacto que devolvió.
SELECT id, status_code, error_msg, left(content, 400) AS respuesta, created
FROM net._http_response
ORDER BY created DESC
LIMIT 5;



-- Diagnóstico del encolado y del desenlace (migraciones 20261013071600 y 20261013071700).
-- `resultado`: encolado -> la petición salió; entregado -> la Edge Function la envió;
-- no_aplica -> el destinatario tiene los correos desactivados; error -> no se encoló
-- (lo anota el trigger) o falló el envío (lo anota la función, con el motivo en detalle).
--
-- Pista útil: un `encolado` sin fila de desenlace posterior significa que la Edge
-- Function no estaba corriendo cuando se encoló la petición (su contenedor se cerró, por
-- ejemplo con `exit 15`); el aviso se queda en 'pendiente' porque nadie lo actualiza.
SELECT d.creado_en, d.resultado, d.detalle, d.notificacion_id, n.evento, n.estado_aviso_correo
FROM public.avisos_correo_diagnostico d
LEFT JOIN public.notificaciones n ON n.id = d.notificacion_id
ORDER BY d.creado_en DESC
LIMIT 10;

SELECT e.extname, n.nspname AS esquema_extension, e.extversion
FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname = 'pg_net';

SELECT n.nspname AS esquema, p.proname, pg_get_function_arguments(p.oid) AS firma
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'http_post' ORDER BY n.nspname;

DROP EXTENSION pg_net;   -- puede fallar por dependencias
CREATE EXTENSION pg_net; -- sin WITH SCHEMA: la extensión declara `net`

SELECT * FROM public.notificaciones;
-- Para desbloquear una prueba: un aviso sin leer suprime los siguientes de esa misma
-- conversación (regla de la migración 20261013071500). Márcalo como leído y el
-- próximo mensaje volverá a avisar.
UPDATE public.notificaciones SET leida_en = now() WHERE id = '62224f6a-4d28-4b9a-a4fc-759a3cba7ff3';

-- ------------------------------------------------------------------------------
-- 9. Campos NOT NULL de perfiles_abogados: los que el asistente debe enviar siempre
--     en los metadatos. Si el paso 6 devolvió `datos_incompletos:<campos>`, el que
--     falte estará en esta lista.
-- ------------------------------------------------------------------------------
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'perfiles_abogados'
  AND is_nullable = 'NO'
ORDER BY ordinal_position;
