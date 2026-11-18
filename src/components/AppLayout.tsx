import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  ArrowLeftRight,
  ScanBarcode,
  FolderLock,
  LogOut,
  ShieldCheck,
  Warehouse,
  Sun,
  Moon,
  Menu,
  X,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext';
import { ToastContainer } from './ToastContainer';

interface NavItemConfig {
  to: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

const NAV_ITEMS: NavItemConfig[] = [
  {
    to: '/',
    label: 'Dashboard & Performa',
    shortLabel: 'Dashboard',
    icon: LayoutDashboard,
    end: true,
  },
  {
    to: '/inventory',
    label: 'Lokasi Rak & FEFO',
    shortLabel: 'Inventaris',
    icon: Package,
  },
  {
    to: '/fulfillment',
    label: 'Fulfillment & Picking',
    shortLabel: 'Fulfillment',
    icon: ClipboardList,
  },
  {
    to: '/transactions',
    label: 'Putaway & Mutasi',
    shortLabel: 'Mutasi',
    icon: ArrowLeftRight,
  },
  {
    to: '/mobile-wms',
    label: 'WMS Mobile & Opname',
    shortLabel: 'Mobile WMS',
    icon: ScanBarcode,
  },
  {
    to: '/documents',
    label: 'Cloud File Vault',
    shortLabel: 'Dokumen',
    icon: FolderLock,
  },
];

const THEME_STORAGE_KEY = 'logivault_theme';

export const AppLayout: React.FC = () => {
  const { user, signOut, items, orders, resetDemoData } = useWarehouse();
  const location = useLocation();
  const mobileDropdownRef = useRef<HTMLDivElement>(null);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
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

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        mobileDropdownRef.current &&
        !mobileDropdownRef.current.contains(event.target as Node)
      ) {
        setIsMobileMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMobileMenuOpen]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  if (!user) return null;

  const lowStockCount = items.filter((item) => item.stock <= item.min_stock).length;
  const activeOrdersCount = orders.filter((ord) => ord.status !== 'SHIPPED').length;

  const warehouseLabel = user.warehouse_name || user.warehouse_zone;
  const roleLabel = user.role_title || user.role;

  const activeTitle =
    NAV_ITEMS.find((nav) =>
      nav.end ? location.pathname === nav.to : location.pathname.startsWith(nav.to)
    )?.label ?? 'Operasional Gudang';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row transition-colors duration-200">
      {/* Sidebar Desktop (md:flex) — selalu petrol gelap */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-sidebar text-indigo-100 border-r border-indigo-950 z-30">
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center gap-3 border-b border-white/10">
          <div className="w-8 h-8 rounded-md bg-white text-slate-950 flex items-center justify-center shrink-0">
            <Warehouse className="w-4 h-4" />
          </div>
          <span className="text-base font-bold tracking-tight text-white">LogiVault WMS</span>
        </div>

        {/* Info Gudang & Akun Aktif */}
        <div className="px-5 py-4 border-b border-white/10">
          <p className="text-xs font-semibold text-white truncate">{user.full_name}</p>
          <p className="text-[11px] text-indigo-200/75 truncate mt-0.5">
            {warehouseLabel} · {roleLabel}
          </p>
          <div className="mt-2.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/10">
            <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
            <span
              className="text-[11px] font-mono text-indigo-100/90 truncate"
              title={user.id}
            >
              UID {user.id.slice(0, 8)}
            </span>
          </div>
        </div>

        {/* Menu Navigasi 6 Modul WMS */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Menu Utama">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `relative flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white/10 text-white font-semibold before:content-[""] before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r before:bg-indigo-300'
                      : 'text-indigo-100/75 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.to === '/inventory' && lowStockCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[11px] font-mono font-semibold rounded bg-amber-500/20 text-amber-300 border border-amber-400/30">
                    {lowStockCount}
                  </span>
                )}
                {item.to === '/fulfillment' && activeOrdersCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[11px] font-mono font-semibold rounded bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                    {activeOrdersCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer Sidebar: Reset Demo, Tema & Keluar */}
        <div className="p-3 border-t border-white/10 space-y-1">
          <button
            type="button"
            onClick={resetDemoData}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium text-indigo-100/80 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-indigo-300" />
            <span>Reset Data Demo WMS</span>
          </button>

          <button
            type="button"
            onClick={toggleDarkMode}
            aria-label={isDarkMode ? 'Aktifkan Mode Terang' : 'Aktifkan Mode Gelap'}
            className="w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium text-indigo-100/80 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2.5">
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-300" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-200" />
              )}
              <span>{isDarkMode ? 'Mode terang' : 'Mode gelap'}</span>
            </span>
          </button>

          <button
            type="button"
            onClick={signOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium text-indigo-100/80 hover:bg-rose-500/20 hover:text-rose-200 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar sesi</span>
          </button>
        </div>
      </aside>

      {/* Konten Utama */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header
          ref={mobileDropdownRef}
          className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 transition-colors duration-200"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="md:hidden w-8 h-8 rounded-md bg-indigo-600 flex items-center justify-center text-white shrink-0">
              <Warehouse className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex items-baseline gap-2">
              <span className="hidden sm:inline text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                {warehouseLabel}
              </span>
              <span
                className="hidden sm:inline text-slate-300 dark:text-slate-700"
                aria-hidden="true"
              >
                /
              </span>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
                {activeTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tombol Dark Mode Toggle */}
            <button
              type="button"
              onClick={toggleDarkMode}
              aria-label={isDarkMode ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
              title={isDarkMode ? 'Mode Terang' : 'Mode Gelap'}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {isDarkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Mode Terang</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-600" />
                  <span className="hidden sm:inline">Mode Gelap</span>
                </>
              )}
            </button>

            {/* Tombol Keluar khusus Desktop */}
            <button
              type="button"
              onClick={signOut}
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>

            {/* Tombol Hamburger Menu khusus Mobile (md:hidden) */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-dropdown-navigation"
              aria-label={isMobileMenuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
              className="md:hidden relative inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            >
              {isMobileMenuOpen ? (
                <X className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
              {!isMobileMenuOpen && lowStockCount > 0 && (
                <span
                  aria-label={`${lowStockCount} peringatan stok menipis`}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center"
                >
                  {lowStockCount}
                </span>
              )}
            </button>
          </div>

          {/* Dropdown Menu Navigasi Mobile (md:hidden) */}
          {isMobileMenuOpen && (
            <div
              id="mobile-dropdown-navigation"
              role="menu"
              aria-label="Menu Navigasi Mobile"
              className="md:hidden absolute top-full right-4 left-4 sm:left-auto sm:w-80 mt-2 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50"
            >
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {user.full_name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {warehouseLabel} · {roleLabel}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 text-[10px] font-mono font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">
                    <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    UID {user.id.slice(0, 6)}
                  </span>
                </div>
              </div>

              <nav className="p-2 space-y-1" aria-label="Daftar Halaman">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      role="menuitem"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                          isActive
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span className="flex items-center gap-2.5">
                            <Icon
                              className={`w-4 h-4 ${
                                isActive
                                  ? 'text-white'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            />
                            <span>{item.label}</span>
                          </span>
                          <ChevronRight
                            className={`w-3.5 h-3.5 ${
                              isActive ? 'text-white/80' : 'text-slate-400'
                            }`}
                          />
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </nav>

              <div className="p-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    signOut();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <LogOut className="w-4 h-4" />
                    <span>Keluar dari Sesi Akun</span>
                  </span>
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Isi Halaman */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-10">
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  );
};
