import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, X } from 'lucide-react';

const ToastContext = createContext(() => {});

const supportsPopover = typeof HTMLElement !== 'undefined' && Object.hasOwn(HTMLElement.prototype, 'popover');

// toast(message, type, { action: { label, onClick }, duration })
// Toast tampil di Top Layer (popover="manual"), menjeda auto-dismiss saat fokus/hover, dan
// mengumumkan pesan ke pembaca layar via ariaNotify() / live region fallback.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [announcement, setAnnouncement] = useState('');
  const regionRef = useRef(null);
  const timersRef = useRef(new Map());
  const returnFocusRef = useRef(null);

  const clearTimer = useCallback((id) => {
    const entry = timersRef.current.get(id);
    if (entry?.timer) clearTimeout(entry.timer);
  }, []);

  const dismiss = useCallback(
    (id) => {
      clearTimer(id);
      timersRef.current.delete(id);
      const region = regionRef.current;
      const hadFocus = region?.contains(document.activeElement);
      setToasts((prev) => {
        const next = prev.filter((x) => x.id !== id);
        if (hadFocus) {
          requestAnimationFrame(() => {
            const nextBtn = region?.querySelector('button');
            if (nextBtn) nextBtn.focus({ preventScroll: true });
            else if (returnFocusRef.current?.focus && document.contains(returnFocusRef.current)) {
              returnFocusRef.current.focus({ preventScroll: true });
            }
          });
        }
        return next;
      });
    },
    [clearTimer],
  );

  const scheduleDismiss = useCallback(
    (id, ms) => {
      clearTimer(id);
      const timer = setTimeout(() => dismiss(id), ms);
      timersRef.current.set(id, { ms, timer });
    },
    [clearTimer, dismiss],
  );

  const pauseTimer = useCallback(
    (id) => {
      clearTimer(id);
    },
    [clearTimer],
  );

  const resumeTimer = useCallback(
    (id) => {
      const entry = timersRef.current.get(id);
      if (!entry) return;
      scheduleDismiss(id, entry.ms);
    },
    [scheduleDismiss],
  );

  const push = useCallback(
    (message, type = 'success', opts = {}) => {
      const id = Math.random().toString(36).slice(2);
      const ms = opts.duration ?? (opts.action ? 6000 : type === 'error' ? 5000 : 2800);
      setToasts((t) => [...t, { id, message, type, action: opts.action }]);
      scheduleDismiss(id, ms);

      const spoken = opts.action ? `${message}. Aksi tersedia` : message;
      if (typeof document !== 'undefined' && typeof document.ariaNotify === 'function') {
        document.ariaNotify(spoken);
      } else {
        setAnnouncement('');
        requestAnimationFrame(() => setAnnouncement(spoken));
      }
      return id;
    },
    [scheduleDismiss],
  );

  useEffect(() => {
    const el = regionRef.current;
    if (!supportsPopover || !el) return;
    try {
      if (toasts.length > 0) {
        if (!el.matches(':popover-open')) el.showPopover();
      } else if (el.matches(':popover-open')) {
        el.hidePopover();
      }
    } catch {
      /* abaikan bila status popover berubah di tengah render */
    }
  }, [toasts.length]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((entry) => entry?.timer && clearTimeout(entry.timer));
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      <div
        ref={regionRef}
        className="toasts"
        role="region"
        aria-label="Notifikasi"
        {...(supportsPopover ? { popover: 'manual' } : {})}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast ${t.type === 'error' ? 'error' : ''}`}
            onMouseEnter={() => pauseTimer(t.id)}
            onMouseLeave={() => resumeTimer(t.id)}
            onFocus={() => {
              if (!regionRef.current?.contains(document.activeElement)) {
                returnFocusRef.current = document.activeElement;
              }
              pauseTimer(t.id);
            }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) resumeTimer(t.id);
            }}
          >
            {t.type === 'error' ? (
              <CircleAlert size={16} aria-hidden="true" />
            ) : (
              <CircleCheck size={16} aria-hidden="true" />
            )}
            <span className="grow">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  dismiss(t.id);
                  t.action.onClick();
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" className="toast-close" aria-label="Tutup notifikasi" onClick={() => dismiss(t.id)}>
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
