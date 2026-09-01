import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Icon } from './Icon';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel?: () => void;
}

interface ToastContextValue {
  toast: {
    success: (message: string, title?: string, duration?: number) => void;
    error: (message: string, title?: string, duration?: number) => void;
    info: (message: string, title?: string, duration?: number) => void;
    warning: (message: string, title?: string, duration?: number) => void;
  };
  showConfirm: (options: ConfirmDialogOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Standalone global dispatcher so toast can be imported directly anywhere if needed
let globalToastHandler: ToastContextValue['toast'] | null = null;
let globalConfirmHandler: ((opts: ConfirmDialogOptions) => void) | null = null;

export const toast = {
  success: (msg: string, title?: string, duration?: number) => globalToastHandler?.success(msg, title, duration),
  error: (msg: string, title?: string, duration?: number) => globalToastHandler?.error(msg, title, duration),
  info: (msg: string, title?: string, duration?: number) => globalToastHandler?.info(msg, title, duration),
  warning: (msg: string, title?: string, duration?: number) => globalToastHandler?.warning(msg, title, duration),
};

export const confirmModal = (options: ConfirmDialogOptions) => {
  if (globalConfirmHandler) {
    globalConfirmHandler(options);
  } else {
    // Fallback if provider not mounted
    if (window.confirm(`${options.title}\n\n${options.message}`)) {
      options.onConfirm();
    } else {
      options.onCancel?.();
    }
  }
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogOptions | null>(null);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string, title?: string, duration: number = 3800) => {
    // If it's a generic cancel error from OS file dialogs, don't show any toast
    if (message && (message.toLowerCase().includes('cancelled') || message.toLowerCase().includes('canceled'))) {
      return;
    }

    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const newToast: ToastItem = { id, type, title, message, duration };

    setToasts((prev) => [...prev.slice(-4), newToast]); // Keep maximum 5 toasts at once

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const toastMethods = React.useMemo(() => ({
    success: (msg: string, title?: string, duration?: number) => addToast('success', msg, title, duration),
    error: (msg: string, title?: string, duration?: number) => addToast('error', msg, title, duration),
    info: (msg: string, title?: string, duration?: number) => addToast('info', msg, title, duration),
    warning: (msg: string, title?: string, duration?: number) => addToast('warning', msg, title, duration),
  }), [addToast]);

  const showConfirm = useCallback((options: ConfirmDialogOptions) => {
    setConfirmDialog(options);
  }, []);

  useEffect(() => {
    globalToastHandler = toastMethods;
    globalConfirmHandler = showConfirm;
    return () => {
      globalToastHandler = null;
      globalConfirmHandler = null;
    };
  }, [toastMethods, showConfirm]);

  return (
    <ToastContext.Provider value={{ toast: toastMethods, showConfirm }}>
      {children}

      {/* Floating Toast Notifications Container */}
      <div className="fixed bottom-4 right-4 z-[99999] flex flex-col gap-2.5 max-w-[380px] w-full pointer-events-none select-none">
        {toasts.map((t) => {
          const isError = t.type === 'error';
          const isSuccess = t.type === 'success';
          const isWarning = t.type === 'warning';

          let borderClass = 'border-blue-500/30 bg-white/95 dark:bg-[#1e232a]/95 text-text-primary';
          let iconColor = 'text-accent-blue';
          let iconName = 'explain';

          if (isSuccess) {
            borderClass = 'border-emerald-500/30 bg-white/95 dark:bg-[#1e232a]/95 text-text-primary';
            iconColor = 'text-emerald-500';
            iconName = 'check';
          } else if (isError) {
            borderClass = 'border-rose-500/30 bg-white/95 dark:bg-[#1e232a]/95 text-text-primary';
            iconColor = 'text-rose-500';
            iconName = 'close';
          } else if (isWarning) {
            borderClass = 'border-amber-500/30 bg-white/95 dark:bg-[#1e232a]/95 text-text-primary';
            iconColor = 'text-amber-500';
            iconName = 'explain';
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-2xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-2 duration-200 ${borderClass}`}
            >
              <div className={`mt-0.5 shrink-0 p-1 rounded-lg bg-black/5 dark:bg-white/5 ${iconColor}`}>
                <Icon name={iconName} size={15} />
              </div>
              <div className="flex-1 min-w-0 pr-1">
                {t.title && (
                  <h4 className="text-xs font-bold font-display tracking-tight text-text-primary mb-0.5">
                    {t.title}
                  </h4>
                )}
                <p className="text-xs text-text-secondary leading-relaxed font-normal break-words">
                  {t.message}
                </p>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-text-muted hover:text-text-primary p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer border-0 bg-transparent shrink-0"
                title="Dismiss"
              >
                <Icon name="close" size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal Popup */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
          <div className="bg-bg-panel border border-border-color rounded-2xl shadow-2xl max-w-[420px] w-full p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl shrink-0 ${confirmDialog.type === 'danger' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}>
                <Icon name={confirmDialog.type === 'danger' ? 'trash' : 'explain'} size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold font-display text-text-primary mb-1">
                  {confirmDialog.title}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {confirmDialog.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border-color-light">
              <button
                onClick={() => {
                  confirmDialog.onCancel?.();
                  setConfirmDialog(null);
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-text-secondary hover:bg-bg-app transition-colors cursor-pointer border border-border-color bg-transparent"
              >
                {confirmDialog.cancelText || 'Cancel'}
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-all shadow-sm cursor-pointer border-0 ${
                  confirmDialog.type === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-[#EE4324] hover:bg-[#EE4324]/90'
                }`}
              >
                {confirmDialog.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};
