import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export const useToast = () => useContext(ToastContext);

let toastId = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'success', duration = 3000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-40 md:bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(t => (
          <ToastMessage key={t.id} item={t} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const ICONS = {
  success: <CheckCircle size={18} className="text-green-400 shrink-0" />,
  error: <XCircle size={18} className="text-red-400 shrink-0" />,
  warning: <AlertTriangle size={18} className="text-yellow-400 shrink-0" />,
  info: <Info size={18} className="text-blue-400 shrink-0" />,
};

const BG = {
  success: 'bg-green-900/90 border-green-600',
  error: 'bg-red-900/90 border-red-600',
  warning: 'bg-yellow-900/90 border-yellow-600',
  info: 'bg-blue-900/90 border-blue-600',
};

const ToastMessage: React.FC<{ item: ToastItem; onDismiss: (id: number) => void }> = ({ item, onDismiss }) => {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), item.duration - 300);
    const removeTimer = setTimeout(() => onDismiss(item.id), item.duration);
    return () => { clearTimeout(exitTimer); clearTimeout(removeTimer); };
  }, [item, onDismiss]);

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border shadow-xl backdrop-blur-md transition-all duration-300 ${BG[item.type]} ${exiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0 animate-in slide-in-from-right-5'}`}
    >
      {ICONS[item.type]}
      <span className="text-white text-sm font-medium flex-1">{item.message}</span>
      <button onClick={() => onDismiss(item.id)} className="text-white/50 hover:text-white transition shrink-0">
        <X size={14} />
      </button>
    </div>
  );
};
