import { ReactNode, useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

// Card
export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`card ${className}`}>{children}</div>
);

const colorMap: Record<string, { bg: string; text: string }> = {
  theme: { bg: 'bg-[#6366F1]/15', text: 'text-[#6366F1]' },
  green: { bg: 'bg-green-500/15', text: 'text-green-400' },
  red: { bg: 'bg-red-500/15', text: 'text-red-400' },
  blue: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  yellow: { bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  amber: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  pink: { bg: 'bg-pink-500/15', text: 'text-pink-400' },
  orange: { bg: 'bg-orange-500/15', text: 'text-orange-400' },
  purple: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  cyan: { bg: 'bg-cyan-500/15', text: 'text-cyan-400' },
  indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400' },
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
};

// StatCard
export const StatCard = ({
  title, value, sub, icon, trend, color = 'theme'
}: {
  title: string; value: string; sub?: string; icon: ReactNode; trend?: number; color?: string;
}) => {
  const colors = colorMap[color] || colorMap.theme;
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <span className="text-sm text-muted font-medium">{title}</span>
        <div className={`w-9 h-9 rounded-xl ${colors.bg} flex items-center justify-center ${colors.text}`}>
          {icon}
        </div>
      </div>
    <div>
      <div className="text-2xl font-bold text-primary tracking-tight">{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
    {trend !== undefined && (
      <div className={`text-xs font-medium ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
        {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}% vs last month
      </div>
    )}
  </div>
  );
};

// Modal
export const Modal = ({
  open, onClose, title, children
}: { open: boolean; onClose: () => void; title: string; children: ReactNode }) => {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-card-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-card-border">
          <h2 className="text-base font-semibold text-primary">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-primary transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
};

// FormField
export const FormField = ({ label, children, error }: { label: string; children: ReactNode; error?: string }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-medium text-muted uppercase tracking-wide">{label}</label>
    {children}
    {error && <span className="text-xs text-red-400">{error}</span>}
  </div>
);

// Input
export const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={`input ${props.className ?? ''}`} />
);

// Select
export const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} className={`input ${props.className ?? ''}`} />
);

// Textarea
export const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...props} className={`input min-h-[80px] resize-none ${props.className ?? ''}`} />
);

// Button
export type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export const Button = ({
  children, variant = 'primary', className = '', onClick, disabled, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) => {
  // Most onClick handlers in this app are async (they await a Supabase
  // write before closing their modal — see useAppStore's writeThrough
  // pattern). On a slow network that await can take a while, and without
  // this guard the button stays clickable the whole time, so a fast
  // double-click fires the handler twice and creates two records.
  // Auto-detecting a Promise return and disabling for its duration fixes
  // every Save/Add/Update button in the app from this one place.
  const [pending, setPending] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (pending) return;
    const result = onClick?.(e) as unknown;
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      setPending(true);
      (result as Promise<unknown>).finally(() => setPending(false));
    }
  };

  const variants: Record<BtnVariant, string> = {
    primary: 'bg-[#6366F1] hover:bg-[#4F46E5] text-white shadow-lg shadow-[#6366F1]/25',
    secondary: 'bg-white/10 hover:bg-white/15 text-primary border border-white/10',
    danger: 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20',
    ghost: 'hover:bg-white/5 text-muted hover:text-primary',
  };
  return (
    <button
      {...props}
      onClick={handleClick}
      disabled={disabled || pending}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

// Badge
export const Badge = ({ children, color = 'theme' }: { children: ReactNode; color?: string }) => {
  const colors = colorMap[color] || colorMap.theme;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
      {children}
    </span>
  );
};

// FilterTabs — segmented control for switching a list between subsets.
// Scrolls horizontally instead of wrapping on narrow screens.
export const FilterTabs = <T extends string>({
  tabs, value, onChange,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
}) => (
  <div role="tablist" className="inline-flex max-w-full overflow-x-auto gap-1 p-1 bg-white/5 rounded-lg">
    {tabs.map(tab => {
      const active = tab.value === value;
      return (
        <button
          key={tab.value}
          role="tab"
          aria-selected={active}
          onClick={() => onChange(tab.value)}
          className={`flex items-center gap-2 whitespace-nowrap px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
            active ? 'bg-[#6366F1] text-white shadow-sm shadow-[#6366F1]/30' : 'text-muted hover:text-primary'
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={`text-xs px-1.5 rounded-full ${active ? 'bg-white/20' : 'bg-white/10'}`}>{tab.count}</span>
          )}
        </button>
      );
    })}
  </div>
);

// ProgressBar
export const ProgressBar = ({ value, color = '#6366F1', showLabel = true }: { value: number; color?: string; showLabel?: boolean }) => {
  const pct = Math.min(100, Math.max(0, value));
  const barColor = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : color;
  return (
    <div className="space-y-1">
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      {showLabel && <div className="text-xs text-muted text-right">{pct.toFixed(1)}%</div>}
    </div>
  );
};

// EmptyState
export const EmptyState = ({ icon, title, description }: { icon: ReactNode; title: string; description?: string }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="text-muted mb-3 opacity-40">{icon}</div>
    <div className="text-primary font-medium mb-1">{title}</div>
    {description && <div className="text-sm text-muted max-w-xs">{description}</div>}
  </div>
);

// PageHeader
// flex-wrap matters here: most pages pass a single button as `action`, which
// always fits next to the title, but a page with a wider action (e.g.
// multiple buttons) needs to be able to drop to its own row on narrow
// screens instead of overflowing/squeezing against `shrink-0`.
export const PageHeader = ({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) => (
  <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
    <div>
      <h1 className="text-xl font-bold text-primary tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

// ConfirmDialog
export const ConfirmDialog = ({
  open, onClose, onConfirm, title, message, confirmLabel = 'Delete', confirmVariant = 'danger'
}: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string;
  confirmLabel?: string; confirmVariant?: BtnVariant;
}) => (
  <Modal open={open} onClose={onClose} title={title}>
    <p className="text-sm text-muted mb-5">{message}</p>
    <div className="flex justify-end gap-3">
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button variant={confirmVariant} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button>
    </div>
  </Modal>
);
