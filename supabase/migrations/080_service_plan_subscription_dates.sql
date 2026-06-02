-- Fechas de activación y vencimiento del plan de servicio (duración: 1 mes).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS service_plan_activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS service_plan_expires_at timestamptz;

COMMENT ON COLUMN public.profiles.service_plan_activated_at IS
  'Momento en que se asignó o renovó el plan de servicio actual.';
COMMENT ON COLUMN public.profiles.service_plan_expires_at IS
  'Vencimiento del plan de servicio actual (1 mes desde la activación).';

-- Clientes con plan existente: activación = created_at, vencimiento = +1 mes.
UPDATE public.profiles
SET
  service_plan_activated_at = COALESCE(service_plan_activated_at, created_at, now()),
  service_plan_expires_at = COALESCE(
    service_plan_expires_at,
    COALESCE(service_plan_activated_at, created_at, now()) + interval '1 month'
  )
WHERE service_plan_id IS NOT NULL;
