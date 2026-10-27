-- Los usuarios importados por SQL pueden tener NULL en campos que GoTrue lee
-- como string. Normalizar únicamente su representación vacía; no confirmar
-- correos, cambiar contraseñas, invalidar tokens presentes ni modificar roles.
-- https://supabase.com/docs/guides/troubleshooting/scan-error-on-column-confirmation_token-converting-null-to-string-is-unsupported-during-auth-login-a0c686
DO $$
DECLARE
  antes jsonb;
  despues jsonb;
BEGIN
  SELECT jsonb_agg(to_jsonb(u) - ARRAY['confirmation_token','recovery_token','email_change_token_new','email_change'] ORDER BY id)
  INTO antes FROM auth.users u;

  UPDATE auth.users
  SET confirmation_token = coalesce(confirmation_token, ''),
      recovery_token = coalesce(recovery_token, ''),
      email_change_token_new = coalesce(email_change_token_new, ''),
      email_change = coalesce(email_change, '')
  WHERE confirmation_token IS NULL OR recovery_token IS NULL
     OR email_change_token_new IS NULL OR email_change IS NULL;

  SELECT jsonb_agg(to_jsonb(u) - ARRAY['confirmation_token','recovery_token','email_change_token_new','email_change'] ORDER BY id)
  INTO despues FROM auth.users u;
  IF antes IS DISTINCT FROM despues THEN
    RAISE EXCEPTION 'La normalización modificó otros datos de Auth; se cancela.';
  END IF;
END;
$$;
