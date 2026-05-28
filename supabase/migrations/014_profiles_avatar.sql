-- Add avatar_url to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;

-- ─── Storage bucket setup (run these in Supabase Dashboard > Storage) ─────────
-- 1. Create a public bucket called "preset-avatars"
-- 2. Add the following policies:

-- Allow public read of all files:
-- CREATE POLICY "Public read preset avatars"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'preset-avatars');

-- Allow authenticated admins to upload/delete:
-- CREATE POLICY "Admins manage preset avatars"
--   ON storage.objects FOR ALL
--   TO authenticated
--   USING (
--     bucket_id = 'preset-avatars'
--     AND EXISTS (
--       SELECT 1 FROM public.profiles
--       WHERE id = auth.uid() AND role = 'admin'
--     )
--   )
--   WITH CHECK (
--     bucket_id = 'preset-avatars'
--     AND EXISTS (
--       SELECT 1 FROM public.profiles
--       WHERE id = auth.uid() AND role = 'admin'
--     )
--   );
