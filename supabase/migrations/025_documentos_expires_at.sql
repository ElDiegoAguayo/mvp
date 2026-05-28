-- Fecha de vencimiento opcional para archivos en Mis documentos
ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.documentos.expires_at IS
  'Fecha opcional de vencimiento del documento en la bóveda del cliente.';
