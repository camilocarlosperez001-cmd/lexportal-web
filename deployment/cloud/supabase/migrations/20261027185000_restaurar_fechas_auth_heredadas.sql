-- GoTrue también requiere fechas no nulas para deserializar los usuarios.
-- Para las altas heredadas incompletas se reutiliza la fecha real de su cuenta;
-- updated_at toma esa base histórica solo cuando tampoco existe una fecha Auth.
-- No se infiere verificación, contraseña, proveedor, metadatos ni permisos.
DO $$
DECLARE
  antes jsonb;
  despues jsonb;
BEGIN
  IF EXISTS (
    SELECT 1 FROM auth.users u LEFT JOIN public.cuentas c ON c.id = u.id
    WHERE (u.created_at IS NULL OR u.updated_at IS NULL) AND c.creada_en IS NULL
  ) THEN
    RAISE EXCEPTION 'No existe una fecha histórica de cuenta para recuperar las fechas Auth.';
  END IF;

  SELECT jsonb_agg(to_jsonb(u) - ARRAY['created_at','updated_at'] ORDER BY id)
  INTO antes FROM auth.users u;

  UPDATE auth.users u
  SET created_at = coalesce(u.created_at, c.creada_en),
      updated_at = coalesce(u.updated_at, u.created_at, c.creada_en)
  FROM public.cuentas c
  WHERE c.id = u.id AND (u.created_at IS NULL OR u.updated_at IS NULL);

  SELECT jsonb_agg(to_jsonb(u) - ARRAY['created_at','updated_at'] ORDER BY id)
  INTO despues FROM auth.users u;
  IF antes IS DISTINCT FROM despues THEN
    RAISE EXCEPTION 'La restauración modificó otros datos de Auth; se cancela.';
  END IF;
END;
$$;
