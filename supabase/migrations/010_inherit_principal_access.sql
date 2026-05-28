-- Ensure subusers inherit access granted to their principal account

-- Update select policies to treat principal access as effective for subusers

drop policy if exists "dynamic_tables_select_effective" on public.dynamic_tables;
create policy "dynamic_tables_select_effective" on public.dynamic_tables
  for select
  using (
    user_id = public.effective_user_id()
    or exists (
      select 1
      from public.user_table_access uta
      where uta.table_id = dynamic_tables.id
        and uta.user_id = public.effective_user_id()
        and uta.can_view = true
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "dynamic_charts_select_effective" on public.dynamic_charts;
create policy "dynamic_charts_select_effective" on public.dynamic_charts
  for select
  using (
    user_id = public.effective_user_id()
    or exists (
      select 1
      from public.user_chart_access uca
      where uca.chart_id = dynamic_charts.id
        and uca.user_id = public.effective_user_id()
        and uca.can_view = true
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "dynamic_table_rows_select_effective" on public.dynamic_table_rows;
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
        and uta.user_id = public.effective_user_id()
        and uta.can_view = true
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Update write policies to inherit access from principal via user_table_access

drop policy if exists "dynamic_table_rows_insert_effective" on public.dynamic_table_rows;
create policy "dynamic_table_rows_insert_effective" on public.dynamic_table_rows
  for insert
  with check (
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
        and uta.user_id = public.effective_user_id()
        and uta.can_view = true
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "dynamic_table_rows_update_effective" on public.dynamic_table_rows;
create policy "dynamic_table_rows_update_effective" on public.dynamic_table_rows
  for update
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
        and uta.user_id = public.effective_user_id()
        and uta.can_view = true
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
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
        and uta.user_id = public.effective_user_id()
        and uta.can_view = true
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "dynamic_table_rows_delete_effective" on public.dynamic_table_rows;
create policy "dynamic_table_rows_delete_effective" on public.dynamic_table_rows
  for delete
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
        and uta.user_id = public.effective_user_id()
        and uta.can_view = true
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
