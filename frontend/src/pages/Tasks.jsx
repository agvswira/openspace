import { useMemo, useState } from 'react';
import { useParams, useSearchParams, useOutletContext } from 'react-router-dom';
import { Kanban, List, Calendar, GanttChart, Search, SlidersHorizontal, Plus, UserPlus, X } from 'lucide-react';
import { api, errorMessage } from '../api/client';
import { projectTaskKeys, useApiMutation, useMeetings, useMilestones, useProject, useTasks } from '../api/hooks';
import { AvatarStack, ConfirmDialog, EmptyState, ErrorState, LoadingBlock, Menu } from '../components/ui';
import { PRIORITY } from '../lib/status';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import BoardView from '../components/tasks/BoardView';
import ListView from '../components/tasks/ListView';
import CalendarView from '../components/tasks/CalendarView';
import TimelineView from '../components/tasks/TimelineView';
import TaskFormModal from '../components/tasks/TaskFormModal';
import TaskDetailPanel, { useCan } from '../components/tasks/TaskDetailPanel';

const VIEWS = [
  { key: 'board', label: 'Board', Icon: Kanban },
  { key: 'list', label: 'List', Icon: List },
  { key: 'calendar', label: 'Calendar', Icon: Calendar },
  { key: 'timeline', label: 'Timeline', Icon: GanttChart },
];

const FILTERS = [
  { key: 'mine', label: 'Assigned to me' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'blocked', label: 'Blocked' },
];

export default function Tasks() {
  const { projectId } = useParams();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') || 'board';
  const openTaskId = params.get('task');
  const { user } = useAuth();
  const { openInvite } = useOutletContext();
  const toast = useToast();
  const can = useCan(projectId);

  const { data: project } = useProject(projectId);
  const tasksQ = useTasks(projectId);
  const { data: meetings } = useMeetings(projectId);
  const { data: milestones } = useMilestones(projectId);

  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({ mine: false, overdue: false, blocked: false, priority: '' });
  const [creating, setCreating] = useState(null);
  const [rejected, setRejected] = useState(null);

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: k === 'task' ? false : true });
  };

  // FR-16: filter dijalankan di sisi klien di atas data yang sama untuk keempat tampilan.
  const tasks = useMemo(() => {
    let list = tasksQ.data ?? [];
    if (q.trim())
      list = list.filter((t) => `${t.title} ${t.description ?? ''}`.toLowerCase().includes(q.toLowerCase()));
    if (filters.mine) list = list.filter((t) => t.assignees.some((a) => a.id === user.id));
    if (filters.overdue) list = list.filter((t) => t.isOverdue);
    if (filters.blocked) list = list.filter((t) => t.isBlocked && t.status !== 'DONE');
    if (filters.priority) list = list.filter((t) => t.priority === filters.priority);
    return list;
  }, [tasksQ.data, q, filters, user.id]);
  const activeFilters = Object.values(filters).filter(Boolean).length;

  const move = useApiMutation(({ task, status }) => api.patch(`/tasks/${task.id}`, { status }), {
    invalidate: projectTaskKeys(projectId),
    onSuccess: () => toast('Status diperbarui'),
  });
  const onMove = (task, status) => move.mutate({ task, status }, { onError: (e) => setRejected(errorMessage(e)) });

  const all = tasksQ.data ?? [];
  const done = all.filter((t) => t.status === 'DONE').length;
  const canCreate = can('CREATE_TASKS');
  const viewProps = { tasks, onOpen: (id) => setParam('task', id), onCreate: (s) => setCreating(s), canCreate };

  return (
    <div className="page-wide">
      <div className="page-head" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-sub">
            {all.length} tasks in {project?.name} · {done} completed
          </p>
        </div>
        <div className="row">
          <AvatarStack users={project?.members ?? []} size={28} />
          {project?.access?.isOwner && (
            <button className="btn" onClick={openInvite}>
              <UserPlus size={15} />
              Invite
            </button>
          )}
          {canCreate && (
            <button className="btn btn-primary" onClick={() => setCreating('TODO')}>
              <Plus size={15} />
              New task
            </button>
          )}
        </div>
      </div>

      <div className="row-between" style={{ borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        <div className="tabs" style={{ border: 'none' }} role="tablist">
          {VIEWS.map(({ key, label, Icon }) => (
            <button
              key={key}
              role="tab"
              aria-selected={view === key}
              className={`tab ${view === key ? 'active' : ''}`}
              onClick={() => setParam('view', key === 'board' ? '' : key)}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
        <div className="row" style={{ paddingBottom: 6 }}>
          <div className="input-icon" style={{ width: 220 }}>
            <Search size={14} />
            <input
              className="input"
              style={{ height: 32 }}
              placeholder="Search tasks..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Cari tugas"
            />
          </div>
          <Menu
            width={230}
            trigger={({ toggle }) => (
              <button className="btn" onClick={toggle} style={{ height: 32 }}>
                <SlidersHorizontal size={14} />
                Filter
                {activeFilters ? ` · ${activeFilters}` : ''}
              </button>
            )}
          >
            <div
              style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}
              onClick={(e) => e.stopPropagation()}
            >
              {FILTERS.map((f) => (
                <label key={f.key} className="check">
                  <input
                    type="checkbox"
                    checked={filters[f.key]}
                    onChange={(e) => setFilters({ ...filters, [f.key]: e.target.checked })}
                  />
                  {f.label}
                </label>
              ))}
              <select
                className="select"
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                aria-label="Prioritas"
              >
                <option value="">Any priority</option>
                {Object.entries(PRIORITY).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
              {activeFilters > 0 && (
                <button
                  className="btn btn-sm"
                  onClick={() => setFilters({ mine: false, overdue: false, blocked: false, priority: '' })}
                >
                  <X size={12} />
                  Clear filters
                </button>
              )}
            </div>
          </Menu>
        </div>
      </div>

      {tasksQ.isLoading ? (
        <LoadingBlock rows={4} height={90} />
      ) : tasksQ.error ? (
        <ErrorState error={tasksQ.error} onRetry={tasksQ.refetch} />
      ) : all.length === 0 ? (
        <div className="card">
          <EmptyState
            title="Belum ada tugas"
            action={
              canCreate && (
                <button className="btn btn-primary" onClick={() => setCreating('TODO')}>
                  <Plus size={14} />
                  Create the first task
                </button>
              )
            }
          >
            Buat tugas pertama, tetapkan penanggung jawab, lalu pantau progresnya di Board, List, Calendar, atau
            Timeline.
          </EmptyState>
        </div>
      ) : (
        <div className="view-fill">
          {tasks.length === 0 && (
            <p className="sm muted" style={{ marginBottom: 12 }}>
              Tidak ada tugas yang cocok dengan pencarian/filter.
            </p>
          )}
          {view === 'board' && <BoardView {...viewProps} onMove={onMove} />}
          {view === 'list' && <ListView {...viewProps} />}
          {view === 'calendar' && <CalendarView {...viewProps} meetings={meetings} milestones={milestones} />}
          {view === 'timeline' && <TimelineView {...viewProps} milestones={milestones} />}
        </div>
      )}
      {creating && <TaskFormModal projectId={projectId} defaultStatus={creating} onClose={() => setCreating(null)} />}
      {openTaskId && <TaskDetailPanel taskId={openTaskId} projectId={projectId} onClose={() => setParam('task', '')} />}
      {rejected && <ConfirmDialog title="Perubahan ditolak" message={rejected} onClose={() => setRejected(null)} />}
    </div>
  );
}
