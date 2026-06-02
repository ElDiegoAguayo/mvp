-- Clientes y subusuarios: solo lectura en estimación de cosecha.
-- Escritura: admin o inspector asignado al cliente (user_id de la fila).

DO $$
DECLARE
  tbl text;
  pol text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['harvest_estimates', 'harvest_blocks', 'harvest_fields']
  LOOP
    pol := tbl || '_insert_effective';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, tbl);
    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
        OR (
          public.is_tech_inspector()
          AND public.inspector_can_access_client(user_id)
        )
      )
    $p$, pol, tbl);

    pol := tbl || '_update_effective';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, tbl);
    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
        OR (
          public.is_tech_inspector()
          AND public.inspector_can_access_client(user_id)
        )
      ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
        OR (
          public.is_tech_inspector()
          AND public.inspector_can_access_client(user_id)
        )
      )
    $p$, pol, tbl);

    pol := tbl || '_delete_effective';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, tbl);
    EXECUTE format($p$
      CREATE POLICY %I ON public.%I FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
        OR (
          public.is_tech_inspector()
          AND public.inspector_can_access_client(user_id)
        )
      )
    $p$, pol, tbl);
  END LOOP;
END $$;
