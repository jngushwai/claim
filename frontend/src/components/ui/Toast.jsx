import { createContext, useContext, useState, useCallback } from 'react';

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="fixed bottom-6 right-6 space-y-2 z-50">
        {toasts.map(t => (
          <div key={t.id} className={`px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium flex items-center gap-2 animate-pulse-once ${
            t.type === 'error' ? 'bg-red-500' : t.type === 'warn' ? 'bg-yellow-500' : 'bg-accent'
          }`}>
            {t.type === 'error' ? '✕' : t.type === 'warn' ? '⚠' : '✓'} {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
