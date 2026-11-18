import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, AlertCircle, Building2 } from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext';
import { AuthShell } from '../components/AuthShell';

export const Login: React.FC = () => {
  const { user, signIn, loginDemoAccount } = useWarehouse();
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as { from?: string })?.from || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to={fromPath} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const result = await signIn({ email, password });
      if (result.error) {
        setErrorMessage(result.error);
      } else {
        navigate(fromPath, { replace: true });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string) => {
    await loginDemoAccount(demoEmail);
    navigate(fromPath, { replace: true });
  };

  return (
    <AuthShell
      title="Masuk ke LogiVault WMS"
      subtitle="Kelola lokasi rak hierarkis, FEFO, Replenishment, Picking, Packing, dan Shipping Manifest."
      footer={
        <>
          Belum punya akun gudang?{' '}
          <Link
            to="/register"
            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
          >
            Daftar akun baru
          </Link>
        </>
      }
    >
      {errorMessage && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2.5 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-medium"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="login-email"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
          >
            Email akun gudang
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@perusahaan.co.id"
              className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="login-password"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
          >
            Kata sandi
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
        >
          <span>{submitting ? 'Memverifikasi sesi...' : 'Masuk'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {/* Switch Demo Account Instan (Multi-Account RLS Isolation) */}
      <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2.5">
          Akses Cepat Akun Demo Gudang (Uji Isolasi Data RLS):
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => handleDemoLogin('budi.gudang@logivault.id')}
            className="text-left p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-500 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
              <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="truncate">Hub Cikarang Blok A</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              Budi Santoso · 8 SKU & 6 Order
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleDemoLogin('siti.logistik@logivault.id')}
            className="text-left p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-500 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
              <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate">Depo Surabaya Timur</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              Siti Rahmawati · 2 SKU & 1 Order
            </p>
          </button>
        </div>
      </div>
    </AuthShell>
  );
};
