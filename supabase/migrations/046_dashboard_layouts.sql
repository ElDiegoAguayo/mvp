-- Dashboard home layout per user (widgets on /dashboard)

CREATE TABLE IF NOT EXISTS public.dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  configuration JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT dashboard_layouts_user_id_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_user_id
  ON public.dashboard_layouts(user_id);

ALTER TABLE public.dashboard_layouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dashboard_layouts_select_own ON public.dashboard_layouts;
CREATE POLICY dashboard_layouts_select_own ON public.dashboard_layouts
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS dashboard_layouts_admin_manage ON public.dashboard_layouts;
CREATE POLICY dashboard_layouts_admin_manage ON public.dashboard_layouts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

COMMENT ON TABLE public.dashboard_layouts IS 'Custom widget layout for each user home (/dashboard)';
COMMENT ON COLUMN public.dashboard_layouts.configuration IS 'JSON array of WidgetConfig objects';
