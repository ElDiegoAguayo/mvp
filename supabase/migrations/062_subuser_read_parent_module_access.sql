-- Subusers need to read their principal's enabled modules for dashboard menu filtering.
-- Without this, RLS may hide parent rows and the client filters out every module.

ALTER TABLE public.user_module_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_module_access_select_subuser_parent" ON public.user_module_access;

CREATE POLICY "user_module_access_select_subuser_parent" ON public.user_module_access
  FOR SELECT TO authenticated
  USING (
    user_id = (
      SELECT p.parent_user_id
      FROM public.profiles p
      WHERE p.id = auth.uid()
    )
  );

COMMENT ON POLICY "user_module_access_select_subuser_parent" ON public.user_module_access IS
  'Allows subusers to read module access rows of their parent client for effective menu filtering.';
