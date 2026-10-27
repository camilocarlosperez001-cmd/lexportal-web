CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DROP TRIGGER IF EXISTS trigger_enviar_correo ON public.notificaciones;

CREATE TRIGGER trigger_enviar_correo
AFTER INSERT ON public.notificaciones
FOR EACH ROW
EXECUTE FUNCTION supabase_functions.http_request(
  'http://host.docker.internal:54321/functions/v1/enviar-correos',
  'POST',
  '{"Content-Type":"application/json", "Authorization":"Bearer sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"}',
  '{}',
  '1000'
);