-- Aislamiento estricto de bóveda por cliente principal + subusuarios

CREATE OR REPLACE FUNCTION public.vault_owner_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT p.parent_user_id
      FROM profiles p
      WHERE p.id = p_user_id
        AND p.role = 'user'
        AND p.parent_user_id IS NOT NULL
    ),
    p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.vault_owner_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vault_owner_id(uuid) TO authenticated;

-- Cuota / uso (prioriza storage_quota_bytes)
CREATE OR REPLACE FUNCTION public.get_vault_storage_for_user(p_user_id uuid)
RETURNS TABLE (used_bytes bigint, quota_bytes bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH owner AS (
    SELECT public.vault_owner_id(p_user_id) AS owner_id
  ),
  owner_ids AS (
    SELECT o.owner_id AS id FROM owner o
    UNION
    SELECT p.id FROM profiles p
    JOIN owner o ON p.parent_user_id = o.owner_id
  )
  SELECT
    COALESCE((
      SELECT SUM(d.size)::bigint
      FROM documentos d
      WHERE d.user_id IN (SELECT id FROM owner_ids)
    ), 0)::bigint AS used_bytes,
    COALESCE((
      SELECT COALESCE(
        pr.storage_quota_bytes,
        COALESCE(pr.storage_quota_gb, 10)::bigint * 1024 * 1024 * 1024
      )
      FROM profiles pr
      JOIN owner o ON pr.id = o.owner_id
    ), 10737418240::bigint)::bigint AS quota_bytes;
$$;

REVOKE ALL ON FUNCTION public.get_vault_storage_for_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vault_storage_for_user(uuid) TO authenticated;

-- Políticas más estrictas: mismo dueño de bóveda (no solo user_id = effective)
DO $$
BEGIN
  IF to_regclass('public.documentos') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS documentos_select_effective ON public.documentos';
    EXECUTE 'DROP POLICY IF EXISTS documentos_write_effective ON public.documentos';
    EXECUTE 'DROP POLICY IF EXISTS documentos_update_effective ON public.documentos';
    EXECUTE 'DROP POLICY IF EXISTS documentos_delete_effective ON public.documentos';

    EXECUTE $policy$
      CREATE POLICY documentos_select_vault_owner ON public.documentos
      FOR SELECT USING (
        public.vault_owner_id(user_id) = public.vault_owner_id(auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'admin'
        )
      )
    $policy$;

    EXECUTE $policy$
      CREATE POLICY documentos_insert_vault_owner ON public.documentos
      FOR INSERT WITH CHECK (
        public.vault_owner_id(user_id) = public.vault_owner_id(auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'admin'
        )
      )
    $policy$;

    EXECUTE $policy$
      CREATE POLICY documentos_update_vault_owner ON public.documentos
      FOR UPDATE USING (
        public.vault_owner_id(user_id) = public.vault_owner_id(auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'admin'
        )
      )
      WITH CHECK (
        public.vault_owner_id(user_id) = public.vault_owner_id(auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'admin'
        )
      )
    $policy$;

    EXECUTE $policy$
      CREATE POLICY documentos_delete_vault_owner ON public.documentos
      FOR DELETE USING (
        public.vault_owner_id(user_id) = public.vault_owner_id(auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'admin'
        )
      )
    $policy$;
  END IF;

  IF to_regclass('public.carpetas') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS carpetas_select_effective ON public.carpetas';
    EXECUTE 'DROP POLICY IF EXISTS carpetas_write_effective ON public.carpetas';
    EXECUTE 'DROP POLICY IF EXISTS carpetas_update_effective ON public.carpetas';
    EXECUTE 'DROP POLICY IF EXISTS carpetas_delete_effective ON public.carpetas';

    EXECUTE $policy$
      CREATE POLICY carpetas_select_vault_owner ON public.carpetas
      FOR SELECT USING (
        public.vault_owner_id(user_id) = public.vault_owner_id(auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'admin'
        )
      )
    $policy$;

    EXECUTE $policy$
      CREATE POLICY carpetas_insert_vault_owner ON public.carpetas
      FOR INSERT WITH CHECK (
        public.vault_owner_id(user_id) = public.vault_owner_id(auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'admin'
        )
      )
    $policy$;

    EXECUTE $policy$
      CREATE POLICY carpetas_update_vault_owner ON public.carpetas
      FOR UPDATE USING (
        public.vault_owner_id(user_id) = public.vault_owner_id(auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'admin'
        )
      )
      WITH CHECK (
        public.vault_owner_id(user_id) = public.vault_owner_id(auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'admin'
        )
      )
    $policy$;

    EXECUTE $policy$
      CREATE POLICY carpetas_delete_vault_owner ON public.carpetas
      FOR DELETE USING (
        public.vault_owner_id(user_id) = public.vault_owner_id(auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'admin'
        )
      )
    $policy$;
  END IF;
END $$;
