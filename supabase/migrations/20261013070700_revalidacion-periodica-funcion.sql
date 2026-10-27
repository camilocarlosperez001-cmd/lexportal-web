-- ==============================================================================
-- REVALIDACIÓN PERIODICA DE LA VERIFICACIÓN PROFESIONAL (CU 18)
-- ==============================================================================
-- La migración 20261013053224 quedó vacía, pero los tipos generados declaran
-- public.ejecutar_revalidacion_periodica(). Se define aquí la rutina que la
-- administración (o una tarea programada sin sesión) puede ejecutar:
--   1. Toma la periodicidad vigente de politica_revalidacion (la más reciente).
--   2. Busca perfiles visibles cuya verificación aprobada superó esa periodicidad.
--   3. Programa una revisión de tipo 'revalidacion' si no hay una abierta.
--   4. Deja el perfil oculto mientras la revalidación no se resuelva, con motivo
--      registrado; el trigger de avisos comunica la suspensión al abogado (CU 18.5
--      y CU 15). No se inventa ninguna fecha: sin política vigente la función no
--      hace nada.

CREATE OR REPLACE FUNCTION public.ejecutar_revalidacion_periodica()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_periodicidad integer;
  v_perfil record;
  v_suspendidos integer := 0;
BEGIN
  -- Sólo la administración, o un contexto sin sesión (tarea programada del servidor).
  IF auth.uid() IS NOT NULL AND NOT public.es_admin() THEN
    RAISE EXCEPTION 'No tiene permisos para ejecutar la revalidación periódica.';
  END IF;

  SELECT pr.periodicidad_dias INTO v_periodicidad
  FROM public.politica_revalidacion pr
  ORDER BY pr.vigente_desde DESC
  LIMIT 1;

  IF v_periodicidad IS NULL OR v_periodicidad <= 0 THEN
    RETURN;
  END IF;

  FOR v_perfil IN
    SELECT p.id, p.version_aprobada_id
    FROM public.perfiles_abogados p
    WHERE p.visibilidad = 'publico'::visibilidad_perfil
      AND p.activo = true
      AND p.version_aprobada_id IS NOT NULL
      AND p.fecha_verificacion_vigente IS NOT NULL
      AND p.fecha_verificacion_vigente + make_interval(days => v_periodicidad) <= now()
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.revisiones_profesionales r
      WHERE r.version_id = v_perfil.version_aprobada_id
        AND r.tipo = 'revalidacion'::tipo_revision_prof
        AND r.decidida_en IS NULL
    ) THEN
      INSERT INTO public.revisiones_profesionales (
        version_id, tipo, estado, programada_en, proxima_revision
      ) VALUES (
        v_perfil.version_aprobada_id,
        'revalidacion'::tipo_revision_prof,
        'pendiente'::estado_revision_prof,
        now(),
        now()
      );
    END IF;

    UPDATE public.perfiles_abogados
    SET visibilidad = 'oculto'::visibilidad_perfil,
        motivo_suspension = COALESCE(
          motivo_suspension,
          'Revalidación periódica pendiente: la verificación aprobada superó la periodicidad configurada.'
        ),
        suspendido_en = COALESCE(suspendido_en, now())
    WHERE id = v_perfil.id
      AND visibilidad = 'publico'::visibilidad_perfil;

    IF FOUND THEN
      v_suspendidos := v_suspendidos + 1;
    END IF;
  END LOOP;
END;
$$;
