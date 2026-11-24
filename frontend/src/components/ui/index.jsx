import { cloneElement, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Inbox,
  CircleAlert,
  RotateCw,
  Asterisk,
  Users,
  CalendarDays,
  Rocket,
  BookOpen,
  Megaphone,
} from 'lucide-react';

const supportsPopover = typeof HTMLElement !== 'undefined' && Object.hasOwn(HTMLElement.prototype, 'popover');
const supportsAnchor =
  typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('position-area: block-end');
const supportsClosedBy = typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype;

let cachedDisplayTransition;
function canTransitionDisplay() {
  if (cachedDisplayTransition !== undefined) return cachedDisplayTransition;
  if (
    typeof window === 'undefined' ||
    !window.CSS?.supports?.('transition-behavior', 'allow-discrete') ||
    !document.body
  ) {
    return false;
  }
  const probe = document.createElement('div');
  probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  getComputedStyle(probe).display;
  probe.style.display = 'none';
  cachedDisplayTransition = getComputedStyle(probe).display === 'block';
  probe.remove();
  return cachedDisplayTransition;
}

function supportsTopLayerExit() {
  return typeof window !== 'undefined' && !!window.CSS?.supports?.('overlay', 'auto') && canTransitionDisplay();
}

export function useModalDialog(onClose) {
  const dialogRef = useRef(null);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const requestClose = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog || !dialog.open || closingRef.current) return;
    if (!supportsTopLayerExit()) {
      closingRef.current = true;
      dialog.setAttribute('data-closing', '');
      const animations = dialog.getAnimations?.({ subtree: true }) ?? [];
      const done =
        animations.length > 0
          ? Promise.race([
              Promise.allSettled(animations.map((a) => a.finished)),
              new Promise((r) => setTimeout(r, 400)),
            ])
          : Promise.resolve();
      done.then(() => {
        if (!dialog.hasAttribute('data-closing')) return;
        dialog.removeAttribute('data-closing');
        closingRef.current = false;
        if (dialog.open) dialog.close();
      });
      return;
    }
    dialog.close();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    if (!dialog.open) {
      try {
        dialog.showModal();
      } catch {
        /* abaikan bila sudah terbuka */
      }
    }
    const handleClose = () => {
      closingRef.current = false;
      dialog.removeAttribute('data-closing');
      onCloseRef.current?.();
    };
    const handleCancel = (e) => {
      if (!supportsTopLayerExit()) {
        e.preventDefault();
        requestClose();
      }
    };
    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('cancel', handleCancel);

    let cleanupBackdrop = () => {};
    if (!supportsClosedBy) {
      let pressedOutside = false;
      const outside = (e) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      const onDown = (e) => {
        pressedOutside = outside(e);
      };
      const onUp = (e) => {
        if (pressedOutside && outside(e)) requestClose();
        pressedOutside = false;
      };
      dialog.addEventListener('pointerdown', onDown);
      dialog.addEventListener('pointerup', onUp);
      cleanupBackdrop = () => {
        dialog.removeEventListener('pointerdown', onDown);
        dialog.removeEventListener('pointerup', onUp);
      };
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('cancel', handleCancel);
      cleanupBackdrop();
    };
  }, [requestClose]);

  return { dialogRef, requestClose };
}

// Foto profil bila ada (seperti prototipe Figma); bila tidak, inisial nama di atas warna akun.
export function Avatar({ user, size = 24 }) {
  if (!user) return null;
  if (user.avatarUrl) {
    return (
      <img
        className="avatar avatar-photo"
        src={user.avatarUrl}
        alt={user.name}
        title={user.name}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span
      className="avatar"
      title={user.name}
      style={{ width: size, height: size, fontSize: size * 0.42, background: user.avatarColor || '#71717a' }}
    >
      {initials}
    </span>
  );
}

export function AvatarStack({ users = [], size = 24, max = 4 }) {
  const shown = users.slice(0, max);
  return (
    <span className="avatar-stack" role="group" aria-label={users.map((u) => u.name).join(', ')}>
      {shown.map((u) => (
        <Avatar key={u.id} user={u} size={size} />
      ))}
      {users.length > max && (
        <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, background: '#a1a1aa' }}>
          +{users.length - max}
        </span>
      )}
    </span>
  );
}

