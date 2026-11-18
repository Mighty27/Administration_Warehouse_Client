-- ============================================================================
-- LOGIVAULT ENTERPRISE WMS — SUPABASE POSTGRESQL SCHEMA, RLS & STORAGE POLICIES
-- Cara Pakai: Salin seluruh script ini ke menu "SQL Editor" di Dashboard Supabase
-- lalu klik "Run" sebelum melakukan deploy aplikasi ke Netlify.
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. TABEL MASTER INVENTARIS HIERARKIS & FEFO (items)
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sku text not null,
  barcode text not null default '',
  name text not null,
  category text not null,
  unit text not null default 'Pcs',
  floor_level text not null default 'Lantai 1',
  aisle_row text not null default 'Baris A',
  column_bay text not null default 'Kolom 01',
  rack_code text not null default 'Rak 01',
  rack_location text not null,
  inbound_rack_location text not null default 'INB-STG-A01',
  reserve_stock integer not null default 0 check (reserve_stock >= 0),
  stock integer not null default 0 check (stock >= 0),
  min_stock integer not null default 0 check (min_stock >= 0),
  batch_number text not null default 'BATCH-DEFAULT',
  expiry_date date null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_items_user_id on public.items(user_id);
create index if not exists idx_items_sku on public.items(user_id, sku);

-- 2. TABEL BUKU BESAR MUTASI & REPLENISHMENT (transactions)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  sku text not null,
  item_name text not null,
  type text not null check (type in ('INBOUND', 'OUTBOUND', 'REPLENISHMENT', 'OPNAME_ADJUSTMENT')),
  quantity integer not null check (quantity > 0),
  stock_before integer not null,
  stock_after integer not null,
  from_location text null,
  to_location text null,
  batch_number text null,
  reference_no text not null,
  partner_name text not null,
  operator_name text null,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_transactions_user_id on public.transactions(user_id, created_at desc);

-- 3. TABEL METADATA DOKUMEN CLOUD FILE VAULT (documents)
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null check (category in ('Surat Jalan', 'Shipping Manifest', 'Invoice', 'Berita Acara', 'Lainnya')),
  notes text not null default '',
  file_name text not null,
  file_path text not null,
  file_size bigint not null check (file_size >= 0),
  mime_type text not null,
  content_preview text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_documents_user_id on public.documents(user_id, created_at desc);

-- 4. AKTIFKAN ROW LEVEL SECURITY (RLS) KETAT BERBASIS user_id
alter table public.items enable row level security;
alter table public.transactions enable row level security;
alter table public.documents enable row level security;

-- Policies untuk public.items
drop policy if exists "items_select_own" on public.items;
create policy "items_select_own" on public.items
  for select using (auth.uid() = user_id);

drop policy if exists "items_insert_own" on public.items;
create policy "items_insert_own" on public.items
  for insert with check (auth.uid() = user_id);

drop policy if exists "items_update_own" on public.items;
create policy "items_update_own" on public.items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "items_delete_own" on public.items;
create policy "items_delete_own" on public.items
  for delete using (auth.uid() = user_id);

-- Policies untuk public.transactions
drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own" on public.transactions
  for select using (auth.uid() = user_id);

drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own" on public.transactions
  for insert with check (auth.uid() = user_id);

-- Policies untuk public.documents
drop policy if exists "documents_select_own" on public.documents;
create policy "documents_select_own" on public.documents
  for select using (auth.uid() = user_id);

drop policy if exists "documents_insert_own" on public.documents;
create policy "documents_insert_own" on public.documents
  for insert with check (auth.uid() = user_id);

drop policy if exists "documents_delete_own" on public.documents;
create policy "documents_delete_own" on public.documents
  for delete using (auth.uid() = user_id);

-- 5. SUPABASE STORAGE BUCKET PRIVAT & POLICIES ({user_id}/{nama_file})
insert into storage.buckets (id, name, public)
values ('warehouse-docs', 'warehouse-docs', false)
on conflict (id) do update set public = false;

drop policy if exists "storage_select_own_folder" on storage.objects;
create policy "storage_select_own_folder" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'warehouse-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "storage_insert_own_folder" on storage.objects;
create policy "storage_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'warehouse-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "storage_delete_own_folder" on storage.objects;
create policy "storage_delete_own_folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'warehouse-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
