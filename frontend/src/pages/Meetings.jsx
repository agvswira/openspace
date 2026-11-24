import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  CalendarDays,
  Clock,
  MapPin,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  UserCheck,
  ExternalLink,
} from 'lucide-react';
import { api, errorMessage } from '../api/client';
import { keys, useApiMutation, useMeetings, useMembers } from '../api/hooks';
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
import { addDays, fmtLong, fromInputDate, startOfDay, toInputDate, MONTHS } from '../lib/format';
import { useCan } from '../components/tasks/TaskDetailPanel';
import { useToast } from '../context/ToastContext';
import { useMenuBinder } from '../components/ui/ContextMenu';

// Status kehadiran peserta rapat. Present dan Late dihitung hadir.
const ATTENDANCE = [
  { key: 'PRESENT', label: 'Present', tone: 'DONE' },
  { key: 'LATE', label: 'Late', tone: 'IN_PROGRESS' },
  { key: 'EXCUSED', label: 'Excused', tone: 'TODO' },
  { key: 'ABSENT', label: 'Absent', tone: 'OVERDUE' },
];
const attended = (m) => m.participants.filter((p) => p.attendance === 'PRESENT' || p.attendance === 'LATE').length;
const recorded = (m) => m.participants.filter((p) => p.attendance).length;

