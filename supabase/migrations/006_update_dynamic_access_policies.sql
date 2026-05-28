-- Allow users to read tables/charts/rows granted via access tables
alter table public.dynamic_tables enable row level security;
alter table public.dynamic_charts enable row level security;
alter table public.dynamic_table_rows enable row level security;

create policy "dynamic_tables_select_access" on public.dynamic_tables
  for select
  using (
    user_id = auth.uid()
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

create policy "dynamic_charts_select_access" on public.dynamic_charts
  for select
  using (
    user_id = auth.uid()
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

create policy "dynamic_table_rows_select_access" on public.dynamic_table_rows
  for select
  using (
    exists (
      select 1
      from public.dynamic_tables t
      where t.id = dynamic_table_rows.table_id
        and t.user_id = auth.uid()
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
