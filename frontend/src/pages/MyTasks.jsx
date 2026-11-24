import { useState } from 'react';
import { Plus, CircleAlert, CalendarDays, CalendarClock, CalendarX, CircleCheck } from 'lucide-react';
import { useMyTasks } from '../api/hooks';
import { EmptyState, ErrorState, LoadingBlock } from '../components/ui';
import { addDays, startOfDay } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import TaskRow from '../components/tasks/TaskRow';
import TaskFormModal from '../components/tasks/TaskFormModal';

// FR-15: tugas milik pengguna dari semua proyek, dikelompokkan berdasarkan deadline.
function groupByDeadline(tasks) {
  const today = startOfDay();
  const endWeek = addDays(today, 7 - ((today.getDay() + 6) % 7)); // Senin berikutnya
  const endNext = addDays(endWeek, 7);
  const groups = [
    { key: 'overdue', label: 'Overdue', Icon: CircleAlert, iconCls: 'st-OVERDUE', items: [] },
    { key: 'week', label: 'This week', Icon: CalendarDays, iconCls: 'st-TODO', items: [] },
    { key: 'next', label: 'Next week', Icon: CalendarClock, iconCls: 'muted', items: [] },
    { key: 'later', label: 'Later', Icon: CalendarClock, iconCls: 'muted', items: [] },
    { key: 'none', label: 'No due date', Icon: CalendarX, iconCls: 'muted', items: [] },
  ];
  for (const t of tasks) {
    const d = t.dueDate && startOfDay(t.dueDate);
    const g = !d ? 'none' : t.isOverdue ? 'overdue' : d < endWeek ? 'week' : d < endNext ? 'next' : 'later';
    groups.find((x) => x.key === g).items.push(t);
  }
  return groups.filter((g) => g.items.length);
}

export default function MyTasks() {
  const { user } = useAuth();
  const [tab, setTab] = useState('open');
  const [creating, setCreating] = useState(false);
  const open = useMyTasks('open');
  const completed = useMyTasks('completed');
  const q = tab === 'open' ? open : completed;
  const groups =
    tab === 'open'
      ? groupByDeadline(q.data ?? [])
      : [{ key: 'done', label: 'Completed', Icon: CircleCheck, iconCls: 'st-DONE', items: q.data ?? [] }];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">My tasks</h1>
          <p className="page-sub">Tasks assigned to {user.name} across every project</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <Plus size={15} />
          New task
        </button>
      </div>

      <div className="segmented" style={{ marginBottom: 16 }} role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'open'}
          className={tab === 'open' ? 'active' : ''}
          onClick={() => setTab('open')}
        >
          Open <span className="muted">{open.data?.length ?? ''}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === 'completed'}
          className={tab === 'completed' ? 'active' : ''}
          onClick={() => setTab('completed')}
        >
          Completed <span className="muted">{completed.data?.length ?? ''}</span>
        </button>
      </div>

      {q.isLoading ? (
        <LoadingBlock rows={4} height={48} />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={q.refetch} />
      ) : q.data.length === 0 ? (
        <div className="card">
          <EmptyState title={tab === 'open' ? 'Semua tugas beres' : 'Belum ada tugas selesai'}>
            Tugas yang ditugaskan kepada Anda di semua proyek akan muncul di sini.
          </EmptyState>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          {groups.map((g, i) => (
            <div key={g.key}>
              <div className="group-head" style={{ borderTop: i ? '1px solid var(--border)' : 'none' }}>
                <g.Icon size={14} className={g.iconCls} />
                {g.label}
                <span className="xs muted" style={{ fontWeight: 400 }}>
                  {g.items.length}
                </span>
              </div>
              {g.items.map((t) => (
                <TaskRow key={t.id} task={t} showMilestone showMenu />
              ))}
            </div>
          ))}
        </div>
      )}
      {creating && <TaskFormModal onClose={() => setCreating(false)} />}
    </div>
  );
}
