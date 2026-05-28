-- ============================================================
-- Módulo: Costos y Gastos
-- Tabla:  registro_compras_sii
-- Descripción: Almacena el libro de compras del SII importado
--              vía Excel. Cada fila representa un documento
--              recibido (boleta, factura, nota de crédito, etc.).
-- ============================================================

create table if not exists public.registro_compras_sii (
  id                   uuid        primary key default gen_random_uuid(),
  cliente_id           uuid        not null references auth.users(id) on delete cascade,
  rut_contraparte      text        not null,
  razon_social         text        not null default '',
  numero_documento     text        not null default '',
  tipo_documento       text        not null default '',
  fecha_emision        date,
  mes_devengo          text        not null default '',
  monto_neto           numeric     not null default 0,
  monto_iva            numeric     not null default 0,
  monto_bruto          numeric     not null default 0,
  categoria_madre      text        not null default '',
  sub_cuenta           text        not null default '',
  detalle_gasto        text        not null default '',
  estado_clasificacion text        not null default 'pendiente',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ── Índices ────────────────────────────────────────────────
create index if not exists idx_compras_sii_cliente_id
  on public.registro_compras_sii(cliente_id);

create index if not exists idx_compras_sii_rut_contraparte
  on public.registro_compras_sii(cliente_id, rut_contraparte);

create index if not exists idx_compras_sii_fecha_emision
  on public.registro_compras_sii(cliente_id, fecha_emision desc);

create index if not exists idx_compras_sii_estado
  on public.registro_compras_sii(cliente_id, estado_clasificacion);

-- ── updated_at automático ──────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_compras_sii_updated_at on public.registro_compras_sii;
create trigger trg_compras_sii_updated_at
  before update on public.registro_compras_sii
  for each row execute function public.set_updated_at();

-- ── Row Level Security ─────────────────────────────────────
alter table public.registro_compras_sii enable row level security;

-- SELECT: propietario (incluyendo subusuarios vía effective_user_id) o admin
create policy "compras_sii_select" on public.registro_compras_sii
  for select
  using (
    cliente_id = public.effective_user_id()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- INSERT: el propio usuario inserta con su cliente_id, o admin inserta para cualquiera
create policy "compras_sii_insert" on public.registro_compras_sii
  for insert
  with check (
    cliente_id = public.effective_user_id()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- UPDATE: solo propietario efectivo o admin
create policy "compras_sii_update" on public.registro_compras_sii
  for update
  using (
    cliente_id = public.effective_user_id()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    cliente_id = public.effective_user_id()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- DELETE: solo propietario efectivo o admin
create policy "compras_sii_delete" on public.registro_compras_sii
  for delete
  using (
    cliente_id = public.effective_user_id()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ── Función RPC: agrupación por contraparte ────────────────
-- Devuelve el resumen de gastos por rut_contraparte para un
-- cliente_id dado. Se invoca desde el Server Action con
-- supabase.rpc('gastos_por_contraparte', { p_cliente_id }).
create or replace function public.gastos_por_contraparte(p_cliente_id uuid)
returns table (
  rut_contraparte      text,
  razon_social         text,
  total_monto_neto     numeric,
  total_monto_iva      numeric,
  total_monto_bruto    numeric,
  total_registros      bigint,
  pendientes           bigint,
  clasificados         bigint
)
language sql
stable
as $$
  select
    rut_contraparte,
    max(razon_social)                                                    as razon_social,
    coalesce(sum(monto_neto),   0)                                       as total_monto_neto,
    coalesce(sum(monto_iva),    0)                                       as total_monto_iva,
    coalesce(sum(monto_bruto),  0)                                       as total_monto_bruto,
    count(*)                                                             as total_registros,
    count(*) filter (where estado_clasificacion = 'pendiente')           as pendientes,
    count(*) filter (where estado_clasificacion != 'pendiente')          as clasificados
  from public.registro_compras_sii
  where cliente_id = p_cliente_id
  group by rut_contraparte
  order by total_monto_bruto desc;
$$;
