-- Plantilla predeterminada de Inicio (widgets /dashboard) configurable por admin

CREATE TABLE IF NOT EXISTS public.platform_dashboard_default (
  id int PRIMARY KEY DEFAULT 1,
  configuration JSONB,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT platform_dashboard_default_singleton CHECK (id = 1)
);

INSERT INTO public.platform_dashboard_default (id, configuration)
VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_dashboard_default ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_dashboard_default_read ON public.platform_dashboard_default;
CREATE POLICY platform_dashboard_default_read ON public.platform_dashboard_default
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS platform_dashboard_default_admin ON public.platform_dashboard_default;
CREATE POLICY platform_dashboard_default_admin ON public.platform_dashboard_default
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

COMMENT ON TABLE public.platform_dashboard_default IS
  'Plantilla de widgets de Inicio aplicada a usuarios sin layout personalizado';
