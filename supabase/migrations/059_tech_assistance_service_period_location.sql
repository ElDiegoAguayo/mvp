-- Vigencia y ubicación por servicio/labor (asistencia técnica)

ALTER TABLE public.tech_assistance_services
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date,
  ADD COLUMN IF NOT EXISTS location_label text;

ALTER TABLE public.tech_assistance_services
  DROP CONSTRAINT IF EXISTS tech_assistance_services_period_valid;

ALTER TABLE public.tech_assistance_services
  ADD CONSTRAINT tech_assistance_services_period_valid
  CHECK (
    (period_start IS NULL AND period_end IS NULL)
    OR (period_start IS NOT NULL AND period_end IS NOT NULL AND period_end >= period_start)
  );

COMMENT ON COLUMN public.tech_assistance_services.period_start IS
  'Inicio de vigencia de la labor para el cliente.';
COMMENT ON COLUMN public.tech_assistance_services.period_end IS
  'Fin de vigencia de la labor para el cliente.';
COMMENT ON COLUMN public.tech_assistance_services.location_label IS
  'Ubicación predeterminada (predio, sector, cuartel) para rellenar registros de asistencia.';
