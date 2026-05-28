create policy "dynamic_tables_insert_effective" on public.dynamic_tables
  for insert
  with check (
    user_id = public.effective_user_id()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "dynamic_tables_update_effective" on public.dynamic_tables
  for update
  using (
    user_id = public.effective_user_id()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    user_id = public.effective_user_id()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "dynamic_tables_delete_effective" on public.dynamic_tables
  for delete
  using (
    user_id = public.effective_user_id()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

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
        and uta.user_id = auth.uid()
        and uta.can_view = true
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

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
        and uta.user_id = auth.uid()
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
        and uta.user_id = auth.uid()
        and uta.can_view = true
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

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
        and uta.user_id = auth.uid()
        and uta.can_view = true
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
