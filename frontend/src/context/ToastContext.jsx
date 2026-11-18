import { createContext, useCallback, useContext, useState } from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';

const ToastContext = createContext(() => {});

// toast(message, type, { action: { label, onClick }, duration })
// Toast dengan aksi (mis. Undo) tampil lebih lama agar pengguna sempat membatalkan.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (message, type = 'success', opts = {}) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((t) => [...t, { id, message, type, action: opts.action }]);
      const ms = opts.duration ?? (opts.action ? 6000 : type === 'error' ? 5000 : 2800);
      setTimeout(() => dismiss(id), ms);
      return id;
    },
    [dismiss],
  );
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type === 'error' ? 'error' : ''}`}>
            {t.type === 'error' ? <CircleAlert size={16} /> : <CircleCheck size={16} />}
            <span className="grow">{t.message}</span>
            {t.action && (
              <button
                className="toast-action"
                onClick={() => {
                  dismiss(t.id);
                  t.action.onClick();
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
