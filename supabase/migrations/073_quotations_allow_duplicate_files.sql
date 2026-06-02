-- Permitir subir la misma cotización varias veces (p. ej. pruebas). El hash se conserva sin unicidad.
DROP INDEX IF EXISTS public.supplier_quotations_user_file_hash_idx;
