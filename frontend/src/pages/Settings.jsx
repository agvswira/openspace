import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Lock, Archive, Trash2, ArchiveRestore, Check, ChevronDown, Users, Upload } from 'lucide-react';
import { api, errorMessage } from '../api/client';
import { keys, useApiMutation, useMembers, useProject, useProjects } from '../api/hooks';
import {
  Avatar,
  AvatarStack,
  ConfirmDialog,
  Field,
  FormError,
  LoadingBlock,
  ProjectMark,
  Switch,
} from '../components/ui';
import { toAvatarDataUrl } from '../lib/image';
import { PROJECT_COLORS } from '../components/layout/NewProjectModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export function ProjectSettings() {
  const { projectId } = useParams();
  const { data: p, isLoading } = useProject(projectId);
  if (isLoading || !p)
    return (
      <div className="page">
        <LoadingBlock rows={4} />
      </div>
    );
  // key: form diisi ulang dari data proyek bila berpindah ke proyek lain
  return <ProjectSettingsForm key={p.id} p={p} />;
}

function ProjectSettingsForm({ p }) {
  const projectId = p.id;
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    name: p.name,
    description: p.description ?? '',
    color: p.color,
    ownerId: p.owner.id,
  }));
  const { data: membersData } = useMembers(projectId);
  const pendingInvites = membersData?.invitations.length ?? 0;
  // Figma menampilkan tiga warna; warna proyek saat ini tetap ditampilkan bila berbeda.
  const colors = [...new Set([...PROJECT_COLORS.slice(0, 3), form.color])];
  const [confirm, setConfirm] = useState(null);
  const [err, setErr] = useState('');

  const inv = [keys.project(projectId), keys.projects];
  const save = useApiMutation((b) => api.patch(`/projects/${projectId}`, b), {
    invalidate: inv,
    onSuccess: () => toast('Perubahan disimpan'),
  });
  const archive = useApiMutation((on) => api.post(`/projects/${projectId}/archive`, { archive: on }), {
    invalidate: inv,
    onSuccess: (_d, on) => {
      toast(on ? 'Proyek diarsipkan' : 'Proyek dipulihkan');
      setConfirm(null);
      if (on) navigate('/');
    },
  });
  const transfer = useApiMutation((userId) => api.post(`/projects/${projectId}/transfer`, { userId }), {
    invalidate: [...inv, keys.members(projectId), keys.roles(projectId)],
    onSuccess: () => {
      toast('Kepemilikan dialihkan');
      setConfirm(null);
    },
  });
  const remove = useApiMutation(() => api.delete(`/projects/${projectId}`), {
    invalidate: [keys.projects],
    onSuccess: () => {
      toast('Proyek dihapus');
      navigate('/');
    },
  });

  const isOwner = p.access.isOwner;

  const submit = (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return setErr('Nama proyek minimal 2 karakter.');
    setErr('');
    save.mutate(
      { name: form.name, description: form.description || null, color: form.color },
      // Owner yang diganti dialihkan setelah detail tersimpan, dengan konfirmasi.
      { onSuccess: () => form.ownerId !== p.owner.id && setConfirm('transfer') },
    );
  };
  const newOwner = p.members.find((m) => m.id === form.ownerId);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Project settings</h1>
          <p className="page-sub">Details, access and lifecycle of {p.name}</p>
        </div>
      </div>
      {!isOwner && (
        <div
          className="form-error"
          style={{ marginBottom: 16, background: 'var(--blocked-bg)', color: 'var(--blocked)', borderColor: '#fde68a' }}
        >
          <Lock size={15} />
          Hanya Owner yang dapat mengubah pengaturan proyek. Anda melihat dalam mode baca.
        </div>
      )}

      <form className="settings-section" onSubmit={submit}>
        <div>
          <h3 className="card-title">Project details</h3>
          <p className="sm muted" style={{ marginTop: 4 }}>
            Name, logo and description shown to everyone in the project.
          </p>
        </div>
        <fieldset
          disabled={!isOwner}
          style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div className="row">
            <ProjectMark project={{ color: form.color, icon: p.icon }} size={40} />
            <div className="grow">
              <div className="sm" style={{ fontWeight: 500 }}>
                Project logo
              </div>
              <div className="xs muted">Pick a color for the project mark.</div>
            </div>
            {colors.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setForm({ ...form, color: c })}
                aria-label={`Warna ${c}`}
                aria-pressed={form.color === c}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: c,
                  border: form.color === c ? '3px solid #fff' : 'none',
                  boxShadow: form.color === c ? `0 0 0 2px ${c}` : 'none',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
          <Field label="Project name" htmlFor="ps-name">
            <input
              id="ps-name"
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Description" htmlFor="ps-desc">
            <textarea
              id="ps-desc"
              className="textarea"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <Field label="Owner" hint="Only the owner can archive or delete the project." htmlFor="ps-owner">
            <select
              id="ps-owner"
              className="select"
              value={form.ownerId}
              onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
            >
              {p.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <FormError message={err || (save.error && errorMessage(save.error))} />
          {isOwner && (
            <div style={{ textAlign: 'right' }}>
              <button className="btn btn-primary" disabled={save.isPending}>
                <Check size={15} />
                Save changes
              </button>
            </div>
          )}
        </fieldset>
      </form>

      <section className="settings-section">
        <div>
          <h3 className="card-title">Project access</h3>
          <p className="sm muted" style={{ marginTop: 4 }}>
            Who can open this project and how new people join.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Visibility">
            <div className="input row" aria-readonly="true">
              <Lock size={14} className="faint" />
              <span className="grow">Invited members only</span>
              <ChevronDown size={15} className="faint" />
            </div>
          </Field>
          <div className="row-between">
            <span className="row sm">
              <AvatarStack users={p.members} size={26} />
              {p.members.length} members
              {pendingInvites > 0 && ` · ${pendingInvites} pending invite${pendingInvites > 1 ? 's' : ''}`}
            </span>
            <Link to={`/projects/${projectId}/members`} className="btn">
              <Users size={14} />
              Manage members
            </Link>
          </div>
        </div>
      </section>

      {isOwner && (
        <section className="settings-section">
          <div>
            <h3 className="card-title">Danger zone</h3>
            <p className="sm muted" style={{ marginTop: 4 }}>
              Archiving hides the project but keeps its data. Deleting removes it for everyone.
            </p>
          </div>
          <div>
            <div className="danger-row">
              <div>
                <div className="sm" style={{ fontWeight: 500 }}>
                  {p.archivedAt ? 'Restore project' : 'Archive project'}
                </div>
                <div className="xs muted">
                  {p.archivedAt
                    ? 'Bring the project back to the sidebar.'
                    : 'Tasks become read-only and leave the sidebar.'}
                </div>
              </div>
              <button className="btn" onClick={() => (p.archivedAt ? archive.mutate(false) : setConfirm('archive'))}>
                {p.archivedAt ? (
                  <>
                    <ArchiveRestore size={14} />
                    Restore
                  </>
                ) : (
                  <>
                    <Archive size={14} />
                    Archive
                  </>
                )}
              </button>
            </div>
            <div className="divider" />
            <div className="danger-row">
              <div>
                <div className="sm" style={{ fontWeight: 500 }}>
                  Delete project
                </div>
                <div className="xs muted">
                  Removes {p._count.tasks} tasks, {p._count.milestones} milestones and {p._count.meetings} meetings
                  permanently.
                </div>
              </div>
              <button className="btn btn-danger" onClick={() => setConfirm('delete')}>
                <Trash2 size={14} />
                Delete project
              </button>
            </div>
          </div>
        </section>
      )}

      {confirm === 'transfer' && newOwner && (
        <ConfirmDialog
          title="Transfer ownership?"
          confirmLabel="Transfer"
          busy={transfer.isPending}
          error={transfer.error && errorMessage(transfer.error)}
          message={`${newOwner.name} akan menjadi Owner proyek. Anda akan menjadi Member dan tidak lagi dapat mengelola anggota, role, atau pengaturan proyek.`}
          onConfirm={() => transfer.mutate(newOwner.id)}
          onClose={() => {
            setConfirm(null);
            setForm((f) => ({ ...f, ownerId: p.owner.id }));
          }}
        />
      )}
      {confirm === 'archive' && (
        <ConfirmDialog
          title="Archive project?"
          confirmLabel="Archive"
          busy={archive.isPending}
          message={`${p.name} akan disembunyikan dari sidebar. Data tetap tersimpan dan dapat dipulihkan.`}
          onConfirm={() => archive.mutate(true)}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === 'delete' && (
        <ConfirmDialog
          title="Delete project?"
          danger
          confirmLabel="Delete permanently"
          busy={remove.isPending}
          error={remove.error && errorMessage(remove.error)}
          message={`${p.name} beserta seluruh tugas, rapat, dan milestone akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`}
          onConfirm={() => remove.mutate()}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

export function WorkspaceSettings() {
  const { user, workspace, reload } = useAuth();
  const toast = useToast();
  const { data: archived = [] } = useProjects(true);
  const [ws, setWs] = useState(workspace?.name ?? '');
  const [profile, setProfile] = useState({ name: user.name, email: user.email, title: user.title ?? '' });
  const [prefs, setPrefs] = useState(user.preferences);
  const saveWs = useApiMutation((name) => api.patch(`/workspaces/${workspace.id}`, { name }), {
    onSuccess: () => {
      reload();
      toast('Workspace diperbarui');
    },
  });
  // Nama/foto tampil di banyak halaman, jadi semua data yang memuat pengguna dimuat ulang.
  const saveProfile = useApiMutation((b) => api.patch('/me', b), {
    invalidate: [
      keys.projects,
      ['project'],
      ['members'],
      ['tasks'],
      ['task'],
      ['overview'],
      ['myTasks'],
      ['meetings'],
      ['milestones'],
      ['comments'],
    ],
    onSuccess: () => {
      reload();
      toast('Profil disimpan');
    },
  });
  const unarchive = useApiMutation((id) => api.post(`/projects/${id}/archive`, { archive: false }), {
    invalidate: [keys.projects],
    onSuccess: () => toast('Proyek dipulihkan'),
  });

  const setPref = (k, v) => {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    saveProfile.mutate({ [k]: v });
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Workspace settings</h1>
          <p className="page-sub">Your workspace, profile and notification preferences</p>
        </div>
      </div>

      {workspace && (
        <form
          className="settings-section"
          onSubmit={(e) => {
            e.preventDefault();
            if (ws.trim().length >= 2) saveWs.mutate(ws.trim());
          }}
        >
          <div>
            <h3 className="card-title">Workspace</h3>
            <p className="sm muted" style={{ marginTop: 4 }}>
              Shown in the sidebar for everyone you invite.
            </p>
          </div>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div className="grow">
              <Field label="Workspace name" htmlFor="ws-name">
                <input id="ws-name" className="input" value={ws} onChange={(e) => setWs(e.target.value)} />
              </Field>
            </div>
            <button className="btn btn-primary" disabled={saveWs.isPending}>
              Save
            </button>
          </div>
        </form>
      )}

      <form
        className="settings-section"
        onSubmit={(e) => {
          e.preventDefault();
          saveProfile.mutate({ ...profile, title: profile.title || null });
        }}
      >
        <div>
          <h3 className="card-title">Profile</h3>
          <p className="sm muted" style={{ marginTop: 4 }}>
            Photo, name, email and role title.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* FR-02: foto profil */}
          <div className="row" style={{ gap: 14 }}>
            <Avatar user={user} size={56} />
            <div className="grow">
              <div className="sm" style={{ fontWeight: 500 }}>
                Profile photo
              </div>
              <div className="xs muted">JPG or PNG. Cropped to a square.</div>
            </div>
            <label className="btn" style={{ cursor: 'pointer' }}>
              <Upload size={14} />
              Change photo
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  try {
                    saveProfile.mutate({ avatarUrl: await toAvatarDataUrl(file) });
                  } catch (err) {
                    toast(err.message, 'error');
                  }
                }}
              />
            </label>
            {user.avatarUrl && (
              <button type="button" className="btn btn-ghost" onClick={() => saveProfile.mutate({ avatarUrl: null })}>
                Remove
              </button>
            )}
          </div>
          <div className="form-grid">
            <Field label="Full name" htmlFor="pf-name">
              <input
                id="pf-name"
                className="input"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              />
            </Field>
            <Field label="Title" htmlFor="pf-title">
              <input
                id="pf-title"
                className="input"
                value={profile.title}
                onChange={(e) => setProfile({ ...profile, title: e.target.value })}
                placeholder="e.g. Project Manager"
              />
            </Field>
          </div>
          <Field label="Email" htmlFor="pf-email">
            <input
              id="pf-email"
              type="email"
              className="input"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            />
          </Field>
          <FormError message={saveProfile.error && errorMessage(saveProfile.error)} />
          <div style={{ textAlign: 'right' }}>
            <button className="btn btn-primary" disabled={saveProfile.isPending}>
              Save profile
            </button>
          </div>
        </div>
      </form>

      <section className="settings-section">
        <div>
          <h3 className="card-title">Notifications</h3>
          <p className="sm muted" style={{ marginTop: 4 }}>
            Choose which events notify you.
          </p>
        </div>
        <div className="card">
          {[
            ['notifyAssign', 'Task assigned to me', 'When someone assigns you a task.'],
            ['notifyComment', 'New comments', 'Comments on tasks you are assigned to.'],
            ['notifyDeadline', 'Deadline reminders', 'One day before a task is due.'],
          ].map(([k, label, desc]) => (
            <div key={k} className="perm-row">
              <div>
                <div className="sm" style={{ fontWeight: 500 }}>
                  {label}
                </div>
                <div className="xs muted">{desc}</div>
              </div>
              <Switch label={label} checked={!!prefs[k]} onChange={(v) => setPref(k, v)} />
            </div>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <div>
          <h3 className="card-title">Archived projects</h3>
          <p className="sm muted" style={{ marginTop: 4 }}>
            Projects hidden from the sidebar.
          </p>
        </div>
        <div className="card">
          {!archived.length && (
            <p className="sm faint" style={{ padding: 14 }}>
              Tidak ada proyek yang diarsipkan.
            </p>
          )}
          {archived.map((p) => (
            <div key={p.id} className="list-row">
              <ProjectMark project={p} />
              <span className="grow sm">{p.name}</span>
              {p.role.isOwner && (
                <button className="btn btn-sm" onClick={() => unarchive.mutate(p.id)}>
                  <ArchiveRestore size={13} />
                  Restore
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
