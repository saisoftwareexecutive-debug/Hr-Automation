'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toast: {
    success: (msg: string, duration?: number) => void;
    error: (msg: string, duration?: number) => void;
    warning: (msg: string, duration?: number) => void;
    info: (msg: string, duration?: number) => void;
  };
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Graceful fallback if used outside provider
    return {
      toast: {
        success: (msg: string) => console.log('[SUCCESS]', msg),
        error: (msg: string) => console.error('[ERROR]', msg),
        warning: (msg: string) => console.warn('[WARN]', msg),
        info: (msg: string) => console.log('[INFO]', msg),
      },
    };
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration = 4000) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toastMethods = {
    success: (msg: string, dur?: number) => addToast('success', msg, dur),
    error: (msg: string, dur?: number) => addToast('error', msg, dur),
    warning: (msg: string, dur?: number) => addToast('warning', msg, dur),
    info: (msg: string, dur?: number) => addToast('info', msg, dur),
  };

  return (
    <ToastContext.Provider value={{ toast: toastMethods }}>
      {children}
      {/* Toast container portal */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl shadow-xl border transition-all transform animate-in slide-in-from-bottom-5 duration-200 text-xs font-semibold ${
              t.type === 'success'
                ? 'bg-emerald-950/95 text-emerald-50 border-emerald-800'
                : t.type === 'error'
                ? 'bg-rose-950/95 text-rose-50 border-rose-800'
                : t.type === 'warning'
                ? 'bg-amber-950/95 text-amber-50 border-amber-800'
                : 'bg-slate-900/95 text-slate-50 border-slate-700'
            }`}
          >
            {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
            {t.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
            {t.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
            {t.type === 'info' && <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />}

            <div className="flex-1 leading-relaxed whitespace-pre-wrap">{t.message}</div>

            <button
              onClick={() => removeToast(t.id)}
              className="text-white/60 hover:text-white p-0.5 rounded transition"
              aria-label="Close notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

