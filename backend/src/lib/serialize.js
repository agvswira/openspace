import { isBlocked, isOverdue, waitingFor } from './taskRules.js';

export const userSelect = { id: true, name: true, email: true, title: true, avatarColor: true, avatarUrl: true };

export function publicUser(u) {
  if (!u) return null;
  return { id: u.id, name: u.name, email: u.email, title: u.title, avatarColor: u.avatarColor, avatarUrl: u.avatarUrl };
}

// Include standar saat membaca tugas agar keempat tampilan memakai bentuk data yang sama.
export const taskInclude = {
  assignees: { include: { user: { select: userSelect } } },
  milestone: { select: { id: true, name: true } },
  prerequisites: { include: { prerequisite: { select: { id: true, number: true, title: true, status: true } } } },
  dependents: { include: { task: { select: { id: true, number: true, title: true, status: true } } } },
  actionItem: { include: { meeting: { select: { id: true, title: true, date: true } } } },
  project: { select: { id: true, name: true, color: true, icon: true } },
  _count: { select: { comments: true, links: true } },
};

export function serializeTask(t) {
  const waits = waitingFor(t);
  return {
    id: t.id,
    projectId: t.projectId,
    project: t.project,
    code: `OS-${String(t.number).padStart(3, '0')}`,
    number: t.number,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    startDate: t.startDate,
    dueDate: t.dueDate,
    position: t.position,
    completedAt: t.completedAt,
    milestone: t.milestone,
    assignees: (t.assignees || []).map((a) => a.user),
    prerequisites: (t.prerequisites || []).map((p) => p.prerequisite),
    dependents: (t.dependents || []).map((d) => d.task),
    fromMeeting: t.actionItem ? { ...t.actionItem.meeting, actionItemId: t.actionItem.id } : null,
    commentCount: t._count?.comments ?? 0,
    linkCount: t._count?.links ?? 0,
    // Penanda turunan, bukan status (Tabel 2.6)
    isOverdue: isOverdue(t),
    isBlocked: isBlocked(t),
    waitingFor: waits.map((w) => ({ id: w.id, title: w.title, status: w.status })),
  };
}