export function Modal({ title, subtitle, onClose, children, footer, size }) {
  const titleId = useId();
  const { dialogRef, requestClose } = useModalDialog(onClose);
  return (
    <dialog
      ref={dialogRef}
      className={`modal-dialog ${size === 'lg' ? 'modal-lg' : ''}`}
      aria-labelledby={titleId}
      {...{ closedby: 'any' }}
    >
      <div className="modal-head">
        <div>
          <h2 id={titleId} className="modal-title">
            {title}
          </h2>
          {subtitle && (
            <p className="muted sm" style={{ marginTop: 4 }}>
              {subtitle}
            </p>
          )}
        </div>
        <button type="button" className="icon-btn" onClick={requestClose} aria-label="Tutup">
          <X size={16} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
      {footer && <div className="modal-foot">{footer}</div>}
    </dialog>
  );
}

// Dialog konfirmasi / penolakan dengan alasan yang jelas (keadaan khusus, Gambar 2.19).
export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', danger, onConfirm, onClose, busy, error }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className={`btn ${onConfirm ? '' : 'btn-primary'}`}
            autoFocus={!!danger || !onConfirm}
            onClick={onClose}
          >
            {onConfirm ? 'Cancel' : 'OK'}
          </button>
          {onConfirm && (
            <button
              type="button"
              className={`btn ${danger ? 'btn-danger-solid' : 'btn-primary'}`}
              onClick={onConfirm}
              disabled={busy}
            >
              {confirmLabel}
            </button>
          )}
        </>
      }
    >
      <p className="sm" style={{ color: 'var(--text-2)', lineHeight: 1.55 }}>
        {message}
      </p>
      {error && <FormError message={error} />}
    </Modal>
  );
}

