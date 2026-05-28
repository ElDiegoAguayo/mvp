-- Cuota exacta en bytes para todos los planes (incl. 1 MB prueba)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS storage_quota_bytes bigint;

COMMENT ON COLUMN profiles.storage_quota_bytes IS
  'Cuota de Mis documentos en bytes. Si es NULL, se deriva de storage_quota_gb.';

-- Backfill clientes principales existentes
UPDATE profiles
SET storage_quota_bytes = COALESCE(storage_quota_gb, 10)::bigint * 1024 * 1024 * 1024
WHERE storage_quota_bytes IS NULL
  AND role = 'user'
  AND parent_user_id IS NULL;

CREATE OR REPLACE FUNCTION public.check_vault_storage_quota()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  owner_id uuid;
  quota_bytes bigint;
  used_bytes bigint;
BEGIN
  SELECT COALESCE(p.parent_user_id, p.id)
  INTO owner_id
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  IF owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(
    pr.storage_quota_bytes,
    COALESCE(pr.storage_quota_gb, 10)::bigint * 1024 * 1024 * 1024
  )
  INTO quota_bytes
  FROM public.profiles pr
  WHERE pr.id = owner_id;

  SELECT COALESCE(SUM(d.size), 0)::bigint
  INTO used_bytes
  FROM public.documentos d
  JOIN public.profiles p ON p.id = d.user_id
  WHERE COALESCE(p.parent_user_id, p.id) = owner_id;

  IF used_bytes + NEW.size > quota_bytes THEN
    RAISE EXCEPTION 'storage_quota_exceeded'
      USING HINT = 'El cliente superó su cuota de almacenamiento.';
  END IF;

  RETURN NEW;
END;
$$;

-- Lectura de cuota/uso para el cliente (principal o subusuario)
CREATE OR REPLACE FUNCTION public.get_vault_storage_for_user(p_user_id uuid)
RETURNS TABLE (used_bytes bigint, quota_bytes bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH owner AS (
    SELECT COALESCE(p.parent_user_id, p.id) AS owner_id
    FROM profiles p
    WHERE p.id = p_user_id
  ),
  owner_ids AS (
    SELECT o.owner_id AS id FROM owner o
    UNION
    SELECT p.id FROM profiles p
    JOIN owner o ON p.parent_user_id = o.owner_id
  )
  SELECT
    COALESCE((
      SELECT SUM(d.size)::bigint
      FROM documentos d
      WHERE d.user_id IN (SELECT id FROM owner_ids)
    ), 0)::bigint AS used_bytes,
    COALESCE((
      SELECT COALESCE(
        pr.storage_quota_bytes,
        COALESCE(pr.storage_quota_gb, 10)::bigint * 1024 * 1024 * 1024
      )
      FROM profiles pr
      JOIN owner o ON pr.id = o.owner_id
    ), 10737418240::bigint)::bigint AS quota_bytes;
$$;

REVOKE ALL ON FUNCTION public.get_vault_storage_for_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vault_storage_for_user(uuid) TO authenticated;
