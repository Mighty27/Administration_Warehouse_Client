import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useWarehouse } from '../context/WarehouseContext';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useWarehouse();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full px-4 sm:px-0 pointer-events-none"
    >
      {toasts.map((toast) => {
        const Icon =
          toast.type === 'success'
            ? CheckCircle2
            : toast.type === 'error'
            ? AlertCircle
            : Info;

        const iconColor =
          toast.type === 'success'
            ? 'text-emerald-600 dark:text-emerald-400'
            : toast.type === 'error'
            ? 'text-rose-600 dark:text-rose-400'
            : 'text-indigo-600 dark:text-indigo-400';

        const borderAccent =
          toast.type === 'success'
            ? 'border-emerald-200 dark:border-emerald-800/80'
            : toast.type === 'error'
            ? 'border-rose-200 dark:border-rose-800/80'
            : 'border-indigo-200 dark:border-indigo-800/80';

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto bg-white dark:bg-slate-900 border ${borderAccent} rounded-xl p-3.5 shadow-lg transition-colors`}
          >
            <div className="flex items-start gap-2.5">
              <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {toast.title}
                </p>
                {toast.description && (
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label={`Tutup notifikasi ${toast.title}`}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
