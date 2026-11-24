import { useState } from 'react';
import {
  X,
  Link2,
  MoreHorizontal,
  FileText,
  MessageSquare,
  CircleDot,
  Users,
  Calendar,
  Flag,
  Target,
  CalendarDays,
  Lock,
  Plus,
  Trash2,
  ExternalLink,
  Pencil,
  Send,
} from 'lucide-react';
import { api, errorMessage } from '../../api/client';
import {
  keys,
  projectTaskKeys,
  useApiMutation,
  useComments,
  useLinks,
  useProject,
  useTask,
  useTasks,
} from '../../api/hooks';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Avatar, ConfirmDialog, FormError, LoadingBlock, Menu } from '../ui';
import { STATUS, STATUS_ORDER, PriorityFlag, StatusBadge, StatusIcon, displayState } from '../../lib/status';
import { fmtLong, fmtShort, timeAgo } from '../../lib/format';
import TaskFormModal from './TaskFormModal';

export function useCan(projectId) {
  const { data: project } = useProject(projectId);
  const perms = project?.access?.permissions;
  return (key) => perms === 'ALL' || (Array.isArray(perms) && perms.includes(key));
}

// Panel detail tugas di sisi kanan (Gambar 2.15).
export default function TaskDetailPanel({ taskId, projectId, onClose }) {
  const { data: task, isLoading } = useTask(taskId);
  const { user } = useAuth();
  const can = useCan(projectId);
  const toast = useToast();
  const [tab, setTab] = useState('details');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rejected, setRejected] = useState(null);

  const invalidate = projectTaskKeys(projectId);
  const update = useApiMutation((body) => api.patch(`/tasks/${taskId}`, body), {
    invalidate,
    onSuccess: () => toast('Status diperbarui'),
  });
  const remove = useApiMutation(() => api.delete(`/tasks/${taskId}`), {
    invalidate,
    onSuccess: () => {
      toast('Tugas dihapus');
      onClose();
    },
  });

  if (isLoading || !task) {
    return (
      <>
        <div className="drawer-overlay" onClick={onClose} />
        <aside className="drawer" style={{ padding: 18 }}>
          <LoadingBlock rows={6} />
        </aside>
      </>
    );
  }

  const isAssignee = task.assignees.some((a) => a.id === user.id);
  const canEditAll = can('EDIT_ALL_TASKS');
  const canStatus = canEditAll || (isAssignee && can('OWN_TASKS'));
  const state = displayState(task);

  const changeStatus = (status) =>
    update.mutate(
      { status },
      { onError: (e) => setRejected({ title: 'Status tidak dapat diubah', message: errorMessage(e) }) },
    );

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={`Detail tugas ${task.title}`}>
        <div className="detail-head">
          <div className="row-between">
            <span className="mono muted">
              {task.code} › {task.project?.name}
            </span>
            <div className="row" style={{ gap: 2 }}>
              <button
                className="icon-btn"
                aria-label="Salin tautan"
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  toast('Tautan disalin');
                }}
              >
                <Link2 size={15} />
              </button>
              <Menu
                trigger={({ toggle }) => (
                  <button className="icon-btn" onClick={toggle} aria-label="Menu tugas">
                    <MoreHorizontal size={16} />
                  </button>
                )}
              >
                <button className="menu-item" disabled={!canEditAll} onClick={() => setEditing(true)}>
                  <Pencil size={14} />
                  Edit task
                </button>
                <button className="menu-item danger" disabled={!canEditAll} onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={14} />
                  Delete task
                </button>
              </Menu>
              <button className="icon-btn" onClick={onClose} aria-label="Tutup">
                <X size={16} />
              </button>
            </div>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 600, margin: '12px 0 6px' }}>{task.title}</h2>
          {task.isBlocked && task.status !== 'DONE' && (
            <div className="st-BLOCKED sm row" style={{ marginBottom: 6 }}>
              <Lock size={13} />
              Blocked · waiting for {task.waitingFor.map((w) => w.title).join(', ')}
            </div>
          )}
          {task.isOverdue && (
            <div className="st-OVERDUE sm row" style={{ marginBottom: 6 }}>
              <StatusIcon status="OVERDUE" size={13} />
              Overdue since {fmtShort(task.dueDate)}
            </div>
          )}
          <div className="tabs" style={{ marginTop: 10 }} role="tablist">
            <button
              role="tab"
              aria-selected={tab === 'details'}
              className={`tab ${tab === 'details' ? 'active' : ''}`}
              onClick={() => setTab('details')}
            >
              <FileText size={14} />
              Details
            </button>
            <button
              role="tab"
              aria-selected={tab === 'comments'}
              className={`tab ${tab === 'comments' ? 'active' : ''}`}
              onClick={() => setTab('comments')}
            >
              <MessageSquare size={14} />
              Comments · {task.commentCount}
            </button>
            <button
              role="tab"
              aria-selected={tab === 'links'}
              className={`tab ${tab === 'links' ? 'active' : ''}`}
              onClick={() => setTab('links')}
            >
              <Link2 size={14} />
              Links · {task.linkCount}
            </button>
          </div>
        </div>

        {tab === 'details' && (
          <>
            <div className="detail-body" style={{ paddingTop: 14 }}>
              <dl className="prop-grid">
                <dt>
                  <CircleDot size={14} />
                  Status
                </dt>
                <dd>
                  {canStatus ? (
                    <select
                      className={`inline-select st-${task.status}`}
                      value={task.status}
                      onChange={(e) => changeStatus(e.target.value)}
                      aria-label="Ubah status"
                      disabled={update.isPending}
                    >
                      {STATUS_ORDER.map((s) => (
                        <option key={s} value={s}>
                          {STATUS[s].label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <StatusBadge status={task.status} plain />
                  )}
                  {state !== task.status && <StatusBadge status={state} />}
                </dd>
                <dt>
                  <Users size={14} />
                  Assignees
                </dt>
                <dd>
                  {task.assignees.length ? (
                    task.assignees.map((a) => (
                      <span key={a.id} className="row sm" style={{ gap: 6 }}>
                        <Avatar user={a} size={22} />
                        {a.name}
                      </span>
                    ))
                  ) : (
                    <span className="faint">Unassigned</span>
                  )}
                  {canEditAll && (
                    <button
                      className="icon-btn"
                      style={{ width: 24, height: 24 }}
                      aria-label="Ubah penanggung jawab"
                      onClick={() => setEditing(true)}
                    >
                      <Plus size={14} />
                    </button>
                  )}
                </dd>
                <dt>
                  <Calendar size={14} />
                  Dates
                </dt>
                <dd className="mono">
                  {task.startDate ? fmtShort(task.startDate) : '—'} – {task.dueDate ? fmtLong(task.dueDate) : '—'}
                </dd>
                <dt>
                  <Flag size={14} />
                  Priority
                </dt>
                <dd>
                  <PriorityFlag priority={task.priority} />
                </dd>
                <dt>
                  <Target size={14} />
                  Milestone
                </dt>
                <dd>
                  {task.milestone ? (
                    <span className="tag">
                      <span className="tag-dot" />
                      {task.milestone.name}
                    </span>
                  ) : (
                    <span className="faint">No milestone</span>
                  )}
                </dd>
                <dt>
                  <CalendarDays size={14} />
                  From meeting
                </dt>
                <dd>
                  {task.fromMeeting ? (
                    <span className="sm">
                      {task.fromMeeting.title} <span className="mono muted">{fmtShort(task.fromMeeting.date)}</span>
                    </span>
                  ) : (
                    <span className="faint">—</span>
                  )}
                </dd>
              </dl>

              <div>
                <div className="section-title">Description</div>
                <p className="sm" style={{ color: 'var(--text-2)', lineHeight: 1.55 }}>
                  {task.description || <span className="faint">No description.</span>}
                </p>
              </div>

              <Prerequisites
                task={task}
                projectId={projectId}
                canManage={can('MANAGE_DEPENDENCIES')}
                onReject={setRejected}
              />

              <LatestComments taskId={task.id} />
            </div>
            <CommentBox taskId={task.id} projectId={projectId} />
          </>
        )}
        {tab === 'comments' && (
          <>
            <div className="detail-body" style={{ paddingTop: 14 }}>
              <CommentList taskId={task.id} />
            </div>
            <CommentBox taskId={task.id} projectId={projectId} />
          </>
        )}
        {tab === 'links' && (
          <div className="detail-body" style={{ paddingTop: 14 }}>
            <LinksTab
              task={task}
              projectId={projectId}
              canManage={(isAssignee && can('OWN_TASKS')) || (can('MANAGE_LINKS') && canEditAll)}
            />
          </div>
        )}
      </aside>

      {editing && <TaskFormModal projectId={projectId} task={task} onClose={() => setEditing(false)} />}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete task?"
          message={`"${task.title}" will be removed permanently. This cannot be undone.`}
          confirmLabel="Delete task"
          danger
          busy={remove.isPending}
          error={remove.error && errorMessage(remove.error)}
          onConfirm={() => remove.mutate()}
          onClose={() => {
            setConfirmDelete(false);
            remove.reset();
          }}
        />
      )}
      {rejected && (
        <ConfirmDialog title={rejected.title} message={rejected.message} onClose={() => setRejected(null)} />
      )}
    </>
  );
}

