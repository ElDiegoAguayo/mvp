-- Imágenes por lectura fenológica + bucket de storage

CREATE TABLE IF NOT EXISTS public.phenology_observation_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id uuid NOT NULL REFERENCES public.phenology_observations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phenology_observation_images_obs_idx
  ON public.phenology_observation_images(observation_id, sort_order);

ALTER TABLE public.phenology_observation_images ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol text;
BEGIN
  FOREACH pol IN ARRAY ARRAY['select', 'insert', 'update', 'delete']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS phenology_observation_images_%s_effective ON public.phenology_observation_images', pol);
  END LOOP;

  CREATE POLICY phenology_observation_images_select_effective ON public.phenology_observation_images
    FOR SELECT USING (
      user_id = public.effective_user_id()
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );

  CREATE POLICY phenology_observation_images_insert_effective ON public.phenology_observation_images
    FOR INSERT WITH CHECK (
      user_id = public.effective_user_id()
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );

  CREATE POLICY phenology_observation_images_update_effective ON public.phenology_observation_images
    FOR UPDATE USING (
      user_id = public.effective_user_id()
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    ) WITH CHECK (
      user_id = public.effective_user_id()
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );

  CREATE POLICY phenology_observation_images_delete_effective ON public.phenology_observation_images
    FOR DELETE USING (
      user_id = public.effective_user_id()
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fenologia',
  'fenologia',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

CREATE OR REPLACE FUNCTION public.storage_fenologia_path_owner(object_name text)
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
        COALESCE(qual::text, '') ILIKE '%fenologia%'
        OR COALESCE(with_check::text, '') ILIKE '%fenologia%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY fenologia_storage_select_owner ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'fenologia'
    AND (
      public.storage_fenologia_path_owner(name) = public.vault_owner_id(auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  );

CREATE POLICY fenologia_storage_insert_owner ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fenologia'
    AND (
      public.storage_fenologia_path_owner(name) = public.vault_owner_id(auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  );

CREATE POLICY fenologia_storage_update_owner ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'fenologia'
    AND (
      public.storage_fenologia_path_owner(name) = public.vault_owner_id(auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  )
  WITH CHECK (
    bucket_id = 'fenologia'
    AND (
      public.storage_fenologia_path_owner(name) = public.vault_owner_id(auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  );

CREATE POLICY fenologia_storage_delete_owner ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'fenologia'
    AND (
      public.storage_fenologia_path_owner(name) = public.vault_owner_id(auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  );
