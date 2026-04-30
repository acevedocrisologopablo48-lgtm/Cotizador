'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

type ToastVariant = 'default' | 'destructive' | 'info';

interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

const VARIANT_STYLES: Record<ToastVariant, { container: string; icon: React.ReactNode; bar: string }> = {
  destructive: {
    container: 'border-red-200 bg-red-50 text-red-900',
    icon: <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />,
    bar: 'bg-red-400',
  },
  default: {
    container: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />,
    bar: 'bg-emerald-400',
  },
  info: {
    container: 'border-blue-200 bg-blue-50 text-blue-900',
    icon: <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />,
    bar: 'bg-blue-400',
  },
};

function ToastItem({ t, onDismiss }: { t: Toast; onDismiss: (id: string) => void }) {
  const variant = t.variant ?? 'default';
  const duration = t.duration ?? (variant === 'destructive' ? 6000 : 4000);
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      className={cn(
        'pointer-events-auto rounded-xl border shadow-xl animate-toast-in backdrop-blur-sm overflow-hidden',
        styles.container
      )}
    >
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        {styles.icon}
        <div className="flex-1 min-w-0">
          {t.title && <p className="text-sm font-semibold leading-snug">{t.title}</p>}
          {t.description && <p className="text-sm opacity-75 mt-0.5 leading-snug">{t.description}</p>}
        </div>
        <button
          onClick={() => onDismiss(t.id)}
          className="opacity-40 hover:opacity-100 transition-opacity shrink-0 mt-0.5"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {/* Progress bar */}
      <div className="h-[3px] w-full bg-black/5">
        <div
          className={cn('h-full rounded-full origin-left', styles.bar)}
          style={{ animation: `toast-progress ${duration}ms linear forwards` }}
        />
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const toast = React.useCallback((t: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    const duration = t.duration ?? (t.variant === 'destructive' ? 6000 : 4000);
    setToasts((prev) => [...prev, { ...t, id, duration }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, duration);
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} t={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');

  const addToast = React.useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'success') => {
      ctx.toast({
        title: message,
        variant: type === 'error' ? 'destructive' : type === 'info' ? 'info' : undefined,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx.toast]
  );

  return React.useMemo(() => ({ ...ctx, addToast }), [ctx, addToast]);
}
