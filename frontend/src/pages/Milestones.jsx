import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Flag, Plus, MoreHorizontal, Calendar, Pencil, Trash2, ArrowLeft } from 'lucide-react';
import { api, errorMessage } from '../api/client';
import {
  keys,
  projectTaskKeys,
  useApiMutation,
  useMembers,
  useMilestone,
  useMilestones,
  useProject,
  useTasks,
} from '../api/hooks';
import {
  Avatar,
  AvatarStack,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  FormError,
  LoadingBlock,
  Menu,
  Modal,
} from '../components/ui';
import { StatusBadge, StatusIcon, displayState } from '../lib/status';
import { fmtLong, fmtShort, fromInputDate, relativeDue, toInputDate } from '../lib/format';
import { useCan } from '../components/tasks/TaskDetailPanel';
import { useToast } from '../context/ToastContext';

function phase(m) {
  if (m.progress.total > 0 && m.progress.done === m.progress.total) return 'completed';
  if (m.tasks.some((t) => t.status !== 'TODO')) return 'active';
  return 'upcoming';
}

const SEG = { DONE: '#16a34a', OVERDUE: '#dc2626', BLOCKED: '#d97706', IN_PROGRESS: '#ea580c', TODO: '#2563eb' };

export function MilestoneCard({ m, projectId, canManage, onEdit, onDelete, full }) {
  const navigate = useNavigate();
  // Label mengikuti fase milestone (Figma); risiko ditunjukkan terpisah pada kolom At risk.
  const st = phase(m) === 'completed' ? 'DONE' : phase(m) === 'active' ? 'IN_PROGRESS' : 'TODO';
  const people = [...new Map(m.tasks.flatMap((t) => t.assignees).map((u) => [u.id, u])).values()];

  return (
    <article className="card">
      <div className="card-pad">
        <div className="row">
          <span className="stat-ic" style={{ background: 'var(--purple-bg)', color: 'var(--purple)' }}>
            <Flag size={15} />
          </span>
          <div className="grow">
            <div className="row">
              {full ? (
                <strong style={{ fontSize: 17 }}>{m.name}</strong>
              ) : (
                <Link to={`/projects/${projectId}/milestones/${m.id}`} style={{ fontSize: 17, fontWeight: 600 }}>
                  {m.name}
                </Link>
              )}
              <StatusBadge status={st} plain />
            </div>
            {m.description && (
              <p className="sm muted" style={{ marginTop: 2 }}>
                {m.description}
              </p>
            )}
          </div>
          <AvatarStack users={people} size={26} />
          {canManage && (
            <Menu
              trigger={({ toggle }) => (
                <button className="icon-btn" onClick={toggle} aria-label="Menu milestone">
                  <MoreHorizontal size={16} />
                </button>
              )}
            >
              <button className="menu-item" onClick={() => onEdit(m)}>
                <Pencil size={14} />
                Edit milestone
              </button>
              <button className="menu-item danger" onClick={() => onDelete(m)}>
                <Trash2 size={14} />
                Delete milestone
              </button>
            </Menu>
          )}
        </div>
        <div className="stat-grid" style={{ marginTop: 16, gap: 20 }}>
          <div>
            <div className="xs muted">Due date</div>
            <div style={{ fontWeight: 600, fontSize: 18 }}>{m.dueDate ? fmtLong(m.dueDate) : '—'}</div>
            <div className="xs muted">{m.dueDate ? relativeDue(m.dueDate) : 'No due date'}</div>
          </div>
          <div>
            <div className="xs muted">Progress</div>
            <div style={{ fontWeight: 600, fontSize: 18 }}>{m.progress.percent ?? 0}%</div>
            <div className="xs muted">
              {m.progress.done} of {m.progress.total} tasks done
            </div>
          </div>
          <div>
            <div className="xs muted">At risk</div>
            <div style={{ fontWeight: 600, fontSize: 18 }} className={m.atRisk ? 'st-OVERDUE' : ''}>
              {m.atRisk}
            </div>
            <div className="xs muted">
              {m.overdue} overdue · {m.blocked} blocked
            </div>
          </div>
          <div>
            <div className="xs muted">Owner</div>
            <div className="row" style={{ marginTop: 4 }}>
              {m.owner ? (
                <>
                  <Avatar user={m.owner} size={24} />
                  <strong>{m.owner.name}</strong>
                </>
              ) : (
                <span className="muted">—</span>
              )}
            </div>
          </div>
        </div>
        <div className="row-between" style={{ margin: '16px 0 8px' }}>
          <strong className="sm">Task breakdown</strong>
          <span className="mono muted">
            {m.progress.done} / {m.progress.total}
          </span>
        </div>
        <div className="seg-bar">
          {m.tasks.map((t) => (
            <span key={t.id} style={{ flex: 1, background: SEG[displayState(t)] }} title={t.title} />
          ))}
          {!m.tasks.length && <span style={{ flex: 1, background: 'var(--bg-muted)' }} />}
        </div>
      </div>
      {m.tasks.map((t) => (
        <button
          key={t.id}
          className="list-row clickable"
          style={{
            width: '100%',
            border: 'none',
            borderTop: '1px solid var(--border)',
            background: 'none',
            textAlign: 'left',
          }}
          onClick={() => navigate(`/projects/${projectId}/tasks?task=${t.id}`)}
        >
          <StatusIcon status={displayState(t)} />
          <div className="grow">
            <div
              className="sm"
              style={{ fontWeight: 500, color: t.status === 'DONE' ? 'var(--text-muted)' : undefined }}
            >
              {t.title}
            </div>
            <div className="xs muted">
              {t.isBlocked && t.status !== 'DONE'
                ? `Waiting for ${t.waitingFor.map((w) => w.title).join(', ')}`
                : t.description}
            </div>
          </div>
          <AvatarStack users={t.assignees} size={22} />
          <span className={`mono row ${t.isOverdue ? 'st-OVERDUE' : 'muted'}`} style={{ width: 70, gap: 4 }}>
            {t.isOverdue ? <StatusIcon status="OVERDUE" size={12} /> : <Calendar size={12} />}
            {fmtShort(t.dueDate)}
          </span>
          <span style={{ width: 100 }}>
            <StatusBadge status={displayState(t)} plain />
          </span>
        </button>
      ))}
      {!m.tasks.length && (
        <p className="sm faint" style={{ padding: '0 16px 16px' }}>
          Belum ada tugas pada milestone ini.
        </p>
      )}
    </article>
  );
}

