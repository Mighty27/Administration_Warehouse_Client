import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  Boxes,
  FolderLock,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  ShieldCheck,
  Sun,
  Warehouse,
  X,
} from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext';
import { ToastContainer } from './ToastContainer';

const THEME_STORAGE_KEY = 'logivault_theme';

const NAV_ITEMS = [
  {
    to: '/',
    label: 'Dashboard Ringkasan',
    shortLabel: 'Dashboard',
    icon: LayoutDashboard,
    end: true,
  },
  {
    to: '/inventory',
    label: 'Master Inventaris',
    shortLabel: 'Inventaris',
    icon: Boxes,
    end: false,
  },
  {
    to: '/transactions',
    label: 'Transaksi Gudang',
    shortLabel: 'Transaksi',
    icon: ArrowLeftRight,
    end: false,
  },
  {
    to: '/documents',
    label: 'Cloud File Vault',
    shortLabel: 'File Vault',
    icon: FolderLock,
    end: false,
  },
];

export const AppLayout: React.FC = () => {
  const { user, logout } = useWarehouse();
  const location = useLocation();
  const navigate = useNavigate();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
    } catch {
      // Abaikan jika localStorage tidak tersedia
    }
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage.setItem(
        THEME_STORAGE_KEY,
        isDarkMode ? 'dark' : 'light'
      );
    } catch {
      // Abaikan error penyimpanan lokal
    }
  }, [isDarkMode]);

  // Tutup dropdown mobile otomatis saat berpindah rute halaman
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Tutup dropdown mobile saat klik di luar area menu atau menekan tombol Escape
  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node)
      ) {
        setIsMobileMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  const currentRouteTitle = (() => {
    if (location.pathname === '/') return 'Dashboard Ringkasan';
    if (location.pathname.startsWith('/inventory')) return 'Master Inventaris';
    if (location.pathname.startsWith('/transactions')) return 'Transaksi Gudang';
    if (location.pathname.startsWith('/documents')) return 'Cloud File Vault';
    return 'Operasional Gudang';
  })();

  const handleLogout = async () => {
    setIsMobileMenuOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row transition-colors duration-150">
      {/* Sidebar Tetap khusus Desktop (hidden md:flex) */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-30 transition-colors duration-150">
        <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
            <Warehouse className="w-4 h-4" />
          </div>
          <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
            LogiVault
          </span>
        </div>

        {/* Info Akun & Isolasi RLS */}
        {user && (
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
              {user.full_name}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {user.warehouse_zone} · {user.role}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="truncate" title={user.id}>
                UID: {user.id.slice(0, 13)}...
              </span>
            </div>
          </div>
        )}

        {/* Menu Navigasi Utama Desktop */}
        <nav aria-label="Menu Utama" className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer Sidebar Desktop */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <button
            type="button"
            onClick={toggleDarkMode}
            aria-label={isDarkMode ? 'Aktifkan Mode Terang' : 'Aktifkan Mode Gelap'}
            aria-pressed={isDarkMode}
            className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <span className="inline-flex items-center gap-2">
              {isDarkMode ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>{isDarkMode ? 'Mode Terang' : 'Mode Gelap'}</span>
            </span>
            <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
              {isDarkMode ? 'DARK' : 'LIGHT'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Keluar Sesi</span>
          </button>
        </div>
      </aside>

      {/* Konten Utama */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen">
        {/* Top Bar Header + Hamburger Dropdown khusus Mobile (md:hidden) */}
        <div ref={mobileMenuRef} className="sticky top-0 z-30">
          <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 flex items-center justify-between gap-3 transition-colors duration-150">
            <div className="flex items-center gap-2.5 text-sm min-w-0">
              {/* Tombol Hamburger Menu — Hanya tampil di Mobile (md:hidden) */}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                aria-label={
                  isMobileMenuOpen
                    ? 'Tutup menu navigasi'
                    : 'Buka menu navigasi'
                }
                aria-expanded={isMobileMenuOpen}
                aria-controls="mobile-dropdown-navigation"
                className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0 cursor-pointer"
              >
                {isMobileMenuOpen ? (
                  <X className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <Menu className="w-4 h-4" />
                )}
              </button>

              {/* Identitas Brand ringkas di Mobile */}
              <div className="md:hidden w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
                <Warehouse className="w-3.5 h-3.5" />
              </div>

              <span className="font-semibold text-slate-500 dark:text-slate-400 hidden sm:inline whitespace-nowrap">
                {user?.warehouse_zone || 'Warehouse'}
              </span>
              <span
                className="text-slate-300 dark:text-slate-700 hidden sm:inline"
                aria-hidden="true"
              >
                /
              </span>
              <h1 className="font-bold text-slate-900 dark:text-slate-100 truncate">
                {currentRouteTitle}
              </h1>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={toggleDarkMode}
                aria-label={
                  isDarkMode ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'
                }
                aria-pressed={isDarkMode}
                title={
                  isDarkMode ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isDarkMode ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="hidden sm:inline">Mode Terang</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                    <span className="hidden sm:inline">Mode Gelap</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </div>
          </header>

          {/* Dropdown Menu Navigasi Mobile — Hanya tampil di Mobile (md:hidden) */}
          {isMobileMenuOpen && (
            <nav
              id="mobile-dropdown-navigation"
              aria-label="Navigasi Mobile"
              className="md:hidden absolute top-full inset-x-0 mx-3 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden z-40"
            >
              {/* Ringkasan Akun & Sesi RLS pada Dropdown Mobile */}
              {user && (
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {user.full_name}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-indigo-600 dark:text-indigo-400 shrink-0">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>UID: {user.id.slice(0, 8)}...</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {user.warehouse_zone} · {user.role}
                  </p>
                </div>
              )}

              {/* Daftar Menu Utama Dropdown Mobile */}
              <div className="p-2 space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                          isActive
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                        }`
                      }
                    >
                      <span className="inline-flex items-center gap-3">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </span>
                    </NavLink>
                  );
                })}
              </div>

              {/* Aksi Cepat Dropdown Mobile */}
              <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={toggleDarkMode}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  {isDarkMode ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Mode Terang</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                      <span>Mode Gelap</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-950/70 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span>Keluar Sesi</span>
                </button>
              </div>
            </nav>
          )}
        </div>

        {/* Area Halaman Dinamis */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  );
};

