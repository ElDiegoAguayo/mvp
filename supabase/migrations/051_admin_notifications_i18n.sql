-- Bilingual admin notifications (ES source + EN auto-translated)
ALTER TABLE public.admin_notifications
  ADD COLUMN IF NOT EXISTS title_i18n jsonb,
  ADD COLUMN IF NOT EXISTS message_i18n jsonb;

UPDATE public.admin_notifications
SET
  title_i18n = jsonb_build_object('es', title, 'en', title),
  message_i18n = jsonb_build_object('es', message, 'en', message)
WHERE title_i18n IS NULL OR message_i18n IS NULL;

COMMENT ON COLUMN public.admin_notifications.title_i18n IS 'Localized title { es, en } entered manually in admin.';
COMMENT ON COLUMN public.admin_notifications.message_i18n IS 'Localized message { es, en } entered manually in admin.';
