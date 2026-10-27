-- ==============================================================================
-- TRANSICIONES SEGURAS DE LA SOLICITUD DE CONTACTO (CU 09 y CU 10)
-- ==============================================================================
-- La versión anterior de cambiar_estado_solicitud verificaba al actor pero no el
-- estado vigente, de modo que una decisión simultánea podía producir dos estados
-- finales. La función exige ahora que la solicitud siga pendiente y que el nuevo
-- estado sea una decisión (aceptada o rechazada).

CREATE OR REPLACE FUNCTION public.cambiar_estado_solicitud(
  p_solicitud_id UUID,
  p_nuevo_estado estado_solicitud,
  p_motivo_rechazo TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_abogado_cuenta_id UUID;
  v_estado_actual estado_solicitud;
BEGIN
  SELECT p.cuenta_id, s.estado
  INTO v_abogado_cuenta_id, v_estado_actual
  FROM public.solicitudes_contacto s
  JOIN public.perfiles_abogados p ON p.id = s.abogado_perfil_id
  WHERE s.id = p_solicitud_id;

  IF v_estado_actual IS NULL THEN
    RAISE EXCEPTION 'La solicitud indicada no existe.';
  END IF;

  IF auth.uid() IS NULL OR auth.uid() <> v_abogado_cuenta_id THEN
    RAISE EXCEPTION 'No tiene permisos para modificar esta solicitud.';
  END IF;

  IF v_estado_actual <> 'pendiente'::estado_solicitud THEN
    RAISE EXCEPTION 'La solicitud ya fue decidida o cancelada; su estado vigente es «%».', v_estado_actual;
  END IF;

  IF p_nuevo_estado NOT IN ('aceptada'::estado_solicitud, 'rechazada'::estado_solicitud) THEN
    RAISE EXCEPTION 'Solo se admite aceptar o rechazar una solicitud pendiente.';
  END IF;

  UPDATE public.solicitudes_contacto
  SET estado = p_nuevo_estado,
      decidida_en = NOW(),
      motivo_rechazo = CASE
        WHEN p_nuevo_estado = 'rechazada'::estado_solicitud
          THEN NULLIF(btrim(COALESCE(p_motivo_rechazo, '')), '')
        ELSE NULL
      END
  WHERE id = p_solicitud_id
    AND estado = 'pendiente'::estado_solicitud;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se pudo registrar la decisión: la solicitud cambió de estado.';
  END IF;
END;
$$;

-- ==============================================================================
-- LA SOLICITUD LA ENVÍA UNA CUENTA DE CIUDADANO (CU 09)
-- ==============================================================================
-- La política anterior sólo exigía ciudadano_id = auth.uid(), lo que permitía a
-- una cuenta profesional insertar solicitudes. La autorización se refuerza en la
-- base de datos y no depende del rol seleccionado en el navegador.

DROP POLICY IF EXISTS "Ciudadanos insertan sus solicitudes" ON public.solicitudes_contacto;
CREATE POLICY "Ciudadanos insertan sus solicitudes" ON public.solicitudes_contacto FOR INSERT
WITH CHECK (
  ciudadano_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.cuentas c
    WHERE c.id = auth.uid() AND c.rol = 'ciudadano'::rol_cuenta
  )
);
