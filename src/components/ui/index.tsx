import { ReactNode, useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

// Card
export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`card ${className}`}>{children}</div>
);

// StatCard
export const StatCard = ({
  title, value, sub, icon, trend, color = 'orange'
}: {
  title: string; value: string; sub?: string; icon: ReactNode; trend?: number; color?: string;
}) => (
  <div className="card flex flex-col gap-3">
    <div className="flex items-start justify-between">
      <span className="text-sm text-muted font-medium">{title}</span>
      <div className={`w-9 h-9 rounded-xl bg-${color}-500/15 flex items-center justify-center text-${color}-400`}>
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
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export const Button = ({
  children, variant = 'primary', className = '', ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) => {
  const variants: Record<BtnVariant, string> = {
    primary: 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/25',
    secondary: 'bg-white/10 hover:bg-white/15 text-primary border border-white/10',
    danger: 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20',
    ghost: 'hover:bg-white/5 text-muted hover:text-primary',
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

// Badge
export const Badge = ({ children, color = 'orange' }: { children: ReactNode; color?: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-${color}-500/15 text-${color}-400`}>
    {children}
  </span>
);

// ProgressBar
export const ProgressBar = ({ value, color = '#f97316', showLabel = true }: { value: number; color?: string; showLabel?: boolean }) => {
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
export const PageHeader = ({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) => (
  <div className="flex items-start justify-between mb-6 gap-4">
    <div>
      <h1 className="text-xl font-bold text-primary tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

// ConfirmDialog
export const ConfirmDialog = ({
  open, onClose, onConfirm, title, message
}: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string }) => (
  <Modal open={open} onClose={onClose} title={title}>
    <p className="text-sm text-muted mb-5">{message}</p>
    <div className="flex justify-end gap-3">
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button variant="danger" onClick={() => { onConfirm(); onClose(); }}>Delete</Button>
    </div>
  </Modal>
);
