-- Plantillas de mensaje personalizadas para modo mantenimiento

ALTER TABLE public.platform_maintenance
  ADD COLUMN IF NOT EXISTS custom_presets jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.platform_maintenance.custom_presets IS
  'Array JSON: [{ "id": "uuid", "label": "...", "message": "...", "created_at": "..." }]';
