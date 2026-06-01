-- Each client may have at most one active work location.

CREATE UNIQUE INDEX IF NOT EXISTS tech_assistance_locations_one_active_per_user_idx
  ON public.tech_assistance_locations (user_id)
  WHERE is_active = true;

COMMENT ON INDEX public.tech_assistance_locations_one_active_per_user_idx IS
  'Enforces one active work location per client.';
