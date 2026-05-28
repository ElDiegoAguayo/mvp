-- Enable Supabase Realtime for dynamic tables, rows and charts
-- Run this once in the Supabase SQL Editor.

-- Make sure tables have full replica identity so updates emit complete payloads
ALTER TABLE IF EXISTS public.dynamic_tables REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.dynamic_table_rows REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.dynamic_charts REPLICA IDENTITY FULL;

-- Add tables to the supabase_realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'dynamic_tables'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.dynamic_tables';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'dynamic_table_rows'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.dynamic_table_rows';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'dynamic_charts'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.dynamic_charts';
  END IF;
END
$$;
