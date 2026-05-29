-- Almacenamiento unificado por cliente: bóveda + fenología (+ futuros módulos)

ALTER TABLE public.phenology_observation_images
  ADD COLUMN IF NOT EXISTS file_size bigint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.phenology_observation_images.file_size IS
  'Tamaño en bytes; cuenta contra la cuota del cliente principal.';

-- Backfill desde storage.objects cuando exista el archivo
UPDATE public.phenology_observation_images pi
SET file_size = COALESCE(
  (
    SELECT NULLIF((o.metadata ->> 'size')::bigint, 0)
    FROM storage.objects o
    WHERE o.bucket_id = 'fenologia'
      AND o.name = pi.storage_path
    LIMIT 1
  ),
  0
)
WHERE pi.file_size = 0;

-- Bytes usados por el titular (principal + subusuarios)
CREATE OR REPLACE FUNCTION public.client_storage_used_bytes(p_owner_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH owner_ids AS (
    SELECT p_owner_id AS id
    UNION
    SELECT p.id FROM public.profiles p WHERE p.parent_user_id = p_owner_id
  )
  SELECT
    COALESCE((
      SELECT SUM(d.size)::bigint
      FROM public.documentos d
      WHERE d.user_id IN (SELECT id FROM owner_ids)
    ), 0)
    + COALESCE((
      SELECT SUM(pi.file_size)::bigint
      FROM public.phenology_observation_images pi
      WHERE pi.user_id IN (SELECT id FROM owner_ids)
    ), 0);
$$;

REVOKE ALL ON FUNCTION public.client_storage_used_bytes(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_storage_used_bytes(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.client_storage_quota_bytes(p_owner_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    pr.storage_quota_bytes,
    COALESCE(pr.storage_quota_gb, 10)::bigint * 1024 * 1024 * 1024
  )
  FROM public.profiles pr
  WHERE pr.id = p_owner_id;
$$;

REVOKE ALL ON FUNCTION public.client_storage_quota_bytes(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_storage_quota_bytes(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_client_storage_quota()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  owner_id uuid;
  quota_bytes bigint;
  used_bytes bigint;
  incoming bigint;
BEGIN
  SELECT COALESCE(p.parent_user_id, p.id)
  INTO owner_id
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  IF owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'phenology_observation_images' THEN
    incoming := COALESCE(NEW.file_size, 0);
  ELSE
    incoming := COALESCE(NEW.size, 0);
  END IF;

  quota_bytes := public.client_storage_quota_bytes(owner_id);
  used_bytes := public.client_storage_used_bytes(owner_id);

  IF used_bytes + incoming > quota_bytes THEN
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
  EXECUTE FUNCTION public.check_client_storage_quota();

DROP TRIGGER IF EXISTS phenology_observation_images_storage_quota_check ON public.phenology_observation_images;
CREATE TRIGGER phenology_observation_images_storage_quota_check
  BEFORE INSERT ON public.phenology_observation_images
  FOR EACH ROW
  EXECUTE FUNCTION public.check_client_storage_quota();

-- Desglose por módulo + totales
CREATE OR REPLACE FUNCTION public.get_client_storage_for_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH owner AS (
    SELECT public.vault_owner_id(p_user_id) AS owner_id
  ),
  owner_ids AS (
    SELECT o.owner_id AS id FROM owner o
    UNION
    SELECT p.id FROM public.profiles p
    JOIN owner o ON p.parent_user_id = o.owner_id
  ),
  vault AS (
    SELECT
      COALESCE(SUM(d.size), 0)::bigint AS bytes,
      COUNT(*)::bigint AS files
    FROM public.documentos d
    WHERE d.user_id IN (SELECT id FROM owner_ids)
  ),
  phenology AS (
    SELECT
      COALESCE(SUM(pi.file_size), 0)::bigint AS bytes,
      COUNT(*)::bigint AS files
    FROM public.phenology_observation_images pi
    WHERE pi.user_id IN (SELECT id FROM owner_ids)
  ),
  quota AS (
    SELECT public.client_storage_quota_bytes(o.owner_id) AS quota_bytes
    FROM owner o
  )
  SELECT jsonb_build_object(
    'used_bytes', (SELECT bytes FROM vault) + (SELECT bytes FROM phenology),
    'quota_bytes', (SELECT quota_bytes FROM quota),
    'modules', jsonb_build_array(
      jsonb_build_object(
        'id', 'boveda',
        'label', 'Mis documentos',
        'bytes', (SELECT bytes FROM vault),
        'files', (SELECT files FROM vault)
      ),
      jsonb_build_object(
        'id', 'fenologia',
        'label', 'Estados fenológicos',
        'bytes', (SELECT bytes FROM phenology),
        'files', (SELECT files FROM phenology)
      )
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_client_storage_for_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_storage_for_user(uuid) TO authenticated;

-- Compatibilidad: totales unificados
CREATE OR REPLACE FUNCTION public.get_vault_storage_for_user(p_user_id uuid)
RETURNS TABLE (used_bytes bigint, quota_bytes bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (data ->> 'used_bytes')::bigint,
    (data ->> 'quota_bytes')::bigint
  FROM (
    SELECT public.get_client_storage_for_user(p_user_id) AS data
  ) s;
$$;

REVOKE ALL ON FUNCTION public.get_vault_storage_for_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vault_storage_for_user(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_client_storage_for_user(uuid) IS
  'Uso y cuota del cliente con desglose por módulo (bóveda, fenología).';
