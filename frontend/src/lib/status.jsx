import { CircleDashed, LoaderCircle, CircleCheck, CircleAlert, Lock, Flag } from 'lucide-react';

// Status ditampilkan dengan ikon + teks (tidak hanya warna) sesuai kebutuhan aksesibilitas.
export const STATUS = {
  TODO: { label: 'To do', Icon: CircleDashed },
  IN_PROGRESS: { label: 'In progress', Icon: LoaderCircle },
  DONE: { label: 'Done', Icon: CircleCheck },
  OVERDUE: { label: 'Overdue', Icon: CircleAlert },
  BLOCKED: { label: 'Blocked', Icon: Lock },
};
export const STATUS_ORDER = ['TODO', 'IN_PROGRESS', 'DONE'];

export const PRIORITY = {
  HIGH: { label: 'High', color: 'var(--prio-high)' },
  MEDIUM: { label: 'Medium', color: 'var(--prio-medium)' },
  LOW: { label: 'Low', color: 'var(--prio-low)' },
};

// Penanda turunan diprioritaskan: Terhambat/Terlambat ditampilkan bersama status aslinya.
export function displayState(task) {
  if (task.status !== 'DONE' && task.isBlocked) return 'BLOCKED';
  if (task.isOverdue) return 'OVERDUE';
  return task.status;
}

export function StatusBadge({ status, plain = false, label }) {
  const s = STATUS[status];
  const { Icon } = s;
  return (
    <span className={`badge st-${status} ${plain ? 'badge-plain' : `bg-${status}`}`}>
      <Icon size={13} strokeWidth={2.2} aria-hidden />
      {label ?? s.label}
    </span>
  );
}

export function StatusIcon({ status, size = 14 }) {
  const { Icon, label } = STATUS[status];
  return <Icon size={size} className={`st-${status}`} strokeWidth={2.2} aria-label={label} />;
}

export function PriorityFlag({ priority, showLabel = true }) {
  const p = PRIORITY[priority];
  return (
    <span className="tag" title={`Priority: ${p.label}`}>
      <Flag size={13} fill={p.color} color={p.color} aria-hidden />
      {showLabel && p.label}
    </span>
  );
}
