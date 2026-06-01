-- Migration 062 enabled RLS but only added subuser→parent reads.
-- Users (including admins) must read their own rows for the dashboard sidebar.
-- Migration 063 enabled profiles RLS without own-row read (breaks login).

CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

COMMENT ON FUNCTION public.auth_is_admin() IS
  'True when the current authenticated user is an admin. Used by RLS policies.';

DROP POLICY IF EXISTS "user_module_access_select_own" ON public.user_module_access;

CREATE POLICY "user_module_access_select_own" ON public.user_module_access
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

COMMENT ON POLICY "user_module_access_select_own" ON public.user_module_access IS
  'Allows each user to read their own module access rows (dashboard menu).';

DROP POLICY IF EXISTS "user_module_access_select_admin" ON public.user_module_access;

CREATE POLICY "user_module_access_select_admin" ON public.user_module_access
  FOR SELECT TO authenticated
  USING (public.auth_is_admin());

COMMENT ON POLICY "user_module_access_select_admin" ON public.user_module_access IS
  'Allows admins to read all module access rows (permissions panel).';

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

COMMENT ON POLICY "profiles_select_own" ON public.profiles IS
  'Allows each user to read their own profile row.';

DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;

CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.auth_is_admin());

COMMENT ON POLICY "profiles_select_admin" ON public.profiles IS
  'Allows admins to read all profile rows (admin panel, permissions).';
