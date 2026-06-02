-- Período de aplicación: fecha inicio y fin por ítem del programa.

ALTER TABLE public.phyto_application_items
  ADD COLUMN IF NOT EXISTS application_end_date date;

UPDATE public.phyto_application_items i
SET application_end_date = p.end_date
FROM public.phyto_application_programs p
WHERE i.program_id = p.id
  AND i.application_end_date IS NULL
  AND p.end_date IS NOT NULL
  AND i.application_date IS NOT NULL;

UPDATE public.phyto_application_items
SET application_end_date = application_date
WHERE application_end_date IS NULL
  AND application_date IS NOT NULL;
