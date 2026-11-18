import React, { useEffect, useState } from 'react';
import {
  Warehouse,
  PackageCheck,
  ArrowLeftRight,
  FolderLock,
  Sun,
  Moon,
} from 'lucide-react';
import { ToastContainer } from './ToastContainer';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

const THEME_STORAGE_KEY = 'logivault_theme';

/**
 * Ilustrasi rak gudang dengan 4 tingkat dan kotak barang berwarna status:
 * hijau = stok aman, kuning = stok menipis, merah = stok kritis.
 */
function RackIllustration() {
  return (
    <svg
      viewBox="0 0 360 220"
      className="w-full max-w-[380px]"
      role="img"
      aria-label="Ilustrasi rak gudang dengan kotak stok aman, menipis, dan kritis"
    >
      {/* Tiang vertikal rak */}
      <rect x="16" y="12" width="6" height="196" fill="#2a5560" />
      <rect x="128" y="12" width="5" height="196" fill="#234851" />
      <rect x="235" y="12" width="5" height="196" fill="#234851" />
      <rect x="338" y="12" width="6" height="196" fill="#2a5560" />

      {/* Palang horizontal 4 tingkat */}
      <rect x="16" y="56" width="328" height="4" fill="#3a6e7c" />
      <rect x="16" y="106" width="328" height="4" fill="#3a6e7c" />
      <rect x="16" y="156" width="328" height="4" fill="#3a6e7c" />
      <rect x="16" y="204" width="328" height="5" fill="#4b8594" />

      {/* Tingkat 1 (atas) */}
      <rect x="30" y="22" width="86" height="34" rx="2" fill="#2e9468" />
      <rect x="36" y="27" width="28" height="4" fill="#9ad5be" />
      <rect x="142" y="22" width="80" height="34" rx="2" fill="#2e9468" />
      <rect x="148" y="27" width="24" height="4" fill="#9ad5be" />
      <rect x="249" y="22" width="76" height="34" rx="2" fill="#cf950c" />
      <rect x="255" y="27" width="24" height="4" fill="#fae8be" />

      {/* Tingkat 2 */}
      <rect x="30" y="72" width="86" height="34" rx="2" fill="#2e9468" />
      <rect x="36" y="77" width="28" height="4" fill="#9ad5be" />
      <rect x="142" y="72" width="80" height="34" rx="2" fill="#b43328" />
      <rect x="148" y="77" width="24" height="4" fill="#f6d5d2" />
      <rect x="249" y="72" width="76" height="34" rx="2" fill="#2e9468" />
      <rect x="255" y="77" width="24" height="4" fill="#9ad5be" />

      {/* Tingkat 3 */}
      <rect x="30" y="122" width="86" height="34" rx="2" fill="#cf950c" />
      <rect x="36" y="127" width="28" height="4" fill="#fae8be" />
      <rect x="142" y="122" width="80" height="34" rx="2" fill="#2e9468" />
      <rect x="148" y="127" width="24" height="4" fill="#9ad5be" />
      {/* Slot kosong: garis putus-putus */}
      <rect
        x="249"
        y="122"
        width="76"
        height="34"
        rx="2"
        fill="none"
        stroke="#3a6e7c"
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />

      {/* Tingkat 4 (bawah) */}
      <rect x="30" y="170" width="86" height="34" rx="2" fill="#2e9468" />
      <rect x="36" y="175" width="28" height="4" fill="#9ad5be" />
      <rect x="142" y="170" width="80" height="34" rx="2" fill="#2e9468" />
      <rect x="148" y="175" width="24" height="4" fill="#9ad5be" />
      <rect x="249" y="170" width="76" height="34" rx="2" fill="#2e9468" />
      <rect x="255" y="175" width="24" height="4" fill="#9ad5be" />
    </svg>
  );
}

export const AuthShell: React.FC<AuthShellProps> = ({
  title,
  subtitle,
  children,
  footer,
}) => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
      window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
      window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    }
  }, [isDarkMode]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 grid grid-cols-1 lg:grid-cols-12 transition-colors duration-200">
      {/* Panel kiri: identitas & ilustrasi rak (desktop lg:col-span-5) */}
      <aside className="hidden lg:flex lg:col-span-5 flex-col justify-between bg-sidebar bg-rack-grid text-white p-10 border-r border-indigo-950">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-white text-slate-950 flex items-center justify-center shrink-0">
            <Warehouse className="w-5 h-5" />
          </div>
          <span className="text-base font-bold tracking-tight">LogiVault WMS</span>
        </div>

        <div className="my-auto py-8 space-y-6">
          <RackIllustration />

          <div className="max-w-md space-y-3">
            <h2 className="text-xl font-bold text-white leading-snug">
              Stok gudang tercatat rapi, dari koordinat rak hingga dokumen manifest.
            </h2>
            <ul className="space-y-2.5 text-xs text-indigo-100/85">
              <li className="flex items-center gap-2.5">
                <PackageCheck className="w-4 h-4 text-indigo-300 shrink-0" />
                <span>Pantau lokasi rak hierarkis, FEFO, dan Auto-Replenishment</span>
              </li>
              <li className="flex items-center gap-2.5">
                <ArrowLeftRight className="w-4 h-4 text-indigo-300 shrink-0" />
                <span>Batch, Cluster & Zone Picking terintegrasi hingga Shipping Manifest</span>
              </li>
              <li className="flex items-center gap-2.5">
                <FolderLock className="w-4 h-4 text-indigo-300 shrink-0" />
                <span>Simpan surat jalan, invoice & berita acara di Cloud File Vault</span>
              </li>
            </ul>
          </div>
        </div>

        <p className="text-xs text-indigo-200/70">
          Data setiap akun terisolasi penuh dengan Supabase Row Level Security (RLS).
        </p>
      </aside>

      {/* Panel kanan: form autentikasi */}
      <main className="lg:col-span-7 flex flex-col justify-center px-4 py-10 sm:px-8 relative">
        {/* Tombol Toggle Dark Mode di sudut kanan atas */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-8">
          <button
            type="button"
            onClick={() => setIsDarkMode((prev) => !prev)}
            aria-label={isDarkMode ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
          >
            {isDarkMode ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Mode Terang</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-slate-600" />
                <span>Mode Gelap</span>
              </>
            )}
          </button>
        </div>

        <div className="w-full max-w-md mx-auto">
          {/* Brand bar untuk layar kecil */}
          <div className="flex lg:hidden items-center gap-2.5 mb-6">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
              <Warehouse className="w-5 h-5" />
            </div>
            <span className="text-base font-bold text-slate-900 dark:text-white">
              LogiVault WMS
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8">
            <header className="mb-6">
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                {title}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {subtitle}
              </p>
            </header>

            {children}

            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
              {footer}
            </div>
          </div>
        </div>
      </main>

      <ToastContainer />
    </div>
  );
};
