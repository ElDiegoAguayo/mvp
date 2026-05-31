-- Plan de servicio contratado (Esencial, Enterprise, Business)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS service_plan_id text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_service_plan_id_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_service_plan_id_check
  CHECK (
    service_plan_id IS NULL
    OR service_plan_id IN ('esencial', 'enterprise', 'business')
  );

COMMENT ON COLUMN public.profiles.service_plan_id IS
  'Plan de servicio Up Crop contratado por el cliente principal (esencial, enterprise, business).';
