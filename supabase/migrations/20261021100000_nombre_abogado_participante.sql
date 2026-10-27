-- ==============================================================================
-- NOMBRE DEL ABOGADO PARA EL CIUDADANO QUE LE ENVIÓ UNA SOLICITUD (CU 09 y CU 11)
-- ==============================================================================
-- Con la política de `perfiles_abogados` limitada al titular y a la administración, las
-- inclusiones que el ciudadano usaba para mostrar el nombre del abogado en su solicitud y
-- en su conversación devuelven NULL. Mostrar «Perfil ya no disponible» incluso en su
-- propio historial es incorrecto: el ciudadano necesita saber a quién escribió.
--
-- Se expone la proyección mínima —solo el nombre para mostrar— y únicamente a quien
-- participa: el titular del perfil o un ciudadano con al menos una solicitud dirigida a
-- ese perfil. No se amplía la política RLS ni se devuelve ninguna otra columna.
--
-- Es una función `SECURITY DEFINER` (como `private.fotografia_publicable`) para poder
-- leer la fila sin abrirla al cliente; el `search_path` vacío obliga a calificar todo.

CREATE OR REPLACE FUNCTION public.nombres_abogados_participantes(p_perfiles uuid[])
RETURNS TABLE (perfil_id uuid, nombre_profesional text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.nombre_profesional
  FROM public.perfiles_abogados p
  WHERE p.id = ANY (p_perfiles)
    AND (
      -- El titular del perfil.
      p.cuenta_id = (SELECT auth.uid())
      -- O un ciudadano con una solicitud dirigida a ese perfil.
      OR EXISTS (
        SELECT 1
        FROM public.solicitudes_contacto s
        WHERE s.abogado_perfil_id = p.id
          AND s.ciudadano_id = (SELECT auth.uid())
      )
    );
$$;

-- `anon` no la necesita (el directorio público usa la RPC buscar_abogados); se retira su
-- concesión explícita, que Supabase añade por defecto y sobrevive al REVOKE de PUBLIC.
REVOKE ALL ON FUNCTION public.nombres_abogados_participantes(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nombres_abogados_participantes(uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
