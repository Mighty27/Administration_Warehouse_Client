import React, { useState } from 'react';
import { Check, Copy, Database, FileCode, FolderTree, ShieldCheck, X } from 'lucide-react';

interface BlueprintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FOLDER_STRUCTURE_TEXT = `logivault-warehouse-admin/
├── .env.example                  # Template variabel lingkungan VITE_SUPABASE_*
├── netlify.toml                  # Konfigurasi build Vite & SPA Redirect (/* -> /index.html 200)
├── index.html                    # Entry HTML SPA
├── package.json                  # Dependensi React, Vite, Tailwind, Lucide, Supabase
├── supabase/
│   └── schema.sql                # Script SQL Tabel, Row Level Security (RLS), & Storage Policy
└── src/
    ├── main.tsx                  # Bootstrap React DOM & BrowserRouter
    ├── App.tsx                   # Konfigurasi Routing & Protected Routes
    ├── index.css                 # Konfigurasi Tailwind CSS & Tipografi Tabular
    ├── types/
    │   └── warehouse.ts          # Definisi tipe TypeScript (Item, Transaksi, Dokumen)
    ├── lib/
    │   ├── supabase.ts           # Inisialisasi client @supabase/supabase-js
    │   └── seedData.ts           # Data awal multi-akun ber-isolasi user_id
    ├── utils/
    │   ├── warehouseRules.ts     # Logika murni validasi stok, RLS path, & ekspor CSV
    │   └── warehouseRules.test.ts# Unit test terotomasi (node:test)
    ├── context/
    │   └── WarehouseContext.tsx  # State autentikasi, CRUD ber-filter user_id, & Signed URL
    ├── components/
    │   ├── AppLayout.tsx         # Layout responsif (Desktop Sidebar + Mobile Bottom Nav)
    │   ├── ProtectedRoute.tsx    # Guard autentikasi otomatis ke /login
    │   ├── BlueprintModal.tsx    # Dokumentasi SQL, RLS, dan Netlify
    │   └── ToastContainer.tsx    # Feedback visual notifikasi real-time
    └── pages/
        ├── Login.tsx             # Halaman masuk & penguji isolasi multi-akun
        ├── Register.tsx          # Halaman registrasi akun gudang baru
        ├── Dashboard.tsx         # 4 KPI Statistik, Peringatan Stok Menipis, & 5 Transaksi Terakhir
        ├── Inventory.tsx         # Master Inventaris (Tabel Desktop / Card Mobile + Search & Modal)
        ├── Transactions.tsx      # Form Inbound/Outbound ber-validasi stok + Export CSV
        └── Documents.tsx         # Cloud File Vault (Upload <=10MB, Signed URL Preview, Download)`;

const NETLIFY_TOML_TEXT = `# netlify.toml — Letakkan di root folder proyek
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

# Wajib untuk React Router SPA agar tidak error 404 saat halaman di-refresh
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200`;

const ENV_EXAMPLE_TEXT = `# .env.example — Konfigurasi Environment Variables di Netlify Dashboard
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="your-supabase-anon-public-key"`;

const SUPABASE_SQL_TEXT = `-- ============================================================================
-- LOGIVAULT WAREHOUSE ADMIN — SUPABASE SQL SCHEMA, RLS & STORAGE POLICIES
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABEL MASTER INVENTARIS (items)
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

-- 2. TABEL TRANSAKSI GUDANG (transactions)
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

-- 3. TABEL DOKUMEN CLOUD FILE VAULT (documents)
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL CHECK (category IN ('Surat Jalan', 'Invoice', 'Berita Acara', 'Lainnya')),
  notes TEXT DEFAULT '',
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL, -- Format wajib: {user_id}/{nama_file}
  file_size BIGINT NOT NULL CHECK (file_size <= 10485760),
  mime_type VARCHAR(150) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. AKTIVASI ROW LEVEL SECURITY (RLS) PER USER_ID
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "items_isolation_policy" ON public.items
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transactions_isolation_policy" ON public.transactions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "documents_isolation_policy" ON public.documents
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. PRIVATE STORAGE BUCKET (warehouse-docs) & STORAGE RLS POLICIES
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('warehouse-docs', 'warehouse-docs', false, 10485760)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "warehouse_docs_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'warehouse-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "warehouse_docs_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'warehouse-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "warehouse_docs_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'warehouse-docs' AND (storage.foldername(name))[1] = auth.uid()::text);`;

export const BlueprintModal: React.FC<BlueprintModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'sql' | 'netlify' | 'structure'>('sql');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="blueprint-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-4xl w-full max-h-[88vh] flex flex-col shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="blueprint-modal-title" className="text-base font-bold text-slate-900">
              Arsitektur Deployment Netlify & Script SQL Supabase RLS
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Salin script konfigurasi di bawah ini untuk deployment produksi ke GitHub, Supabase, dan Netlify
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal dokumentasi"
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pt-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('sql')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'sql'
                ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-4 h-4" />
            Script SQL & RLS Supabase
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('netlify')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'netlify'
                ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCode className="w-4 h-4" />
            netlify.toml & .env.example
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('structure')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'structure'
                ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            Struktur Folder Proyek
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>
                    File: <code className="font-mono font-semibold text-slate-900">supabase/schema.sql</code> — Mengatur Tabel, RLS per <code className="font-mono">user_id</code>, dan Bucket <code className="font-mono">warehouse-docs</code>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy('sql', SUPABASE_SQL_TEXT)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {copiedKey === 'sql' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Tersalin
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Salin Script SQL
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-slate-900 text-slate-100 font-mono text-xs p-4 rounded-xl overflow-x-auto leading-relaxed">
                {SUPABASE_SQL_TEXT}
              </pre>
            </div>
          )}

          {activeTab === 'netlify' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 font-mono">
                    /netlify.toml
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy('netlify', NETLIFY_TOML_TEXT)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    {copiedKey === 'netlify' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Tersalin
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Salin netlify.toml
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-slate-900 text-slate-100 font-mono text-xs p-4 rounded-xl overflow-x-auto leading-relaxed">
                  {NETLIFY_TOML_TEXT}
                </pre>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 font-mono">
                    /.env.example
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy('env', ENV_EXAMPLE_TEXT)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    {copiedKey === 'env' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Tersalin
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Salin .env.example
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-slate-900 text-slate-100 font-mono text-xs p-4 rounded-xl overflow-x-auto leading-relaxed">
                  {ENV_EXAMPLE_TEXT}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'structure' && (
            <div className="space-y-2">
              <p className="text-xs text-slate-600">
                Seluruh file di bawah ini telah tersedia secara utuh di dalam workspace proyek dan siap di-build (<code className="font-mono">npm run build</code> → <code className="font-mono">dist/</code>):
              </p>
              <pre className="bg-slate-900 text-slate-100 font-mono text-xs p-4 rounded-xl overflow-x-auto leading-relaxed">
                {FOLDER_STRUCTURE_TEXT}
              </pre>
            </div>
          )}
        </div>

        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            100% Static Client-Side SPA · Kompatibel penuh dengan Netlify Free Tier & Supabase RLS
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
