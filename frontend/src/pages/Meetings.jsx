import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CalendarDays,
  Clock,
  MapPin,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  ListChecks,
  Calendar,
  X,
} from 'lucide-react';
import { api, errorMessage } from '../api/client';
import { keys, projectTaskKeys, useApiMutation, useMeetings, useMembers } from '../api/hooks';
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
import { StatusBadge } from '../lib/status';
import { addDays, fmtLong, fmtShort, fromInputDate, startOfDay, toInputDate, MONTHS } from '../lib/format';
import { useCan } from '../components/tasks/TaskDetailPanel';
import { useToast } from '../context/ToastContext';

function MeetingFormModal({ projectId, meeting, onClose, onSaved }) {
  const { data: members } = useMembers(projectId);
  const toast = useToast();
  const [form, setForm] = useState({
    title: meeting?.title ?? '',
    date: toInputDate(meeting?.date ?? new Date()),
    startTime: meeting?.startTime ?? '09:00',
    endTime: meeting?.endTime ?? '10:00',
    location: meeting?.location ?? '',
    notes: meeting?.notes ?? '',
    participantIds: meeting?.participants.map((p) => p.id) ?? [],
  });
  const [err, setErr] = useState('');
  const save = useApiMutation(
    (b) =>
      (meeting ? api.patch(`/meetings/${meeting.id}`, b) : api.post(`/projects/${projectId}/meetings`, b)).then(
        (r) => r.data,
      ),
    {
      invalidate: [keys.meetings(projectId), keys.summary],
      onSuccess: (m) => {
        toast(meeting ? 'Rapat diperbarui' : 'Rapat dicatat');
        onSaved?.(m);
        onClose();
      },
    },
  );
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    if (form.title.trim().length < 2) return setErr('Judul rapat minimal 2 karakter.');
    if (!form.date) return setErr('Tanggal rapat wajib diisi.');
    if (form.startTime >= form.endTime) return setErr('Waktu selesai harus setelah waktu mulai.');
    setErr('');
    save.mutate({
      ...form,
      date: fromInputDate(form.date),
      location: form.location || null,
      notes: form.notes || null,
    });
  };
  const toggle = (id) =>
    setForm((f) => ({
      ...f,
      participantIds: f.participantIds.includes(id)
        ? f.participantIds.filter((x) => x !== id)
        : [...f.participantIds, id],
    }));

  return (
    <Modal
      title={meeting ? 'Edit meeting' : 'New meeting'}
      subtitle="Meetings are recorded manually: notes, attendees and action items."
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" form="mt-form" disabled={save.isPending}>
            {meeting ? 'Save changes' : 'Save meeting'}
          </button>
        </>
      }
    >
      <form id="mt-form" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Title" htmlFor="mt-title">
          <input
            id="mt-title"
            autoFocus
            className="input"
            value={form.title}
            onChange={set('title')}
            placeholder="e.g. Perencanaan kegiatan"
          />
        </Field>
        <div className="form-grid" style={{ gridTemplateColumns: '1.4fr 1fr 1fr' }}>
          <Field label="Date" htmlFor="mt-date">
            <input id="mt-date" type="date" className="input" value={form.date} onChange={set('date')} />
          </Field>
          <Field label="Start" htmlFor="mt-start">
            <input id="mt-start" type="time" className="input" value={form.startTime} onChange={set('startTime')} />
          </Field>
          <Field label="End" htmlFor="mt-end">
            <input id="mt-end" type="time" className="input" value={form.endTime} onChange={set('endTime')} />
          </Field>
        </div>
        <Field label="Location" htmlFor="mt-loc">
          <input
            id="mt-loc"
            className="input"
            value={form.location}
            onChange={set('location')}
            placeholder="Google Meet, Ruang rapat…"
          />
        </Field>
        <Field label="Attendees">
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {members?.members.map((m) => (
              <button
                type="button"
                key={m.id}
                className={`chip ${form.participantIds.includes(m.user.id) ? 'active' : ''}`}
                onClick={() => toggle(m.user.id)}
                aria-pressed={form.participantIds.includes(m.user.id)}
              >
                {m.user.name}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Notes" hint="One point per line." htmlFor="mt-notes">
          <textarea id="mt-notes" className="textarea" value={form.notes} onChange={set('notes')} />
        </Field>
        <FormError message={err || (save.error && errorMessage(save.error))} />
      </form>
    </Modal>
  );
}

function MeetingDetail({ m, projectId, can, onEdit, onDelete }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { data: members } = useMembers(projectId);
  const [item, setItem] = useState({ title: '', assigneeId: '', dueDate: '' });
  const [showAdd, setShowAdd] = useState(false);
  const [rejected, setRejected] = useState(null);
  const inv = [...projectTaskKeys(projectId), keys.meetings(projectId)];
  const addItem = useApiMutation((b) => api.post(`/meetings/${m.id}/action-items`, b), {
    invalidate: inv,
    onSuccess: () => setItem({ title: '', assigneeId: '', dueDate: '' }),
  });
  const delItem = useApiMutation((id) => api.delete(`/meetings/${m.id}/action-items/${id}`), { invalidate: inv });
  // FR-12: action item -> tugas, tetap terhubung ke rapat asal.
  const convert = useApiMutation((id) => api.post(`/meetings/${m.id}/action-items/${id}/convert`).then((r) => r.data), {
    invalidate: inv,
    onSuccess: (t) => toast(`Tugas "${t.title}" dibuat dari rapat`),
  });
  const canMeet = can('MANAGE_MEETINGS');
  const canConvert = canMeet && can('CREATE_TASKS');
  const doneCount = m.actionItems.filter((a) => a.task?.status === 'DONE').length;

  return (
    <section className="card card-pad" style={{ alignSelf: 'start' }}>
      <div className="row-between">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{m.title}</h2>
        {canMeet && (
          <div className="row">
            <button className="btn btn-sm" onClick={() => onEdit(m)}>
              <Pencil size={13} />
              Edit
            </button>
            <Menu
              trigger={({ toggle }) => (
                <button className="icon-btn" onClick={toggle} aria-label="Menu rapat">
                  <MoreHorizontal size={16} />
                </button>
              )}
            >
              <button className="menu-item danger" onClick={() => onDelete(m)}>
                <Trash2 size={14} />
                Delete meeting
              </button>
            </Menu>
          </div>
        )}
      </div>
      <div className="row sm muted" style={{ gap: 14, marginTop: 6 }}>
        <span className="row" style={{ gap: 5 }}>
          <CalendarDays size={14} />
          {new Date(m.date).toLocaleDateString('en-GB', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </span>
        <span className="row mono" style={{ gap: 5 }}>
          <Clock size={14} />
          {m.startTime} – {m.endTime}
        </span>
        {m.location && (
          <span className="row" style={{ gap: 5 }}>
            <MapPin size={14} />
            {m.location}
          </span>
        )}
      </div>

      <div className="section-title" style={{ marginTop: 18 }}>
        Attendees
      </div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 16 }}>
        {m.participants.map((p) => {
          const role = members?.members.find((x) => x.user.id === p.id)?.role.name;
          return (
            <span key={p.id} className="row">
              <Avatar user={p} size={28} />
              <span>
                <span className="sm" style={{ display: 'block', fontWeight: 500 }}>
                  {p.name}
                </span>
                <span className="xs muted">{role}</span>
              </span>
            </span>
          );
        })}
        {!m.participants.length && <span className="sm faint">No attendees recorded.</span>}
      </div>

      <div className="section-title" style={{ marginTop: 18 }}>
        Notes
      </div>
      <div style={{ background: 'var(--bg-subtle)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
        {m.notes ? (
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }} className="sm">
            {m.notes
              .split('\n')
              .filter(Boolean)
              .map((line, i) => (
                <li key={i}>{line.replace(/^[-•]\s*/, '')}</li>
              ))}
          </ul>
        ) : (
          <span className="sm faint">No notes.</span>
        )}
      </div>

      <div className="row-between" style={{ marginTop: 18, marginBottom: 8 }}>
        <span className="section-title" style={{ margin: 0 }}>
          Action items
        </span>
        <span className="badge mono" style={{ background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>
          {doneCount} / {m.actionItems.length} done
        </span>
      </div>
      <div className="card">
        {m.actionItems.map((a) => (
          <div key={a.id} className="list-row">
            <span className={`task-check ${a.task?.status === 'DONE' ? 'checked' : ''}`} aria-hidden>
              {a.task?.status === 'DONE' && <Check size={12} strokeWidth={3} />}
            </span>
            <span className="grow sm" style={{ fontWeight: 500 }}>
              {a.title}
            </span>
            {a.assignee && <Avatar user={a.assignee} size={22} />}
            <span className="mono muted row" style={{ width: 70, gap: 4 }}>
              <Calendar size={12} />
              {a.dueDate ? fmtShort(a.dueDate) : '—'}
            </span>
            <span style={{ width: 120, display: 'flex', justifyContent: 'flex-end' }}>
              {a.task ? (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => navigate(`/projects/${projectId}/tasks?task=${a.task.id}`)}
                  title="Buka tugas"
                >
                  <StatusBadge status={a.task.status} plain />
                </button>
              ) : canConvert ? (
                <button
                  className="btn btn-sm"
                  disabled={convert.isPending}
                  onClick={() => convert.mutate(a.id, { onError: (e) => setRejected(errorMessage(e)) })}
                >
                  <Plus size={12} />
                  Make task
                </button>
              ) : (
                <span className="xs faint">Not a task yet</span>
              )}
            </span>
            {canMeet && !a.task && (
              <button
                className="icon-btn"
                style={{ width: 24, height: 24 }}
                aria-label={`Hapus ${a.title}`}
                onClick={() => delItem.mutate(a.id)}
              >
                <X size={13} />
              </button>
            )}
          </div>
        ))}
        {!m.actionItems.length && (
          <p className="sm faint" style={{ padding: 14 }}>
            Belum ada action item.
          </p>
        )}
      </div>
      {canMeet && !showAdd && (
        <button
          className="link sm row"
          style={{ marginTop: 12, color: 'var(--text-muted)', gap: 6, fontWeight: 400 }}
          onClick={() => setShowAdd(true)}
        >
          <Plus size={14} />
          Add action item as task
        </button>
      )}
      {canMeet && showAdd && (
        <form
          className="row"
          style={{ marginTop: 10, flexWrap: 'wrap' }}
          onSubmit={(e) => {
            e.preventDefault();
            if (item.title.trim().length >= 2)
              addItem.mutate({
                title: item.title.trim(),
                assigneeId: item.assigneeId || null,
                dueDate: fromInputDate(item.dueDate),
              });
          }}
        >
          <input
            className="input grow"
            placeholder="Add action item"
            value={item.title}
            onChange={(e) => setItem({ ...item, title: e.target.value })}
            aria-label="Action item baru"
          />
          <select
            className="select"
            style={{ width: 140 }}
            value={item.assigneeId}
            onChange={(e) => setItem({ ...item, assigneeId: e.target.value })}
            aria-label="Penanggung jawab"
          >
            <option value="">Assignee</option>
            {members?.members.map((x) => (
              <option key={x.user.id} value={x.user.id}>
                {x.user.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="input"
            style={{ width: 150 }}
            value={item.dueDate}
            onChange={(e) => setItem({ ...item, dueDate: e.target.value })}
            aria-label="Deadline"
          />
          <button className="btn" disabled={addItem.isPending || item.title.trim().length < 2}>
            <Plus size={14} />
            Add
          </button>
          <button type="button" className="icon-btn" aria-label="Batal" onClick={() => setShowAdd(false)}>
            <X size={14} />
          </button>
        </form>
      )}
      {rejected && (
        <ConfirmDialog title="Tidak dapat membuat tugas" message={rejected} onClose={() => setRejected(null)} />
      )}
    </section>
  );
}

export default function Meetings() {
  const { projectId } = useParams();
  const can = useCan(projectId);
  const toast = useToast();
  const { data: meetings, isLoading, error, refetch } = useMeetings(projectId);
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const del = useApiMutation((id) => api.delete(`/meetings/${id}`), {
    invalidate: [keys.meetings(projectId), keys.summary],
    onSuccess: () => {
      toast('Rapat dihapus');
      setDeleting(null);
      setSelectedId(null);
    },
  });

  const today = startOfDay();
  // This week = Senin minggu ini sampai 7 hari ke depan (seperti daftar rapat di Figma).
  const weekStart = addDays(today, -((today.getDay() + 6) % 7));
  const weekLimit = addDays(today, 8);
  const list = meetings ?? [];
  const dayOf = (m) => startOfDay(m.date);
  const groups = [
    { label: 'This week', items: list.filter((m) => dayOf(m) >= weekStart && dayOf(m) < weekLimit) },
    { label: 'Later', items: list.filter((m) => dayOf(m) >= weekLimit) },
    { label: 'Earlier', items: list.filter((m) => dayOf(m) < weekStart).reverse() },
  ].filter((g) => g.items.length);
  const selected = list.find((m) => m.id === selectedId) ?? groups[0]?.items[0];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Meetings</h1>
          <p className="page-sub">Notes, decisions and action items from team meetings</p>
        </div>
        {can('MANAGE_MEETINGS') && (
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            <CalendarDays size={14} />
            New meeting
          </button>
        )}
      </div>
      {isLoading ? (
        <LoadingBlock rows={3} height={70} />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : !list.length ? (
        <div className="card">
          <EmptyState icon={CalendarDays} title="Belum ada rapat">
            Catat rapat tim beserta peserta, catatan, dan action item yang dapat dijadikan tugas.
          </EmptyState>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 }}>
          <div>
            {groups.map((g) => (
              <div key={g.label} style={{ marginBottom: 12 }}>
                <div className="section-title">{g.label}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {g.items.map((m) => {
                    const d = new Date(m.date);
                    const active = selected?.id === m.id;
                    return (
                      <button
                        key={m.id}
                        className="card row"
                        onClick={() => setSelectedId(m.id)}
                        style={{
                          padding: 10,
                          cursor: 'pointer',
                          textAlign: 'left',
                          borderColor: active ? 'var(--primary)' : undefined,
                          boxShadow: active ? '0 0 0 1px var(--primary)' : undefined,
                        }}
                      >
                        <span
                          style={{
                            width: 40,
                            textAlign: 'center',
                            borderRadius: 8,
                            background: active ? 'var(--primary-soft)' : 'var(--bg-muted)',
                            padding: '4px 0',
                          }}
                        >
                          <span className="xs muted" style={{ display: 'block' }}>
                            {MONTHS[d.getMonth()]}
                          </span>
                          <span
                            className="mono"
                            style={{ fontSize: 16, fontWeight: 600, color: active ? 'var(--primary)' : undefined }}
                          >
                            {d.getDate()}
                          </span>
                        </span>
                        <span className="grow" style={{ minWidth: 0 }}>
                          <span className="sm truncate" style={{ display: 'block', fontWeight: 600 }}>
                            {m.title}
                          </span>
                          <span className="xs muted truncate" style={{ display: 'block' }}>
                            {m.startTime} – {m.endTime}
                            {m.location && ` · ${m.location}`}
                          </span>
                          <span className="row xs muted" style={{ marginTop: 4 }}>
                            <AvatarStack users={m.participants} size={18} max={3} />
                            {m.actionItems.length > 0 ? (
                              <span className="row" style={{ gap: 4 }}>
                                <ListChecks size={12} />
                                {m.actionItems.filter((a) => a.task?.status === 'DONE').length}/{m.actionItems.length}{' '}
                                action items
                              </span>
                            ) : startOfDay(m.date) > today ? (
                              'Upcoming'
                            ) : (
                              fmtLong(m.date)
                            )}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {selected && (
            <MeetingDetail
              key={selected.id}
              m={selected}
              projectId={projectId}
              can={can}
              onEdit={setEditing}
              onDelete={setDeleting}
            />
          )}
        </div>
      )}
      {editing && (
        <MeetingFormModal
          projectId={projectId}
          meeting={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(m) => setSelectedId(m.id)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete meeting?"
          danger
          confirmLabel="Delete"
          busy={del.isPending}
          error={del.error && errorMessage(del.error)}
          message={`"${deleting.title}" and its notes will be deleted.`}
          onConfirm={() => del.mutate(deleting.id)}
          onClose={() => {
            setDeleting(null);
            del.reset();
          }}
        />
      )}
    </div>
  );
}
