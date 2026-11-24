import { CircleDashed, LoaderCircle, CircleCheck, CircleAlert, Lock, Flag, Eye } from 'lucide-react';

// Status ditampilkan dengan ikon + teks (tidak hanya warna) sesuai kebutuhan aksesibilitas.
export const STATUS = {
  TODO: { label: 'To do', Icon: CircleDashed },
  IN_PROGRESS: { label: 'In progress', Icon: LoaderCircle },
  IN_REVIEW: { label: 'In review', Icon: Eye },
  DONE: { label: 'Done', Icon: CircleCheck },
  OVERDUE: { label: 'Overdue', Icon: CircleAlert },
  BLOCKED: { label: 'Blocked', Icon: Lock },
};
export const STATUS_ORDER = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

// Alur review: anggota mengirim tugas ke In review, hanya Owner yang dapat menjadikannya Done
// atau membuka kembali tugas yang sudah disetujui (aturan yang sama dengan backend).
export function reviewDenied(task, status, isOwner) {
  if (isOwner || !task || task.status === status) return null;
  if (status === 'DONE') return 'Hanya Owner yang dapat menandai Done. Kirim ke In review untuk minta persetujuan.';
  if (task.status === 'DONE') return 'Tugas ini sudah disetujui Owner. Hanya Owner yang dapat membukanya kembali.';
  return null;
}

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
