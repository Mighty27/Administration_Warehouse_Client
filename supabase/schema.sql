-- ============================================================================
-- LOGIVAULT WAREHOUSE ADMIN — SUPABASE POSTGRESQL SCHEMA, RLS & STORAGE POLICIES
-- Jalankan seluruh script ini pada menu "SQL Editor" di Dashboard Supabase Anda
-- ============================================================================

-- Aktifkan ekstensi UUID jika belum aktif
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. TABEL MASTER INVENTARIS (items)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sku VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  rack_location VARCHAR(100) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock INTEGER NOT NULL DEFAULT 5 CHECK (min_stock >= 0),
  unit VARCHAR(50) NOT NULL DEFAULT 'Pcs',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT items_user_sku_unique UNIQUE (user_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_items_user_id ON public.items(user_id);
CREATE INDEX IF NOT EXISTS idx_items_sku ON public.items(sku);

-- ----------------------------------------------------------------------------
-- 2. TABEL TRANSAKSI GUDANG (transactions)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  sku VARCHAR(64) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('INBOUND', 'OUTBOUND')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  stock_before INTEGER NOT NULL,
  stock_after INTEGER NOT NULL CHECK (stock_after >= 0),
  reference_no VARCHAR(100) NOT NULL,
  partner_name VARCHAR(255) DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. TABEL DOKUMEN CLOUD FILE VAULT (documents)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL CHECK (category IN ('Surat Jalan', 'Invoice', 'Berita Acara', 'Lainnya')),
  notes TEXT DEFAULT '',
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL, -- Format wajib: {user_id}/{timestamp}_{nama_file}
  file_size BIGINT NOT NULL CHECK (file_size <= 10485760), -- Maks 10MB
  mime_type VARCHAR(150) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);

-- ============================================================================
-- 4. AKTIVASI ROW LEVEL SECURITY (RLS) — ISOLASI DATA KETAT PER USER_ID
-- ============================================================================
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Kebijakan RLS untuk tabel public.items
DROP POLICY IF EXISTS "items_select_own" ON public.items;
CREATE POLICY "items_select_own" ON public.items
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "items_insert_own" ON public.items;
CREATE POLICY "items_insert_own" ON public.items
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "items_update_own" ON public.items;
CREATE POLICY "items_update_own" ON public.items
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "items_delete_own" ON public.items;
CREATE POLICY "items_delete_own" ON public.items
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Kebijakan RLS untuk tabel public.transactions
DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
CREATE POLICY "transactions_select_own" ON public.transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_insert_own" ON public.transactions;
CREATE POLICY "transactions_insert_own" ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_delete_own" ON public.transactions;
CREATE POLICY "transactions_delete_own" ON public.transactions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Kebijakan RLS untuk tabel public.documents
DROP POLICY IF EXISTS "documents_select_own" ON public.documents;
CREATE POLICY "documents_select_own" ON public.documents
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "documents_insert_own" ON public.documents;
CREATE POLICY "documents_insert_own" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "documents_delete_own" ON public.documents;
CREATE POLICY "documents_delete_own" ON public.documents
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 5. SUPABASE STORAGE BUCKET PRIVAT & STORAGE RLS POLICIES (warehouse-docs)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'warehouse-docs',
  'warehouse-docs',
  false, -- Bucket WAJIB privat (akses hanya via Signed URL)
  10485760, -- Batas ukuran 10MB (10 * 1024 * 1024 bytes)
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760;

-- Storage Policy: User hanya bisa melihat/membuat Signed URL file di dalam foldernya sendiri ({user_id}/*)
DROP POLICY IF EXISTS "storage_select_own_folder" ON storage.objects;
CREATE POLICY "storage_select_own_folder" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'warehouse-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage Policy: User hanya bisa mengunggah file ke dalam foldernya sendiri ({user_id}/*)
DROP POLICY IF EXISTS "storage_insert_own_folder" ON storage.objects;
CREATE POLICY "storage_insert_own_folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'warehouse-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage Policy: User hanya bisa memperbarui file di dalam foldernya sendiri ({user_id}/*)
DROP POLICY IF EXISTS "storage_update_own_folder" ON storage.objects;
CREATE POLICY "storage_update_own_folder" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'warehouse-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage Policy: User hanya bisa menghapus file di dalam foldernya sendiri ({user_id}/*)
DROP POLICY IF EXISTS "storage_delete_own_folder" ON storage.objects;
CREATE POLICY "storage_delete_own_folder" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'warehouse-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
