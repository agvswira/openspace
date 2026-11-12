import { useEffect, useRef, useState } from 'react';
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
    <span className="avatar-stack" aria-label={users.map((u) => u.name).join(', ')}>
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
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size === 'lg' ? 'modal-lg' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            <div className="modal-title">{title}</div>
            {subtitle && (
              <p className="muted sm" style={{ marginTop: 4 }}>
                {subtitle}
              </p>
            )}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Tutup">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
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
          <button className={`btn ${onConfirm ? '' : 'btn-primary'}`} onClick={onClose}>
            {onConfirm ? 'Cancel' : 'OK'}
          </button>
          {onConfirm && (
            <button
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

export function Field({ label, error, children, hint, htmlFor }) {
  return (
    <div className="field">
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {hint && !error && <span className="xs muted">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
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
          <button className="btn" onClick={onRetry}>
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

// Menu sederhana yang tertutup saat klik di luar.
export function Menu({ trigger, children, align = 'right', width }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          className="popover"
          style={{ top: '100%', marginTop: 4, [align]: 0, width }}
          onClick={(e) => e.target.closest('.menu-item') && setOpen(false)}
        >
          {children}
        </div>
      )}
    </span>
  );
}

export function Switch({ checked, onChange, disabled, label }) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
      <span />
    </label>
  );
}

export function ProgressRing({ percent = 0, size = 34, color = 'var(--primary)' }) {
  const r = (size - 5) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`${percent}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-muted)" strokeWidth="3" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (c * percent) / 100}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
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
      aria-hidden
    >
      <Icon size={Math.round(size * 0.6)} strokeWidth={2.4} color="#fff" />
    </span>
  );
}