function Prerequisites({ task, projectId, canManage, onReject }) {
  const { data: tasks = [] } = useTasks(projectId);
  const [adding, setAdding] = useState(false);
  const inv = [...projectTaskKeys(projectId), keys.task(task.id)];
  const add = useApiMutation((prerequisiteId) => api.post(`/tasks/${task.id}/prerequisites`, { prerequisiteId }), {
    invalidate: inv,
  });
  const del = useApiMutation((pid) => api.delete(`/tasks/${task.id}/prerequisites/${pid}`), { invalidate: inv });
  const options = tasks.filter((t) => t.id !== task.id && !task.prerequisites.some((p) => p.id === t.id));

  return (
    <div>
      <div className="row-between">
        <div className="section-title">Waits for</div>
        {canManage && (
          <button className="link xs" onClick={() => setAdding((a) => !a)}>
            <Plus size={12} /> Add prerequisite
          </button>
        )}
      </div>
      {adding && (
        <select
          className="select"
          style={{ marginBottom: 8 }}
          defaultValue=""
          aria-label="Pilih prasyarat"
          onChange={(e) => {
            if (!e.target.value) return;
            add.mutate(e.target.value, {
              onSuccess: () => setAdding(false),
              onError: (err) => onReject({ title: 'Prasyarat ditolak', message: errorMessage(err) }),
            });
          }}
        >
          <option value="">Choose a task this one waits for…</option>
          {options.map((t) => (
            <option key={t.id} value={t.id}>
              {t.code} · {t.title}
            </option>
          ))}
        </select>
      )}
      {task.prerequisites.length === 0 && !adding && <p className="sm faint">No prerequisites.</p>}
      {task.prerequisites.length > 0 && (
        <div className="card">
          {task.prerequisites.map((p) => (
            <div key={p.id} className="list-row">
              <FileText size={14} className="faint" />
              <span
                className="grow sm"
                style={{
                  fontWeight: p.status === 'DONE' ? 400 : 600,
                  color: p.status === 'DONE' ? 'var(--text-muted)' : undefined,
                }}
              >
                {p.title}
              </span>
              <StatusBadge status={p.status} plain />
              {canManage && (
                <button
                  className="icon-btn"
                  style={{ width: 24, height: 24 }}
                  aria-label={`Hapus prasyarat ${p.title}`}
                  onClick={() => del.mutate(p.id)}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {task.dependents.length > 0 && (
        <p className="xs muted" style={{ marginTop: 8 }}>
          Unblocks: {task.dependents.map((d) => d.title).join(', ')}
        </p>
      )}
    </div>
  );
}

function LatestComments({ taskId }) {
  const { data: comments = [] } = useComments(taskId);
  if (!comments.length) return null;
  return (
    <div>
      <div className="section-title">Latest comments</div>
      <CommentItems comments={comments.slice(-2)} />
    </div>
  );
}

function CommentList({ taskId }) {
  const { data: comments, isLoading } = useComments(taskId);
  if (isLoading) return <LoadingBlock rows={3} height={40} />;
  if (!comments.length) return <p className="sm faint">Belum ada komentar. Mulai diskusi di bawah.</p>;
  return <CommentItems comments={comments} />;
}

function CommentItems({ comments }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {comments.map((c) => (
        <div key={c.id} className="comment">
          <Avatar user={c.author} size={26} />
          <div>
            <div className="row" style={{ gap: 6 }}>
              <strong className="sm">{c.author.name}</strong>
              <span className="mono faint">{timeAgo(c.createdAt)}</span>
            </div>
            <p className="sm" style={{ color: 'var(--text-2)', marginTop: 2, whiteSpace: 'pre-wrap' }}>
              {c.body}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function CommentBox({ taskId, projectId }) {
  const { user } = useAuth();
  const [body, setBody] = useState('');
  const send = useApiMutation((b) => api.post(`/tasks/${taskId}/comments`, { body: b }), {
    invalidate: [keys.comments(taskId), keys.task(taskId), keys.tasks(projectId)],
    onSuccess: () => setBody(''),
  });
  const submit = (e) => {
    e.preventDefault();
    if (body.trim()) send.mutate(body.trim());
  };
  return (
    <form className="comment-box" onSubmit={submit}>
      <Avatar user={user} size={26} />
      <input
        className="input grow"
        placeholder="Add a comment"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        aria-label="Tulis komentar"
      />
      <button className="btn" disabled={!body.trim() || send.isPending}>
        <Send size={14} />
        Send
      </button>
    </form>
  );
}

function LinksTab({ task, projectId, canManage }) {
  const { data: links = [], isLoading } = useLinks(task.id);
  const [form, setForm] = useState({ title: '', url: '' });
  const [error, setError] = useState('');
  const inv = [keys.links(task.id), keys.task(task.id), keys.tasks(projectId)];
  const add = useApiMutation((b) => api.post(`/tasks/${task.id}/links`, b), {
    invalidate: inv,
    onSuccess: () => setForm({ title: '', url: '' }),
  });
  const del = useApiMutation((id) => api.delete(`/tasks/${task.id}/links/${id}`), { invalidate: inv });

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setError('Judul link wajib diisi.');
    try {
      const u = new URL(form.url);
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
    } catch {
      return setError('URL tidak valid. Gunakan format https://...');
    }
    setError('');
    add.mutate(form);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {canManage ? (
        <form onSubmit={submit} className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="section-title" style={{ margin: 0 }}>
            Add work link
          </div>
          <input
            className="input"
            placeholder="Title, e.g. Final poster (PDF)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            aria-label="Judul link"
          />
          <input
            className="input"
            placeholder="https://"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            aria-label="URL"
          />
          <FormError message={error || (add.error && errorMessage(add.error))} />
          <div>
            <button className="btn btn-primary btn-sm" disabled={add.isPending}>
              <Plus size={13} />
              Add link
            </button>
          </div>
        </form>
      ) : (
        <p className="xs muted">Anda hanya dapat menambah link pada tugas milik Anda.</p>
      )}
      {isLoading ? (
        <LoadingBlock rows={2} height={44} />
      ) : links.length === 0 ? (
        <p className="sm faint">Belum ada link hasil kerja.</p>
      ) : (
        <div className="card">
          {links.map((l) => (
            <div key={l.id} className="list-row">
              <Link2 size={15} className="faint" />
              <div className="grow" style={{ minWidth: 0 }}>
                <a href={l.url} target="_blank" rel="noreferrer" className="sm row" style={{ fontWeight: 500 }}>
                  {l.title}
                  <ExternalLink size={12} className="faint" />
                </a>
                <div className="xs muted truncate">
                  {l.url} · {l.addedBy.name}
                </div>
              </div>
              {canManage && (
                <button className="icon-btn" aria-label={`Hapus link ${l.title}`} onClick={() => del.mutate(l.id)}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