export function MilestoneFormModal({ projectId, milestone, onClose }) {
  const { data: members } = useMembers(projectId);
  const { data: tasks = [] } = useTasks(projectId);
  const toast = useToast();
  const [form, setForm] = useState({
    name: milestone?.name ?? '',
    description: milestone?.description ?? '',
    dueDate: toInputDate(milestone?.dueDate),
    ownerId: milestone?.owner?.id ?? '',
    taskIds: milestone?.tasks.map((t) => t.id) ?? [],
  });
  const [err, setErr] = useState('');
  const save = useApiMutation(
    (b) => (milestone ? api.patch(`/milestones/${milestone.id}`, b) : api.post(`/projects/${projectId}/milestones`, b)),
    {
      invalidate: [...projectTaskKeys(projectId), keys.milestone(milestone?.id)],
      onSuccess: () => {
        toast(milestone ? 'Milestone diperbarui' : 'Milestone dibuat');
        onClose();
      },
    },
  );
  const submit = (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return setErr('Nama milestone minimal 2 karakter.');
    setErr('');
    save.mutate({
      ...form,
      description: form.description || null,
      ownerId: form.ownerId || null,
      dueDate: fromInputDate(form.dueDate),
    });
  };
  const toggle = (id) =>
    setForm((f) => ({
      ...f,
      taskIds: f.taskIds.includes(id) ? f.taskIds.filter((x) => x !== id) : [...f.taskIds, id],
    }));

  return (
    <Modal
      title={milestone ? 'Edit milestone' : 'New milestone'}
      subtitle="Group tasks into a deliverable and track them to a date."
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" form="ms-form" disabled={save.isPending}>
            {milestone ? 'Save changes' : 'Create milestone'}
          </button>
        </>
      }
    >
      <form id="ms-form" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Milestone name" htmlFor="ms-name">
          <input
            id="ms-name"
            autoFocus
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder='e.g. "Hari pelaksanaan"'
          />
        </Field>
        <Field label="Description" htmlFor="ms-desc">
          <textarea
            id="ms-desc"
            className="textarea"
            style={{ minHeight: 60 }}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <div className="form-grid">
          <Field label="Due date" htmlFor="ms-due">
            <input
              id="ms-due"
              type="date"
              className="input"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </Field>
          <Field label="Owner" htmlFor="ms-owner">
            <select
              id="ms-owner"
              className="select"
              value={form.ownerId}
              onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
            >
              <option value="">No owner</option>
              {members?.members.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={`Tasks (${form.taskIds.length})`}>
          <div className="card" style={{ maxHeight: 180, overflow: 'auto', padding: 6 }}>
            {tasks.map((t) => (
              <label key={t.id} className="check" style={{ padding: '5px 6px' }}>
                <input type="checkbox" checked={form.taskIds.includes(t.id)} onChange={() => toggle(t.id)} />
                <span className="grow">{t.title}</span>
                {t.milestone && t.milestone.id !== milestone?.id && (
                  <span className="xs muted">{t.milestone.name}</span>
                )}
              </label>
            ))}
            {!tasks.length && (
              <p className="xs muted" style={{ padding: 6 }}>
                Belum ada tugas.
              </p>
            )}
          </div>
        </Field>
        <FormError message={err || (save.error && errorMessage(save.error))} />
      </form>
    </Modal>
  );
}

