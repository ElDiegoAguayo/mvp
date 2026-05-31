-- Campos alineados con planilla Excel: ubicación, asistencia, horas regulares/extras

ALTER TABLE public.tech_assistance_entries
  ADD COLUMN IF NOT EXISTS location_label text,
  ADD COLUMN IF NOT EXISTS attendance_value numeric(8, 2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS regular_hours numeric(8, 2),
  ADD COLUMN IF NOT EXISTS overtime_hours numeric(8, 2);

COMMENT ON COLUMN public.tech_assistance_entries.location_label IS
  'Ubicación / sector / predio (texto legible).';
COMMENT ON COLUMN public.tech_assistance_entries.attendance_value IS
  'Marcador de asistencia del día (ej. 1 = asistió).';
COMMENT ON COLUMN public.tech_assistance_entries.regular_hours IS
  'Horas regulares trabajadas.';
COMMENT ON COLUMN public.tech_assistance_entries.overtime_hours IS
  'Horas extras trabajadas.';
