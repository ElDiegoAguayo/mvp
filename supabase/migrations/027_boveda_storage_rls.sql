-- Políticas de Storage para bucket boveda alineadas con vault_owner_id (principal + subusuarios)

CREATE OR REPLACE FUNCTION public.storage_boveda_path_owner(object_name text)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF((storage.foldername(object_name))[1], '')::uuid
$$;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        COALESCE(qual::text, '') ILIKE '%boveda%'
        OR COALESCE(with_check::text, '') ILIKE '%boveda%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY boveda_storage_select_vault_owner ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'boveda'
    AND (
      public.storage_boveda_path_owner(name) = public.vault_owner_id(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    )
  );

CREATE POLICY boveda_storage_insert_vault_owner ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'boveda'
    AND (
      public.storage_boveda_path_owner(name) = public.vault_owner_id(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    )
  );

CREATE POLICY boveda_storage_update_vault_owner ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'boveda'
    AND (
      public.storage_boveda_path_owner(name) = public.vault_owner_id(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    )
  )
  WITH CHECK (
    bucket_id = 'boveda'
    AND (
      public.storage_boveda_path_owner(name) = public.vault_owner_id(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    )
  );

CREATE POLICY boveda_storage_delete_vault_owner ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'boveda'
    AND (
      public.storage_boveda_path_owner(name) = public.vault_owner_id(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    )
  );
