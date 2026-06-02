-- Cuando inicio y fin son iguales (solo FECHA del Excel), usar fin de mes como ventana de aplicación.

UPDATE public.phyto_application_items
SET application_end_date = (
  date_trunc('month', application_date::timestamp + interval '1 month') - interval '1 day'
)::date
WHERE application_date IS NOT NULL
  AND (application_end_date IS NULL OR application_end_date = application_date);
