-- ==============================================================================
-- LECTURA AUTORIZADA DE LAS FOTOGRAFÍAS DE PERFIL (CU 08 y CU 19)
-- ==============================================================================
-- El bucket `perfiles-publicos` deja de ser público. La imagen se entrega solo con
-- `storage.from('perfiles-publicos').download(ruta)` bajo RLS, y el cliente la representa
-- con una URL local revocable que se revoca al desmontar. No se persisten URLs firmadas:
-- seguirían dando acceso hasta su vencimiento después de retirar el consentimiento.
--
-- La política anterior (`perfiles_publicos_lectura`) permitía leer CUALQUIER objeto del
-- bucket, incluidas las fotografías de perfiles no publicados, ocultos, inactivos o sin
-- verificación. Se sustituye por la regla que exige las cuatro condiciones del directorio
-- —publicación, actividad, verificación aprobada y consentimiento del campo— y conserva
-- el acceso del titular a su propia imagen aunque el perfil no esté publicado.
--
-- `foto_publica` guarda desde ahora la ruta relativa del objeto; las altas anteriores
-- guardaron la URL pública completa. La condición contempla ambas formas.

UPDATE storage.buckets
SET public = false
WHERE id = 'perfiles-publicos';

DROP POLICY IF EXISTS "perfiles_publicos_lectura" ON storage.objects;

CREATE POLICY "perfiles_publicos_lectura"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'perfiles-publicos'
  AND (
    -- El titular ve su fotografía aunque el perfil no esté publicado.
    owner = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.perfiles_abogados p
      WHERE p.visibilidad = 'publico'
        AND p.activo
        AND p.version_aprobada_id IS NOT NULL
        AND lower(btrim(coalesce(p.campos_opcionales_publicos ->> 'foto_publica', ''))) IN ('true', 't')
        AND (
          p.foto_publica = storage.objects.name
          OR split_part(p.foto_publica, '/perfiles-publicos/', 2) = storage.objects.name
        )
    )
  )
);

-- Nota: la política de SELECT ya no depende de que el bucket sea público, así que
-- mantener `public = false` no rompe la lectura autorizada; solo impide el acceso por
-- la ruta `/object/public/`, que ya no se usa en la aplicación.
