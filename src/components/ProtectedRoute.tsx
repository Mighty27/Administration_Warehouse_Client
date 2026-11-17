import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useWarehouse } from '../context/WarehouseContext';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, authLoading } = useWarehouse();
  const location = useLocation();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-sm w-full text-center shadow-xs">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-900">Memverifikasi Sesi & Kebijakan RLS...</p>
          <p className="text-xs text-slate-500 mt-1">Mengautentikasi kredensial pengguna gudang</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
