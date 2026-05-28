create or replace function public.effective_user_id()
returns uuid
language sql
stable
as $$
  select coalesce(
    (select parent_user_id from public.profiles where id = auth.uid()),
    auth.uid()
  )
$$;

create policy "dynamic_tables_select_effective" on public.dynamic_tables
  for select
  using (
    user_id = public.effective_user_id()
    or exists (
      select 1
      from public.user_table_access uta
      where uta.table_id = dynamic_tables.id
        and uta.user_id = auth.uid()
        and uta.can_view = true
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "dynamic_charts_select_effective" on public.dynamic_charts
  for select
  using (
    user_id = public.effective_user_id()
    or exists (
      select 1
      from public.user_chart_access uca
      where uca.chart_id = dynamic_charts.id
        and uca.user_id = auth.uid()
        and uca.can_view = true
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "dynamic_table_rows_select_effective" on public.dynamic_table_rows
  for select
  using (
    exists (
      select 1
      from public.dynamic_tables t
      where t.id = dynamic_table_rows.table_id
        and t.user_id = public.effective_user_id()
    )
    or exists (
      select 1
      from public.user_table_access uta
      where uta.table_id = dynamic_table_rows.table_id
        and uta.user_id = auth.uid()
        and uta.can_view = true
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "inventory_warehouses_select_effective" on public.inventory_warehouses
  for select
  using (
    user_id = public.effective_user_id()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "inventory_warehouses_write_effective" on public.inventory_warehouses
  for insert
  with check (
    user_id = public.effective_user_id()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "inventory_warehouses_update_effective" on public.inventory_warehouses
  for update
  using (
    user_id = public.effective_user_id()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    user_id = public.effective_user_id()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "inventory_warehouses_delete_effective" on public.inventory_warehouses
  for delete
  using (
    user_id = public.effective_user_id()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "inventory_materials_select_effective" on public.inventory_materials
  for select
  using (
    user_id = public.effective_user_id()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "inventory_materials_write_effective" on public.inventory_materials
  for insert
  with check (
    user_id = public.effective_user_id()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "inventory_materials_update_effective" on public.inventory_materials
  for update
  using (
    user_id = public.effective_user_id()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    user_id = public.effective_user_id()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "inventory_materials_delete_effective" on public.inventory_materials
  for delete
  using (
    user_id = public.effective_user_id()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "inventory_movements_select_effective" on public.inventory_movements
  for select
  using (
    user_id = public.effective_user_id()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "inventory_movements_write_effective" on public.inventory_movements
  for insert
  with check (
    user_id = public.effective_user_id()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "inventory_movements_update_effective" on public.inventory_movements
  for update
  using (
    user_id = public.effective_user_id()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    user_id = public.effective_user_id()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "inventory_movements_delete_effective" on public.inventory_movements
  for delete
  using (
    user_id = public.effective_user_id()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "inventory_min_levels_select_effective" on public.inventory_min_levels
  for select
  using (
    user_id = public.effective_user_id()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "inventory_min_levels_write_effective" on public.inventory_min_levels
  for insert
  with check (
    user_id = public.effective_user_id()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "inventory_min_levels_update_effective" on public.inventory_min_levels
  for update
  using (
    user_id = public.effective_user_id()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    user_id = public.effective_user_id()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "inventory_min_levels_delete_effective" on public.inventory_min_levels
  for delete
  using (
    user_id = public.effective_user_id()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

DO $$
BEGIN
  IF to_regclass('public.carpetas') IS NOT NULL THEN
    BEGIN
      EXECUTE 'create policy "carpetas_select_effective" on public.carpetas for select using (user_id = public.effective_user_id() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = ''admin''))';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      EXECUTE 'create policy "carpetas_write_effective" on public.carpetas for insert with check (user_id = public.effective_user_id() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = ''admin''))';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      EXECUTE 'create policy "carpetas_update_effective" on public.carpetas for update using (user_id = public.effective_user_id() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = ''admin'')) with check (user_id = public.effective_user_id() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = ''admin''))';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      EXECUTE 'create policy "carpetas_delete_effective" on public.carpetas for delete using (user_id = public.effective_user_id() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = ''admin''))';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.documentos') IS NOT NULL THEN
    BEGIN
      EXECUTE 'create policy "documentos_select_effective" on public.documentos for select using (user_id = public.effective_user_id() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = ''admin''))';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      EXECUTE 'create policy "documentos_write_effective" on public.documentos for insert with check (user_id = public.effective_user_id() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = ''admin''))';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      EXECUTE 'create policy "documentos_update_effective" on public.documentos for update using (user_id = public.effective_user_id() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = ''admin'')) with check (user_id = public.effective_user_id() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = ''admin''))';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      EXECUTE 'create policy "documentos_delete_effective" on public.documentos for delete using (user_id = public.effective_user_id() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = ''admin''))';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