function useMilestoneActions(projectId, onDeleted) {
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const del = useApiMutation((id) => api.delete(`/milestones/${id}`), {
    invalidate: projectTaskKeys(projectId),
    onSuccess: () => {
      toast('Milestone dihapus');
      setDeleting(null);
      onDeleted?.();
    },
  });
  const dialogs = (
    <>
      {editing && (
        <MilestoneFormModal
          projectId={projectId}
          milestone={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete milestone?"
          danger
          confirmLabel="Delete"
          busy={del.isPending}
          error={del.error && errorMessage(del.error)}
          message={`"${deleting.name}" will be deleted. Its ${deleting.tasks.length} tasks stay in the project without a milestone.`}
          onConfirm={() => del.mutate(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
  return { setEditing, setDeleting, dialogs };
}

export default function Milestones() {
  const { projectId } = useParams();
  const can = useCan(projectId);
  const { data: project } = useProject(projectId);
  const { data, isLoading, error, refetch } = useMilestones(projectId);
  const [tab, setTab] = useState('active');
  const { setEditing, setDeleting, dialogs } = useMilestoneActions(projectId);
  const canManage = can('MANAGE_MILESTONES');

  const groups = { active: [], upcoming: [], completed: [] };
  (data ?? []).forEach((m) => groups[phase(m)].push(m));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Milestones</h1>
          <p className="page-sub">Group tasks into deliverables and track them to a date</p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            <Flag size={14} />
            New milestone
          </button>
        )}
      </div>
      <div className="segmented" style={{ marginBottom: 16 }}>
        {['active', 'upcoming', 'completed'].map((k) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
            {k[0].toUpperCase() + k.slice(1)} {groups[k].length}
          </button>
        ))}
      </div>
      {isLoading ? (
        <LoadingBlock rows={2} height={200} />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {groups[tab].map((m) => (
            <MilestoneCard
              key={m.id}
              m={m}
              projectId={projectId}
              canManage={canManage}
              onEdit={setEditing}
              onDelete={setDeleting}
            />
          ))}
          {!groups[tab].length && (
            <div className="card">
              <EmptyState icon={Flag} title={`Tidak ada milestone ${tab}`}>
                Milestone mengelompokkan tugas berdasarkan target.
              </EmptyState>
            </div>
          )}
          {canManage && (
            <button
              className="card row"
              style={{
                padding: 14,
                borderStyle: 'dashed',
                cursor: 'pointer',
                background: 'var(--bg-subtle)',
                color: 'var(--text-muted)',
              }}
              onClick={() => setEditing('new')}
            >
              <Plus size={15} />
              <span className="sm">
                Add another milestone, e.g. “Hari pelaksanaan”
                {project?.dueDate ? ` on ${fmtShort(project.dueDate)}` : ''}
              </span>
            </button>
          )}
        </div>
      )}
      {dialogs}
    </div>
  );
}

export function MilestoneDetail() {
  const { projectId, milestoneId } = useParams();
  const can = useCan(projectId);
  const navigate = useNavigate();
  const { data: m, isLoading, error } = useMilestone(milestoneId);
  const { setEditing, setDeleting, dialogs } = useMilestoneActions(projectId, () =>
    navigate(`/projects/${projectId}/milestones`),
  );
  return (
    <div className="page">
      <Link to={`/projects/${projectId}/milestones`} className="sm muted row" style={{ marginBottom: 14 }}>
        <ArrowLeft size={14} />
        All milestones
      </Link>
      {isLoading ? (
        <LoadingBlock rows={2} height={200} />
      ) : error ? (
        <ErrorState error={error} />
      ) : (
        <MilestoneCard
          m={m}
          projectId={projectId}
          full
          canManage={can('MANAGE_MILESTONES')}
          onEdit={setEditing}
          onDelete={setDeleting}
        />
      )}
      {dialogs}
    </div>
  );
}
