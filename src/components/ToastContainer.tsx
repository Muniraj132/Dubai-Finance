import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { useAppStore, useToasts } from '../stores/useAppStore';

export default function ToastContainer() {
  const toasts = useToasts();
  const dismissToast = useAppStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-xl shadow-xl border text-sm ${
            t.type === 'success'
              ? 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400'
              : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400'
          }`}
        >
          {t.type === 'success' ? (
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
          )}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => dismissToast(t.id)} className="shrink-0 opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
