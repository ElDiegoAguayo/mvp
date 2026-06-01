-- Merged into 064_user_module_access_select_own.sql (auth_is_admin + admin policies).
-- Kept for migration order if already applied separately.

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

DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;

CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.auth_is_admin());

DROP POLICY IF EXISTS "user_module_access_select_admin" ON public.user_module_access;

CREATE POLICY "user_module_access_select_admin" ON public.user_module_access
  FOR SELECT TO authenticated
  USING (public.auth_is_admin());
