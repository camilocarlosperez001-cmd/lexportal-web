-- ==============================================================================
-- 1. VISTA: INDICADORES DE CUENTAS POR ROL (CU 14)
-- ==============================================================================

CREATE OR REPLACE VIEW public.vista_indicadores_cuentas
WITH (security_invoker = on)
AS
SELECT 
    rol, 
    estado, 
    COUNT(*) AS total_cuentas
FROM public.cuentas
GROUP BY rol, estado
ORDER BY rol, estado;

-- ==============================================================================
-- 2. VISTA: ESTADO DE SOLICITUDES DE CONTACTO (CU 14)
-- ==============================================================================

CREATE OR REPLACE VIEW public.vista_indicadores_solicitudes
WITH (security_invoker = on)
AS
SELECT 
    estado, 
    sin_clasificar,
    COUNT(*) AS total_solicitudes
FROM public.solicitudes_contacto
GROUP BY estado, sin_clasificar
ORDER BY total_solicitudes DESC;

-- ==============================================================================
-- 3. VISTA: INDICADORES DE PERFILES VERIFICADOS Y ACTIVOS (CU 14)
-- ==============================================================================

CREATE OR REPLACE VIEW public.vista_indicadores_perfiles
WITH (security_invoker = on)
AS
SELECT 
    visibilidad,
    activo,
    CASE 
        WHEN version_aprobada_id IS NOT NULL THEN 'verificado'
        ELSE 'sin_verificacion_aprobada'
    END AS estado_verificacion,
    COUNT(*) AS total_perfiles
FROM public.perfiles_abogados
GROUP BY 
    visibilidad, 
    activo, 
    CASE WHEN version_aprobada_id IS NOT NULL THEN 'verificado' ELSE 'sin_verificacion_aprobada' END;

-- ==============================================================================
-- 4. VISTA: INDICADORES DEL CATÁLOGO JURÍDICO (CU 17)
-- Muestra el nivel de uso (oferta y demanda) de cada área y tipo de caso
-- ==============================================================================

CREATE OR REPLACE VIEW public.vista_indicadores_catalogo
WITH (security_invoker = on)
AS
-- Bloque 1: Demanda y Oferta de Áreas Jurídicas
SELECT 
    'Área Jurídica' AS categoria,
    a.nombre AS elemento,
    a.activa AS esta_activo,
    COUNT(DISTINCT pa.perfil_id) AS total_perfiles_ofrecen,
    COUNT(DISTINCT o.solicitud_id) AS total_solicitudes_orientadas
FROM public.areas_juridicas a
LEFT JOIN public.perfil_area pa ON a.id = pa.area_id
LEFT JOIN public.orientaciones o ON a.id = o.area_id
GROUP BY a.nombre, a.activa

UNION ALL

-- Bloque 2: Demanda y Oferta de Tipos de Caso
SELECT 
    'Tipo de Caso' AS categoria,
    tc.nombre_cotidiano AS elemento,
    tc.activo AS esta_activo,
    COUNT(DISTINCT ptc.perfil_id) AS total_perfiles_ofrecen,
    COUNT(DISTINCT sc.id) AS total_solicitudes_orientadas
FROM public.tipos_caso tc
LEFT JOIN public.perfil_tipo_caso ptc ON tc.id = ptc.tipo_caso_id
LEFT JOIN public.solicitudes_contacto sc ON tc.id = sc.tipo_caso_id
GROUP BY tc.nombre_cotidiano, tc.activo;