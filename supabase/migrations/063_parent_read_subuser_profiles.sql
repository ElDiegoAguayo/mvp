-- Principal clients need to read linked subuser rows (e.g. profile page subuser count).

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_parent_subusers" ON public.profiles;

CREATE POLICY "profiles_select_parent_subusers" ON public.profiles
  FOR SELECT TO authenticated
  USING (parent_user_id = auth.uid());

COMMENT ON POLICY "profiles_select_parent_subusers" ON public.profiles IS
  'Allows principal clients to read profiles of subusers linked to their account.';

-- Subusers need to read their principal client profile (parent name/email on profile page).

DROP POLICY IF EXISTS "profiles_select_subuser_parent" ON public.profiles;

CREATE POLICY "profiles_select_subuser_parent" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = (
      SELECT p.parent_user_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

COMMENT ON POLICY "profiles_select_subuser_parent" ON public.profiles IS
  'Allows subusers to read their principal client profile for account context.';

-- Required for login and dashboard: each user must read their own profile row.

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

COMMENT ON POLICY "profiles_select_own" ON public.profiles IS
  'Allows each user to read their own profile row.';
