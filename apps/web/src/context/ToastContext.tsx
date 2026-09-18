import React, { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (options: { type?: ToastType; title?: string; message: string; duration?: number }) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback(({ type = 'info', title, message, duration = 4000 }: {
    type?: ToastType;
    title?: string;
    message: string;
    duration?: number;
  }) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev.slice(-4), { id, type, title, message, duration }]);
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const success = useCallback((message: string, title?: string) => toast({ type: 'success', message, title }), [toast]);
  const error = useCallback((message: string, title?: string) => toast({ type: 'error', message, title }), [toast]);
  const warning = useCallback((message: string, title?: string) => toast({ type: 'warning', message, title }), [toast]);
  const info = useCallback((message: string, title?: string) => toast({ type: 'info', message, title }), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed top-6 right-6 z-99999 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
          role="region"
          aria-label="Notifications"
        >
          {toasts.map(t => {
            const isSuccess = t.type === 'success';
            const isError = t.type === 'error';
            const isWarning = t.type === 'warning';

            return (
              <div
                key={t.id}
                className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-xl backdrop-blur-md transition-all duration-300 animate-slide-down ${
                  isSuccess
                    ? 'bg-emerald-50/95 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
                    : isError
                    ? 'bg-rose-50/95 dark:bg-rose-950/90 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-100'
                    : isWarning
                    ? 'bg-amber-50/95 dark:bg-amber-950/90 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100'
                    : 'bg-white/95 dark:bg-gray-900/90 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white'
                }`}
              >
                <div className="shrink-0 mt-0.5">
                  {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
                  {isError && <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
                  {isWarning && <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
                  {!isSuccess && !isError && !isWarning && <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
                </div>

                <div className="flex-1 min-w-0 pr-1">
                  {t.title && (
                    <h4 className="text-xs font-bold uppercase tracking-wider mb-0.5 opacity-90">
                      {t.title}
                    </h4>
                  )}
                  <p className="text-xs leading-relaxed font-medium wrap-break-word">
                    {t.message}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => removeToast(t.id)}
                  className="shrink-0 p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  aria-label="Close notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      toast: ({ message }) => console.warn('[Toast]', message),
      success: (message) => console.log('[Success]', message),
      error: (message) => console.error('[Error]', message),
      warning: (message) => console.warn('[Warning]', message),
      info: (message) => console.info('[Info]', message),
    };
  }
  return context;
}
