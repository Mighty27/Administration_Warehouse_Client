import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, authLoading } = useWarehouse();
  const location = useLocation();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 transition-colors">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center max-w-sm w-full">
          <RefreshCw className="w-6 h-6 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Memverifikasi Sesi & Kebijakan RLS...
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Mengautentikasi kredensial pengguna gudang
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
