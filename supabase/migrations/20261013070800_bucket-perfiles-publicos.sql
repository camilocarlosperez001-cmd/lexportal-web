-- ==============================================================================
-- FOTOGRAFÍA PÚBLICA DEL PERFIL (CU 08 y CU 19)
-- ==============================================================================
-- El esquema sólo declaraba el bucket privado `evidencias-privadas`, cuyo acceso de
-- lectura está reservado al titular y a la administración. La fotografía autorizada
-- en `perfiles_abogados.foto_publica` forma parte del perfil público (CU 08), así que
-- no puede servirse desde ese bucket: un visitante anónimo no puede firmar su lectura
-- y vería una imagen rota.
-- Se crea un bucket público independiente para imágenes de perfil. Las evidencias de
-- verificación siguen en el bucket privado y no se mezclan con material publicable.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'perfiles-publicos',
  'perfiles-publicos',
  true, -- lectura pública: es material que el abogado autorizó publicar
  5242880, -- 5 MB por imagen
  ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Políticas de acceso: cualquiera puede leer; sólo el titular escribe en su carpeta.
DROP POLICY IF EXISTS "perfiles_publicos_lectura" ON storage.objects;
DROP POLICY IF EXISTS "perfiles_publicos_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "perfiles_publicos_update_own" ON storage.objects;
DROP POLICY IF EXISTS "perfiles_publicos_delete_own" ON storage.objects;

CREATE POLICY "perfiles_publicos_lectura"
ON storage.objects
FOR SELECT
USING (bucket_id = 'perfiles-publicos');

CREATE POLICY "perfiles_publicos_insert_own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'perfiles-publicos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.cuentas c
    WHERE c.id = auth.uid() AND c.rol = 'abogado'::rol_cuenta
  )
);

CREATE POLICY "perfiles_publicos_update_own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'perfiles-publicos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "perfiles_publicos_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'perfiles-publicos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
