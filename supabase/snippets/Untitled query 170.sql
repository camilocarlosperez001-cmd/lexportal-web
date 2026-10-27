SELECT e.extname, n.nspname AS esquema_extension, e.extversion
FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname = 'pg_net';

SELECT n.nspname AS esquema, p.proname, pg_get_function_arguments(p.oid) AS firma
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'http_post' ORDER BY n.nspname;

DROP EXTENSION pg_net;   -- puede fallar por dependencias
CREATE EXTENSION pg_net; -- sin WITH SCHEMA: la extensión declara `net`

CREATE EXTENSION IF NOT EXISTS pg_net;