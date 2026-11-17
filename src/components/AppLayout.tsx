import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  Boxes,
  Code2,
  FolderLock,
  LayoutDashboard,
  LogOut,
  RotateCcw,
  ShieldCheck,
  Users,
  Warehouse,
} from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext';
import { ToastContainer } from './ToastContainer';
import { BlueprintModal } from './BlueprintModal';
import { DEMO_USERS } from '../lib/seedData';

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
  const { user, logout, loginDemoAccount, resetDemoData, isCloudConnected } = useWarehouse();
  const [isBlueprintOpen, setIsBlueprintOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const currentRouteTitle = (() => {
    if (location.pathname === '/') return 'Dashboard Ringkasan';
    if (location.pathname.startsWith('/inventory')) return 'Master Inventaris';
    if (location.pathname.startsWith('/transactions')) return 'Transaksi Gudang';
    if (location.pathname.startsWith('/documents')) return 'Cloud File Vault';
    return 'Operasional Gudang';
  })();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const otherDemoAccount =
    user?.email === 'budi.gudang@logivault.id'
      ? DEMO_USERS['siti.logistik@logivault.id']
      : DEMO_USERS['budi.gudang@logivault.id'];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row">
      {/* Sidebar Desktop (md:flex) */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-slate-200 z-30">
        <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-200">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
            <Warehouse className="w-4 h-4" />
          </div>
          <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
            LogiVault
          </span>
        </div>

        {/* Info Akun & Isolasi RLS */}
        {user && (
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/60">
            <div className="text-xs font-semibold text-slate-900 truncate">
              {user.full_name}
            </div>
            <div className="text-xs text-slate-500 truncate mt-0.5">
              {user.warehouse_zone} · {user.role}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-mono text-slate-500 truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate" title={user.id}>
                UID: {user.id.slice(0, 13)}...
              </span>
            </div>
          </div>
        )}

        {/* Menu Navigasi Utama */}
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
                      ? 'bg-indigo-50 text-indigo-600 font-semibold'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Panel Uji Isolasi Multi-Akun & Dokumentasi SQL/Netlify */}
        <div className="p-3 border-t border-slate-200 space-y-1.5">
          {!isCloudConnected && otherDemoAccount && (
            <button
              type="button"
              onClick={() => loginDemoAccount(otherDemoAccount.email)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors text-left"
              title="Uji isolasi data RLS dengan beralih ke akun gudang lain"
            >
              <Users className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="truncate">
                Uji Akun: {otherDemoAccount.full_name.split(' ')[0]}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsBlueprintOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors text-left"
          >
            <Code2 className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="truncate">SQL RLS & Config Netlify</span>
          </button>

          {!isCloudConnected && (
            <button
              type="button"
              onClick={resetDemoData}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors text-left"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Reset Data Simulasi</span>
            </button>
          )}
        </div>
      </aside>

      {/* Konten Utama */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen pb-16 md:pb-0">
        {/* Top Bar Contract: Breadcrumb di kiri, 1-2 aksi utama di kanan */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="font-semibold text-slate-500 hidden sm:inline whitespace-nowrap">
              {user?.warehouse_zone || 'Warehouse'}
            </span>
            <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
              /
            </span>
            <h1 className="font-bold text-slate-900 truncate">{currentRouteTitle}</h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsBlueprintOpen(true)}
              className="md:hidden px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              SQL & Netlify
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500" />
              <span>Keluar</span>
            </button>
          </div>
        </header>

        {/* Area Halaman Dinamis */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Bottom Navigation Bar Mobile (md:hidden) — Tinggi <= 15% viewport */}
      <nav
        aria-label="Navigasi Mobile"
        className="md:hidden fixed bottom-0 inset-x-0 h-14 bg-white border-t border-slate-200 z-30 grid grid-cols-4"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                  isActive
                    ? 'text-indigo-600 font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate max-w-[76px]">{item.shortLabel}</span>
            </NavLink>
          );
        })}
      </nav>

      <BlueprintModal
        isOpen={isBlueprintOpen}
        onClose={() => setIsBlueprintOpen(false)}
      />
      <ToastContainer />
    </div>
  );
};
