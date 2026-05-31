-- Extra module appearance options for sidebar / admin configuration
ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS icon_size TEXT NOT NULL DEFAULT 'md',
  ADD COLUMN IF NOT EXISTS icon_style TEXT NOT NULL DEFAULT 'soft',
  ADD COLUMN IF NOT EXISTS menu_badge TEXT DEFAULT NULL;

COMMENT ON COLUMN public.modules.icon_size IS 'Sidebar icon container size: sm, md, lg';
COMMENT ON COLUMN public.modules.icon_style IS 'Icon container style: soft, solid, outline';
COMMENT ON COLUMN public.modules.menu_badge IS 'Optional short badge shown next to module name in sidebar (e.g. Nuevo, Beta)';
