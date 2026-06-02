-- Evitar subir el mismo archivo de cotización dos veces (por hash de contenido).
ALTER TABLE public.supplier_quotations
  ADD COLUMN IF NOT EXISTS file_content_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS supplier_quotations_user_file_hash_idx
  ON public.supplier_quotations(user_id, file_content_hash)
  WHERE file_content_hash IS NOT NULL;
