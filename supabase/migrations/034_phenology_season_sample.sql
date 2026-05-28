-- Campos para seguimiento fenológico semanal (formato San Mariano / Excel)

ALTER TABLE public.phenology_observations
  ADD COLUMN IF NOT EXISTS season_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS hilera integer,
  ADD COLUMN IF NOT EXISTS arbol integer;

CREATE INDEX IF NOT EXISTS phenology_observations_block_season_idx
  ON public.phenology_observations(user_id, block_name, season_label, observed_at);