export function Field({ label, error, children, hint, htmlFor, hintId: hintIdProp, errorId: errorIdProp }) {
  const autoId = useId();
  const hintId = hintIdProp || `${autoId}-hint`;
  const errorId = errorIdProp || `${autoId}-error`;
  const describedBy = [hint && !error ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  let content = children;
  if (
    isValidElement(children) &&
    typeof children.type === 'string' &&
    ['input', 'select', 'textarea'].includes(children.type)
  ) {
    content = cloneElement(children, {
      'aria-invalid': children.props['aria-invalid'] ?? (error ? true : undefined),
      'aria-describedby': children.props['aria-describedby'] ?? describedBy,
    });
  }

  return (
    <div className="field">
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {content}
      {hint && !error && (
        <span id={hintId} className="xs muted">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function FormError({ message }) {
  if (!message) return null;
  return (
    <div className="form-error" role="alert">
      <CircleAlert size={16} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, children, action }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={20} />
      </div>
      <h3>{title}</h3>
      {children && (
        <p className="sm" style={{ maxWidth: 360 }}>
          {children}
        </p>
      )}
      {action}
    </div>
  );
}

export function LoadingBlock({ rows = 3, height = 56 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-busy="true" aria-label="Memuat">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height }} />
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <EmptyState
      icon={CircleAlert}
      title="Gagal memuat data"
      action={
        onRetry && (
          <button type="button" className="btn" onClick={onRetry}>
            <RotateCw size={14} />
            Coba lagi
          </button>
        )
      }
    >
      {error?.response?.data?.message || 'Periksa koneksi ke server lalu coba lagi.'}
    </EmptyState>
  );
}

// Menu dropdown yang tertutup saat klik di luar atau Esc. Menggunakan Popover API (Top Layer)
// + CSS Anchor Positioning (dengan fallback koordinat JS untuk browser tanpa position-area) agar
// tetap tampil di atas <dialog> modal dan otomatis membalik arah di tepi layar.
export function Menu({ trigger, children, align = 'right', width }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const popRef = useRef(null);
  const [pos, setPos] = useState(null);
  const popId = useId();
  const anchorName = `--menu-${popId.replace(/:/g, '')}`;

  const closeMenu = useCallback(() => {
    setOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setPos(null);
    setOpen((o) => !o);
  }, []);

  useEffect(() => {
    if (!supportsPopover) return undefined;
    const pop = popRef.current;
    if (!pop) return undefined;
    const onToggle = (e) => {
      const next = e.newState === 'open';
      setOpen(next);
      if (!next) {
        const triggerEl = ref.current;
        if (pop.contains(document.activeElement) || document.activeElement === document.body) {
          triggerEl?.querySelector('button, [href], input, select')?.focus({ preventScroll: true });
        }
      }
    };
    pop.addEventListener('toggle', onToggle);
    return () => pop.removeEventListener('toggle', onToggle);
  }, []);

  useEffect(() => {
    if (supportsPopover && popRef.current) {
      try {
        if (open && !popRef.current.matches(':popover-open')) popRef.current.showPopover();
        else if (!open && popRef.current.matches(':popover-open')) popRef.current.hidePopover();
      } catch {
        /* abaikan bila status popover berubah di tengah render */
      }
    }
    if (!open) return undefined;
    const triggerWrap = ref.current;
    const pop = popRef.current;
    const focusTimer = setTimeout(() =>
      popRef.current
        ?.querySelector('button:not(:disabled), [href], input, select, textarea')
        ?.focus({ preventScroll: true }),
    );
    if (supportsPopover) {
      return () => clearTimeout(focusTimer);
    }
    const close = (e) => !ref.current?.contains(e.target) && !popRef.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      ref.current?.querySelector('button, [href], input, select')?.focus();
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
      if (pop?.contains(document.activeElement) || document.activeElement === document.body) {
        triggerWrap?.querySelector('button, [href], input, select')?.focus({ preventScroll: true });
      }
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || (supportsPopover && supportsAnchor)) return undefined;
    const place = () => {
      const r = ref.current?.getBoundingClientRect();
      const pop = popRef.current;
      if (!r || !pop) return;
      const w = width === '100%' ? r.width : pop.offsetWidth;
      const h = pop.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = align === 'left' ? r.left : r.right - w;
      left = Math.min(Math.max(8, left), vw - w - 8);
      let top = r.bottom + 4;
      if (top + h > vh - 8 && r.top - h - 4 >= 8) top = r.top - h - 4;
      setPos({ left, top: Math.max(8, Math.min(top, vh - h - 8)), width: width === '100%' ? r.width : width });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, align, width]);

  const anchorBoxStyle =
    supportsPopover && supportsAnchor
      ? {
          positionAnchor: anchorName,
          width: width === '100%' ? 'anchor-size(width)' : width,
        }
      : {
          position: 'fixed',
          left: pos?.left ?? -9999,
          top: pos?.top ?? 0,
          width: pos?.width ?? (width === '100%' ? undefined : width),
          visibility: pos ? 'visible' : 'hidden',
        };

  return (
    <span
      ref={ref}
      style={{
        position: 'relative',
        display: 'inline-flex',
        ...(supportsPopover && supportsAnchor ? { anchorName } : {}),
      }}
    >
      {trigger({ open, toggle })}
      {supportsPopover ? (
        <div
          id={popId}
          ref={popRef}
          className={`popover ${supportsAnchor ? `popover-anchored align-${align}` : ''}`}
          style={anchorBoxStyle}
          onClick={(e) => e.target.closest('.menu-item') && closeMenu()}
          {...{ popover: 'auto' }}
        >
          {open && children}
        </div>
      ) : (
        open &&
        createPortal(
          <div
            id={popId}
            ref={popRef}
            className="popover"
            style={anchorBoxStyle}
            onClick={(e) => e.target.closest('.menu-item') && closeMenu()}
          >
            {children}
          </div>,
          document.body,
        )
      )}
    </span>
  );
}

export function Switch({ checked, onChange, disabled, label }) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        {...{ switch: '' }}
      />
      <span aria-hidden="true" />
    </label>
  );
}

export function ProgressRing({ percent = 0, size = 34, color = 'var(--primary)' }) {
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  return (
    <progress
      className="progress-ring"
      value={clamped}
      max={100}
      aria-label={`Progres ${clamped}%`}
      aria-valuetext={`${clamped}%`}
      style={{
        '--size': `${size}px`,
        '--fill-color': color,
        '--value': clamped,
      }}
    />
  );
}

// Ikon penanda proyek (nilai `project.icon` dari backend).
export const PROJECT_ICONS = {
  asterisk: Asterisk,
  users: Users,
  calendar: CalendarDays,
  rocket: Rocket,
  book: BookOpen,
  megaphone: Megaphone,
};

export function ProjectMark({ project, size = 18 }) {
  const Icon = PROJECT_ICONS[project?.icon] || Asterisk;
  return (
    <span
      className="project-dot"
      style={{ width: size, height: size, background: project?.color || 'var(--primary)', borderRadius: size * 0.28 }}
      aria-hidden="true"
    >
      <Icon size={Math.round(size * 0.6)} strokeWidth={2.4} color="#fff" />
    </span>
  );
}
