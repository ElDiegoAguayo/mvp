-- Ubicaciones con geocerca para asistencia técnica

CREATE TABLE IF NOT EXISTS public.tech_assistance_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  search_query text,
  lat numeric(10, 7) NOT NULL,
  lng numeric(10, 7) NOT NULL,
  radius_meters integer NOT NULL DEFAULT 500
    CHECK (radius_meters >= 50 AND radius_meters <= 50000),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tech_assistance_locations_user_idx
  ON public.tech_assistance_locations(user_id, is_active);

ALTER TABLE public.tech_assistance_services
  ADD COLUMN IF NOT EXISTS location_id uuid
    REFERENCES public.tech_assistance_locations(id) ON DELETE SET NULL;

ALTER TABLE public.tech_assistance_entries
  ADD COLUMN IF NOT EXISTS location_id uuid
    REFERENCES public.tech_assistance_locations(id) ON DELETE SET NULL;

COMMENT ON TABLE public.tech_assistance_locations IS
  'Lugares de trabajo con coordenadas y radio permitido para marcar asistencia.';
COMMENT ON COLUMN public.tech_assistance_locations.search_query IS
  'Texto usado para geocodificar (dirección o referencia).';
COMMENT ON COLUMN public.tech_assistance_locations.radius_meters IS
  'Distancia máxima (metros) desde el centro para permitir check-in/out.';

ALTER TABLE public.tech_assistance_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tech_assistance_locations_select ON public.tech_assistance_locations;
CREATE POLICY tech_assistance_locations_select ON public.tech_assistance_locations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR (
      user_id = public.effective_user_id()
      AND NOT public.is_tech_inspector()
    )
    OR (
      public.is_tech_inspector()
      AND public.inspector_can_access_client(user_id)
    )
  );

DROP POLICY IF EXISTS tech_assistance_locations_insert ON public.tech_assistance_locations;
CREATE POLICY tech_assistance_locations_insert ON public.tech_assistance_locations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR user_id = public.effective_user_id()
  );

DROP POLICY IF EXISTS tech_assistance_locations_update ON public.tech_assistance_locations;
CREATE POLICY tech_assistance_locations_update ON public.tech_assistance_locations
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR user_id = public.effective_user_id()
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR user_id = public.effective_user_id()
  );

DROP POLICY IF EXISTS tech_assistance_locations_delete ON public.tech_assistance_locations;
CREATE POLICY tech_assistance_locations_delete ON public.tech_assistance_locations
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
