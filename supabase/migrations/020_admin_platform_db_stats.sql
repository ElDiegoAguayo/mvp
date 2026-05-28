-- Tamaño real de la base de datos para el panel admin (solo service_role vía RPC)
CREATE OR REPLACE FUNCTION public.admin_platform_db_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'database_bytes', pg_database_size(current_database()),
    'top_tables', (
      SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.size_bytes DESC), '[]'::jsonb)
      FROM (
        SELECT
          c.relname AS name,
          pg_total_relation_size(c.oid)::bigint AS size_bytes,
          coalesce(s.n_live_tup, 0)::bigint AS row_estimate
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
        ORDER BY pg_total_relation_size(c.oid) DESC
        LIMIT 8
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_platform_db_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_platform_db_stats() TO service_role;
