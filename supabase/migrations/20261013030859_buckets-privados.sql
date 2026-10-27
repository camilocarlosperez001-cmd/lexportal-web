-- Crear el bucket de almacenamiento privado
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidencias-privadas', 
  'evidencias-privadas', 
  false, -- Desactiva el acceso público directo sin firmas/políticas
  10485760, -- Límite de 10 MB por archivo
  ARRAY['application/pdf', 'image/jpeg', 'image/png'] -- Formatos permitidos
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =============================================================================
-- POLÍTICAS DE ACCESO PARA SUPABASE STORAGE (storage.objects)
-- =============================================================================

-- Limpiar políticas previas si existen
DROP POLICY IF EXISTS "evidencias_select_own_or_admin" ON storage.objects;
DROP POLICY IF EXISTS "evidencias_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "evidencias_update_own" ON storage.objects;
DROP POLICY IF EXISTS "evidencias_delete_own" ON storage.objects;

-- -----------------------------------------------------------------------------
-- 1. LECTURA (SELECT)
-- Un abogado lee sus propios archivos; un administrador puede leer los de todos.
-- (Usa la función public.es_admin() para simplificar)
-- -----------------------------------------------------------------------------
CREATE POLICY "evidencias_select_own_or_admin"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'evidencias-privadas' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    public.es_admin() -- Función auxiliar creada previamente
  )
);

-- -----------------------------------------------------------------------------
-- 2. CARGA / INSERCIÓN (INSERT)
-- El abogado solo puede subir archivos dentro de su carpeta ({cuenta_id}/*).
-- (Corregido 'rol_usuario' a 'rol_cuenta')
-- -----------------------------------------------------------------------------
CREATE POLICY "evidencias_insert_own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'evidencias-privadas' AND
  (storage.foldername(name))[1] = auth.uid()::text AND
  EXISTS (
    SELECT 1 FROM public.cuentas c
    WHERE c.id = auth.uid() AND c.rol = 'abogado'::rol_cuenta
  )
);

-- -----------------------------------------------------------------------------
-- 3. ACTUALIZACIÓN (UPDATE)
-- Solo el propietario puede modificar metadatos o reemplazar el archivo.
-- -----------------------------------------------------------------------------
CREATE POLICY "evidencias_update_own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'evidencias-privadas' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- -----------------------------------------------------------------------------
-- 4. ELIMINACIÓN (DELETE)
-- Solo el propietario puede eliminar sus evidencias.
-- -----------------------------------------------------------------------------
CREATE POLICY "evidencias_delete_own"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'evidencias-privadas' AND
  (storage.foldername(name))[1] = auth.uid()::text
);