// Pilih peserta: semua anggota sekaligus, per role, atau satu per satu.
function AttendeePicker({ members, value, onChange }) {
  const ids = members.map((m) => m.user.id);
  const roles = [...new Set(members.map((m) => m.role.name))];
  const allSelected = ids.length > 0 && ids.every((id) => value.includes(id));
  const roleIds = (role) => members.filter((m) => m.role.name === role).map((m) => m.user.id);
  const roleSelected = (role) => roleIds(role).every((id) => value.includes(id));
  const toggleRole = (role) => {
    const r = roleIds(role);
    onChange(roleSelected(role) ? value.filter((id) => !r.includes(id)) : [...new Set([...value, ...r])]);
  };
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div className="attendee-picker">
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        <button
          type="button"
          className={`chip ${allSelected ? 'active' : ''}`}
          aria-pressed={allSelected}
          onClick={() => onChange(allSelected ? [] : ids)}
        >
          {allSelected ? <Check size={13} /> : null}
          Select all members
        </button>
        {roles.map((role) => (
          <button
            type="button"
            key={role}
            className={`chip ${roleSelected(role) ? 'active' : ''}`}
            aria-pressed={roleSelected(role)}
            onClick={() => toggleRole(role)}
          >
            {roleSelected(role) ? <Check size={13} /> : null}
            {role}
          </button>
        ))}
        <span className="xs muted" style={{ marginLeft: 'auto' }}>
          {value.length} of {ids.length} selected
        </span>
      </div>
      <div className="attendee-list">
        {members.map((m) => (
          <label key={m.user.id} className="check attendee-item">
            <input type="checkbox" checked={value.includes(m.user.id)} onChange={() => toggle(m.user.id)} />
            <Avatar user={m.user} size={22} />
            <span className="grow sm">{m.user.name}</span>
            <span className="xs muted">{m.role.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

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

  return (
    <Modal
      title={meeting ? 'Edit meeting' : 'New meeting'}
      subtitle="Record the meeting, who should attend, and notes. Attendance is tracked after the meeting."
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
        <Field label="Notes" hint="Each line becomes one bullet point in the meeting notes." htmlFor="mt-notes">
          <textarea id="mt-notes" className="textarea" value={form.notes} onChange={set('notes')} />
        </Field>
        <Field label="Attendees">
          <AttendeePicker
            members={members?.members ?? []}
            value={form.participantIds}
            onChange={(participantIds) => setForm((f) => ({ ...f, participantIds }))}
          />
        </Field>
        <FormError message={err || (save.error && errorMessage(save.error))} />
      </form>
    </Modal>
  );
}

function MeetingDetail({ m, projectId, can, onEdit, onDelete }) {
  const toast = useToast();
  const { data: members } = useMembers(projectId);
  const [rejected, setRejected] = useState(null);
  const canMeet = can('MANAGE_MEETINGS');
  const mark = useApiMutation((entries) => api.put(`/meetings/${m.id}/attendance`, { entries }), {
    invalidate: [keys.meetings(projectId)],
  });
  const setAttendance = (entries, message) =>
    mark.mutate(entries, {
      onSuccess: () => message && toast(message),
      onError: (e) => setRejected(errorMessage(e)),
    });
  const counts = Object.fromEntries(
    ATTENDANCE.map((a) => [a.key, m.participants.filter((p) => p.attendance === a.key).length]),
  );
  const notRecorded = m.participants.length - recorded(m);
  // Peserta dikelompokkan per role, urutan role mengikuti daftar anggota proyek.
  const roleOf = (id) => members?.members.find((x) => x.user.id === id)?.role.name ?? 'Other';
  const roleOrder = [...new Set([...(members?.members ?? []).map((x) => x.role.name), 'Other'])];
  const groups = roleOrder
    .map((role) => ({ role, people: m.participants.filter((p) => roleOf(p.id) === role) }))
    .filter((g) => g.people.length);

  return (
    <div className="meeting-detail">
      <section className="card card-pad">
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
      </section>

      {/* Kehadiran dipisah ke kotak sendiri agar tidak bercampur dengan catatan rapat. */}
      <section className="card card-pad">
        <div className="row-between" style={{ marginBottom: 8 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Attendance</h2>
          <div className="row" style={{ gap: 8 }}>
            <span className="badge mono" style={{ background: 'var(--bg-muted)', color: 'var(--text-muted)' }}>
              {attended(m)} / {m.participants.length} attended
            </span>
            {canMeet && m.participants.length > 0 && (
              <button
                className="btn btn-sm"
                disabled={mark.isPending}
                onClick={() =>
                  setAttendance(
                    m.participants.map((p) => ({ userId: p.id, attendance: 'PRESENT' })),
                    'Semua peserta ditandai hadir',
                  )
                }
              >
                <UserCheck size={13} />
                Mark all present
              </button>
            )}
          </div>
        </div>
        {m.participants.length > 0 && (
          <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {ATTENDANCE.map((a) => (
              <span key={a.key} className={`att-pill att-${a.key}`}>
                {a.label} <strong>{counts[a.key]}</strong>
              </span>
            ))}
            <span className="att-pill att-NONE">
              Not recorded <strong>{notRecorded}</strong>
            </span>
          </div>
        )}
        {!m.participants.length && (
          <div className="card">
            <p className="sm faint" style={{ padding: 14 }}>
              Belum ada peserta. Tambahkan peserta lewat Edit.
            </p>
          </div>
        )}
        <div className="att-groups">
          {groups.map((g) => (
            <div key={g.role} className="card att-group">
              <div className="att-group-head">
                <strong className="sm">{g.role}</strong>
                <span className="xs muted mono">
                  {attended({ participants: g.people })}/{g.people.length} attended
                </span>
              </div>
              {g.people.map((p) => {
                const current = ATTENDANCE.find((x) => x.key === p.attendance);
                return (
                  <div key={p.id} className="list-row attendance-row">
                    <Avatar user={p} size={28} />
                    <span className="grow sm" style={{ minWidth: 0, fontWeight: 500 }}>
                      {p.name}
                    </span>
                    {canMeet ? (
                      <div className="att-seg" role="group" aria-label={`Kehadiran ${p.name}`}>
                        {ATTENDANCE.map((a) => {
                          const on = p.attendance === a.key;
                          return (
                            <button
                              key={a.key}
                              type="button"
                              className={`att-${a.key} ${on ? 'on' : ''}`}
                              aria-pressed={on}
                              disabled={mark.isPending}
                              onClick={() => setAttendance([{ userId: p.id, attendance: on ? null : a.key }])}
                            >
                              {a.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : current ? (
                      <span className={`att-pill att-${current.key} on`}>{current.label}</span>
                    ) : (
                      <span className="att-pill att-NONE">Not recorded</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {rejected && (
          <ConfirmDialog title="Kehadiran tidak tersimpan" message={rejected} onClose={() => setRejected(null)} />
        )}
      </section>
    </div>
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
  const bindMenu = useMenuBinder();
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
          <p className="page-sub">Notes and attendance from team meetings</p>
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
            Catat rapat tim beserta peserta, catatan, dan kehadiran setiap anggota.
          </EmptyState>
        </div>
      ) : (
        <div className="meetings-split" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 }}>
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
                        {...bindMenu(() => [
                          { label: 'Open meeting', icon: ExternalLink, onSelect: () => setSelectedId(m.id) },
                          {
                            label: 'Edit meeting…',
                            icon: Pencil,
                            disabled: !can('MANAGE_MEETINGS'),
                            hint: 'Role Anda tidak memiliki izin Manage meetings.',
                            onSelect: () => setEditing(m),
                          },
                          { separator: true },
                          {
                            label: 'Delete meeting',
                            icon: Trash2,
                            danger: true,
                            disabled: !can('MANAGE_MEETINGS'),
                            hint: 'Role Anda tidak memiliki izin Manage meetings.',
                            onSelect: () => setDeleting(m),
                          },
                        ])}
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
                            {recorded(m) > 0 ? (
                              <span className="row" style={{ gap: 4 }}>
                                <UserCheck size={12} />
                                {attended(m)}/{m.participants.length} attended
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
          message={`"${deleting.title}", its notes and attendance will be deleted.`}
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
