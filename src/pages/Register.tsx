import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Building2, Lock, Mail, User, ArrowRight, AlertCircle } from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext';
import { AuthShell } from '../components/AuthShell';

export const Register: React.FC = () => {
  const { user, register } = useWarehouse();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [warehouseName, setWarehouseName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const result = await register({
        email,
        password,
        fullName,
        warehouseZone: warehouseName,
      });
      if (!result.ok) {
        setErrorMessage(result.error || 'Gagal membuat akun.');
      } else {
        navigate('/', { replace: true });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Buat Akun Gudang Baru"
      subtitle="Setiap akun mendapatkan ruang data inventaris dan folder dokumen yang terpisah dengan Supabase RLS."
      footer={
        <>
          Sudah memiliki akun?{' '}
          <Link
            to="/login"
            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
          >
            Masuk di sini
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
            htmlFor="reg-fullname"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
          >
            Nama lengkap penanggung jawab
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="reg-fullname"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Contoh: Hendra Wijaya"
              className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="reg-warehouse"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
          >
            Nama lokasi / cabang gudang
          </label>
          <div className="relative">
            <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="reg-warehouse"
              type="text"
              required
              value={warehouseName}
              onChange={(e) => setWarehouseName(e.target.value)}
              placeholder="Contoh: Gudang Distribusi Surabaya Timur"
              className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="reg-email"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
          >
            Email kerja
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="reg-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hendra@logistik.co.id"
              className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="reg-password"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
          >
            Kata sandi (minimal 6 karakter)
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="reg-password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
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
          <span>{submitting ? 'Membuat akun...' : 'Buat Akun & Masuk'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </AuthShell>
  );
};
