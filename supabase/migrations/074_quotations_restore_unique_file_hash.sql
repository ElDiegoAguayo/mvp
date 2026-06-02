-- Restaurar unicidad por archivo de cotización y eliminar duplicados existentes.
-- Se conserva la cotización más antigua por (user_id, file_content_hash).
-- Las órdenes de compra ligadas a duplicados se reasignan a la cotización conservada.

WITH keepers AS (
  SELECT DISTINCT ON (user_id, file_content_hash)
    id AS keep_id,
    user_id,
    file_content_hash
  FROM public.supplier_quotations
  WHERE file_content_hash IS NOT NULL
  ORDER BY user_id, file_content_hash, created_at ASC, id ASC
),
dupes AS (
  SELECT q.id AS dupe_id, k.keep_id
  FROM public.supplier_quotations q
  INNER JOIN keepers k
    ON k.user_id = q.user_id
    AND k.file_content_hash = q.file_content_hash
  WHERE q.file_content_hash IS NOT NULL
    AND q.id <> k.keep_id
)
UPDATE public.supplier_purchase_invoices i
SET quotation_id = d.keep_id
FROM dupes d
WHERE i.quotation_id = d.dupe_id;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, file_content_hash
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.supplier_quotations
  WHERE file_content_hash IS NOT NULL
)
DELETE FROM public.supplier_quotations
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Duplicados legacy sin hash (mismo nombre y tamaño de archivo)
WITH legacy_dupes AS (
  SELECT q.id AS dupe_id, k.keep_id
  FROM (
    SELECT DISTINCT ON (user_id, file_name, file_size)
      id AS keep_id,
      user_id,
      file_name,
      file_size
    FROM public.supplier_quotations
    WHERE file_content_hash IS NULL
      AND file_name IS NOT NULL
      AND file_size > 0
    ORDER BY user_id, file_name, file_size, created_at ASC, id ASC
  ) k
  INNER JOIN public.supplier_quotations q
    ON q.user_id = k.user_id
    AND q.file_name = k.file_name
    AND q.file_size = k.file_size
    AND q.file_content_hash IS NULL
  WHERE q.id <> k.keep_id
)
UPDATE public.supplier_purchase_invoices i
SET quotation_id = d.keep_id
FROM legacy_dupes d
WHERE i.quotation_id = d.dupe_id;

WITH legacy_ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, file_name, file_size
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.supplier_quotations
  WHERE file_content_hash IS NULL
    AND file_name IS NOT NULL
    AND file_size > 0
)
DELETE FROM public.supplier_quotations
WHERE id IN (SELECT id FROM legacy_ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS supplier_quotations_user_file_hash_idx
  ON public.supplier_quotations(user_id, file_content_hash)
  WHERE file_content_hash IS NOT NULL;
