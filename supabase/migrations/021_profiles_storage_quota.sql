-- Cuota de almacenamiento de bóveda por cliente principal (GB)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS storage_quota_gb integer NOT NULL DEFAULT 10;

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_storage_quota_gb_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_storage_quota_gb_check
  CHECK (storage_quota_gb >= 1 AND storage_quota_gb <= 1000);

COMMENT ON COLUMN profiles.storage_quota_gb IS
  'Cuota de almacenamiento de Mis documentos (GB) para clientes principales. Subusuarios comparten la del padre.';

-- Impedir subidas que superen la cuota del cliente principal
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

  SELECT (COALESCE(pr.storage_quota_gb, 10)::bigint * 1024 * 1024 * 1024)
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

DROP TRIGGER IF EXISTS documentos_storage_quota_check ON public.documentos;

CREATE TRIGGER documentos_storage_quota_check
  BEFORE INSERT ON public.documentos
  FOR EACH ROW
  EXECUTE FUNCTION public.check_vault_storage_quota();
