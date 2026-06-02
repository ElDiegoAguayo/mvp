-- Logo sin recortar para documentos (PDF orden de compra); avatar_url puede ser el recorte circular.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_original_url text;
