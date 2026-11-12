import { useState } from 'react';
import { Users, Check } from 'lucide-react';
import { api, errorMessage } from '../../api/client';
import { projectTaskKeys, useApiMutation, useMilestones, useMembers, useProjects } from '../../api/hooks';
import { Avatar, Field, FormError, Menu, Modal } from '../ui';
import { fromInputDate, toInputDate } from '../../lib/format';
import { STATUS, STATUS_ORDER, PRIORITY } from '../../lib/status';
import { useToast } from '../../context/ToastContext';

// Formulir New task / Edit task dengan validasi di sisi klien sebelum dikirim ke API.
// Tanpa prop projectId (misalnya dari My tasks), pengguna memilih proyeknya terlebih dahulu.
export default function TaskFormModal({ projectId: fixedProjectId, task, defaultStatus = 'TODO', onClose, onSaved }) {
  const editing = !!task;
  const { data: projects = [] } = useProjects();
  const [pickedProjectId, setPickedProjectId] = useState('');
  const projectId = fixedProjectId ?? (pickedProjectId || projects[0]?.id);
  const { data: membersData } = useMembers(projectId);
  const { data: milestones = [] } = useMilestones(projectId);
  const members = membersData?.members ?? [];
  const toast = useToast();

  const [form, setForm] = useState({
    title: task?.title ?? '',
    description: task?.description ?? '',
    status: task?.status ?? defaultStatus,
    priority: task?.priority ?? 'MEDIUM',
    startDate: toInputDate(task?.startDate),
    dueDate: toInputDate(task?.dueDate),
    milestoneId: task?.milestone?.id ?? '',
    assigneeIds: task?.assignees.map((a) => a.id) ?? [],
  });
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target ? e.target.value : e }));

  const save = useApiMutation(
    (body) =>
      (editing ? api.patch(`/tasks/${task.id}`, body) : api.post(`/projects/${projectId}/tasks`, body)).then(
        (r) => r.data,
      ),
    {
      invalidate: projectTaskKeys(projectId),
      onSuccess: (t) => {
        toast(editing ? 'Tugas diperbarui' : 'Tugas dibuat');
        onSaved?.(t);
        onClose();
      },
    },
  );

  function validate() {
    const e = {};
    if (form.title.trim().length < 2) e.title = 'Judul tugas minimal 2 karakter.';
    if (form.startDate && form.dueDate && form.startDate > form.dueDate)
      e.dueDate = 'Deadline tidak boleh sebelum tanggal mulai.';
    setErrors(e);
    return !Object.keys(e).length;
  }

  const submit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const body = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      priority: form.priority,
      startDate: fromInputDate(form.startDate),
      dueDate: fromInputDate(form.dueDate),
      milestoneId: form.milestoneId || null,
      assigneeIds: form.assigneeIds,
    };
    if (!editing || form.status !== task.status) body.status = form.status;
    save.mutate(body);
  };

  const toggleAssignee = (id) =>
    setForm((f) => ({
      ...f,
      assigneeIds: f.assigneeIds.includes(id) ? f.assigneeIds.filter((x) => x !== id) : [...f.assigneeIds, id],
    }));
  const chosen = members.filter((m) => form.assigneeIds.includes(m.user.id));

  return (
    <Modal
      title={editing ? 'Edit task' : 'New task'}
      subtitle={
        editing
          ? task.code
          : `Adds a task to ${projects.find((p) => p.id === projectId)?.name ?? 'this project'} in ${STATUS[form.status].label}.`
      }
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" form="task-form" disabled={save.isPending}>
            {editing ? 'Save changes' : 'Create task'}
          </button>
        </>
      }
    >
      <form id="task-form" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
        {!fixedProjectId && (
          <Field label="Project" htmlFor="t-project">
            <select
              id="t-project"
              className="select"
              value={projectId ?? ''}
              onChange={(e) => {
                setPickedProjectId(e.target.value);
                setForm((f) => ({ ...f, milestoneId: '', assigneeIds: [] }));
              }}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Task name" error={errors.title} htmlFor="t-title">
          <input
            id="t-title"
            autoFocus
            className="input"
            value={form.title}
            onChange={set('title')}
            placeholder="e.g. Pencetakan materi"
          />
        </Field>
        <Field label="Description" htmlFor="t-desc">
          <textarea
            id="t-desc"
            className="textarea"
            value={form.description}
            onChange={set('description')}
            placeholder="Add more detail…"
          />
        </Field>
        <div className="form-grid">
          <Field label="Start date" htmlFor="t-start">
            <input id="t-start" type="date" className="input" value={form.startDate} onChange={set('startDate')} />
          </Field>
          <Field label="Due date" error={errors.dueDate} htmlFor="t-due">
            <input id="t-due" type="date" className="input" value={form.dueDate} onChange={set('dueDate')} />
          </Field>
        </div>
        <Field label="Assignees">
          <Menu
            align="left"
            width="100%"
            trigger={({ toggle }) => (
              <button
                type="button"
                className="input row"
                style={{ textAlign: 'left', width: '100%', cursor: 'pointer' }}
                onClick={toggle}
              >
                <Users size={15} className="faint" />
                <span className="grow truncate">
                  {chosen.length ? (
                    chosen.map((m) => m.user.name).join(', ')
                  ) : (
                    <span className="faint">Choose people</span>
                  )}
                </span>
              </button>
            )}
          >
            {members.map((m) => (
              <button
                type="button"
                key={m.id}
                className="menu-item"
                style={{ height: 40 }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleAssignee(m.user.id);
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                    display: 'grid',
                    placeItems: 'center',
                    background: form.assigneeIds.includes(m.user.id) ? 'var(--primary)' : '#fff',
                  }}
                >
                  {form.assigneeIds.includes(m.user.id) && <Check size={12} color="#fff" />}
                </span>
                <Avatar user={m.user} size={22} />
                <span className="grow">
                  <span className="sm" style={{ display: 'block' }}>
                    {m.user.name}
                  </span>
                  <span className="xs muted">{m.role.name}</span>
                </span>
              </button>
            ))}
          </Menu>
        </Field>
        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <Field label="Status" htmlFor="t-status">
            <select id="t-status" className="select" value={form.status} onChange={set('status')}>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS[s].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority" htmlFor="t-prio">
            <select id="t-prio" className="select" value={form.priority} onChange={set('priority')}>
              {Object.entries(PRIORITY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Milestone" htmlFor="t-ms">
            <select id="t-ms" className="select" value={form.milestoneId} onChange={set('milestoneId')}>
              <option value="">No milestone</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <FormError message={save.error && errorMessage(save.error)} />
      </form>
    </Modal>
  );
}
