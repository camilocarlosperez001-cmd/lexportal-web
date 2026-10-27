-- ==============================================================================
-- ORIENTACIONES: SOLO EL ABOGADO DESTINATARIO REGISTRA LA ORIENTACIÓN (CU 20)
-- ==============================================================================
-- La política anterior («Abogados insertan/actualizan orientaciones», FOR ALL con
-- es_participante_solicitud) también autorizaba al ciudadano propietario a escribir
-- o modificar la orientación de su propia solicitud. La orientación la registra el
-- abogado destinatario; el ciudadano únicamente la consulta.

DROP POLICY IF EXISTS "Abogados insertan/actualizan orientaciones" ON public.orientaciones;

CREATE POLICY "Abogado destinatario gestiona orientaciones" ON public.orientaciones
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.solicitudes_contacto s
    JOIN public.perfiles_abogados p ON p.id = s.abogado_perfil_id
    WHERE s.id = solicitud_id
      AND p.cuenta_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.solicitudes_contacto s
    JOIN public.perfiles_abogados p ON p.id = s.abogado_perfil_id
    WHERE s.id = solicitud_id
      AND p.cuenta_id = auth.uid()
  )
);
