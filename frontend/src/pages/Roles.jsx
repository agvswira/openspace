import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Shield, Users, Plus, Copy, Trash2, ArrowLeft, Columns3, Check, Minus, Lock } from 'lucide-react';
import { api, errorMessage } from '../api/client';
import { keys, useApiMutation, usePermissionCatalog, useProject, useRoles } from '../api/hooks';
import {
  AvatarStack,
  ConfirmDialog,
  ErrorState,
  Field,
  FormError,
  LoadingBlock,
  Modal,
  Switch,
} from '../components/ui';
import { useToast } from '../context/ToastContext';

const GROUPS = ['Tasks', 'Collaboration', 'Planning'];

// Dialog Compare roles: tabel izin semua role, hanya-baca.
function CompareRoles({ roles, catalog, onClose }) {
  return (
    <Modal
      title="Compare roles"
      subtitle="Read-only. Edit a role from the list to change its permissions."
      size="lg"
      onClose={onClose}
    >
      <div className="card" style={{ overflow: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Permission</th>
              {roles.map((r) => (
                <th key={r.id} style={{ textAlign: 'center' }}>
                  {r.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {catalog.map((p) => (
              <tr key={p.key}>
                <td>
                  <div className="sm" style={{ fontWeight: 500 }}>
                    {p.label}
                  </div>
                  <div className="xs muted">{p.description}</div>
                </td>
                {roles.map((r) => (
                  <td key={r.id} style={{ textAlign: 'center' }}>
                    {r.permissions.includes(p.key) ? (
                      <Check size={16} className="st-DONE" aria-label="Ya" />
                    ) : (
                      <Minus size={16} className="faint" aria-label="Tidak" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function NewRoleModal({ projectId, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', description: '' });
  const [err, setErr] = useState('');
  const create = useApiMutation((b) => api.post(`/projects/${projectId}/roles`, b).then((r) => r.data), {
    invalidate: [keys.roles(projectId)],
    onSuccess: (r) => {
      onCreated(r);
      onClose();
    },
  });
  const submit = (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return setErr('Nama role minimal 2 karakter.');
    create.mutate({ ...form, permissions: ['OWN_TASKS'] });
  };
  return (
    <Modal
      title="New custom role"
      subtitle="Start with Own tasks, then switch on what this role needs."
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" form="role-form" disabled={create.isPending}>
            Create role
          </button>
        </>
      }
    >
      <form id="role-form" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Role name" htmlFor="rn">
          <input
            id="rn"
            autoFocus
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Koordinator"
          />
        </Field>
        <Field label="Description" htmlFor="rd">
          <input
            id="rd"
            className="input"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What this role is for"
          />
        </Field>
        <FormError message={err || (create.error && errorMessage(create.error))} />
      </form>
    </Modal>
  );
}

const draftOf = (role) => ({ name: role.name, description: role.description ?? '', permissions: role.permissions });
const sameSet = (a, b) => a.length === b.length && a.every((k) => b.includes(k));

// Panel detail role. Diberi `key` per role sehingga draft otomatis diisi ulang saat role lain dipilih.
function RoleDetail({ role, catalog, isOwner, projectId, onDuplicate, onDelete }) {
  const toast = useToast();
  const [draft, setDraft] = useState(() => draftOf(role));
  const save = useApiMutation((body) => api.patch(`/projects/${projectId}/roles/${role.id}`, body), {
    invalidate: [keys.roles(projectId), keys.members(projectId), keys.project(projectId)],
    onSuccess: () => toast('Role disimpan'),
  });

  const locked = !isOwner || role.isOwner;
  const dirty =
    !sameSet(draft.permissions, role.permissions) ||
    draft.name !== role.name ||
    draft.description !== (role.description ?? '');
  const togglePerm = (key, on) =>
    setDraft((d) => ({ ...d, permissions: on ? [...d.permissions, key] : d.permissions.filter((k) => k !== key) }));
  const memberText = role.members.length
    ? `${role.members.length} member${role.members.length > 1 ? 's' : ''} with this role`
    : 'No members with this role';

  return (
    <section className="card">
      <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="row-between">
          <div className="row">
            <strong style={{ fontSize: 18 }}>{role.name}</strong>
            {role.isBuiltIn ? (
              <span className="badge" style={{ background: 'var(--bg-muted)' }}>
                Built-in
              </span>
            ) : (
              <span className="custom-pill">Custom</span>
            )}
          </div>
          {isOwner && (
            <div className="row">
              <button className="btn btn-sm" onClick={() => onDuplicate(role)}>
                <Copy size={13} />
                Duplicate
              </button>
              {!role.isBuiltIn && (
                <button className="btn btn-sm btn-danger" onClick={() => onDelete(role)}>
                  <Trash2 size={13} />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
        {!role.isBuiltIn && isOwner ? (
          <div className="form-grid">
            <Field label="Name">
              <input
                className="input"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            <Field label="Description">
              <input
                className="input"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </Field>
          </div>
        ) : (
          <p className="sm muted">{role.description}</p>
        )}
        <div className="row sm muted">
          <AvatarStack users={role.members} size={24} />
          {memberText}
        </div>
        {role.isOwner && (
          <div className="row sm st-BLOCKED">
            <Lock size={14} />
            Owner permissions cannot be changed.
          </div>
        )}
      </div>

      {GROUPS.map((g) => (
        <div key={g}>
          <div
            className="section-title"
            style={{ padding: '10px 16px 0', margin: 0, borderTop: '1px solid var(--border)' }}
          >
            {g}
          </div>
          {catalog
            .filter((p) => p.group === g)
            .map((p) => (
              <div key={p.key} className="perm-row" style={{ borderTop: 'none' }}>
                <div>
                  <div className="sm" style={{ fontWeight: 500 }}>
                    {p.label}
                  </div>
                  <div className="xs muted">{p.description}</div>
                </div>
                <Switch
                  label={p.label}
                  checked={draft.permissions.includes(p.key)}
                  disabled={locked}
                  onChange={(on) => togglePerm(p.key, on)}
                />
              </div>
            ))}
        </div>
      ))}
      <div className="row" style={{ justifyContent: 'flex-end', padding: 16, borderTop: '1px solid var(--border)' }}>
        <span className="xs muted grow">Changes apply to the next action members take.</span>
        <FormError message={save.error && errorMessage(save.error)} />
        {!locked && (
          <>
            <button className="btn" disabled={!dirty} onClick={() => setDraft(draftOf(role))}>
              Discard
            </button>
            <button
              className="btn btn-primary"
              disabled={!dirty || save.isPending}
              onClick={() => save.mutate(role.isBuiltIn ? { permissions: draft.permissions } : draft)}
            >
              Save changes
            </button>
          </>
        )}
      </div>
    </section>
  );
}

export default function Roles() {
  const { projectId } = useParams();
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const { data: project } = useProject(projectId);
  const { data: roles, isLoading, error, refetch } = useRoles(projectId);
  const { data: catalog = [] } = usePermissionCatalog(projectId);
  const [comparing, setComparing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const isOwner = project?.access?.isOwner;

  const inv = [keys.roles(projectId), keys.members(projectId), keys.project(projectId)];
  const duplicate = useApiMutation(
    (id) => api.post(`/projects/${projectId}/roles/${id}/duplicate`).then((r) => r.data),
    {
      invalidate: inv,
      onSuccess: (r) => {
        toast(`Role ${r.name} dibuat`);
        setParams({ role: r.id });
      },
    },
  );
  const del = useApiMutation((id) => api.delete(`/projects/${projectId}/roles/${id}`), {
    invalidate: inv,
    onSuccess: () => {
      toast('Role dihapus');
      setDeleting(null);
      setParams({});
    },
  });

  if (isLoading) {
    return (
      <div className="page">
        <LoadingBlock rows={4} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="page">
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );
  }
  const selected = roles.find((r) => r.id === params.get('role')) ?? roles[0];

  return (
    <div className="page">
      <Link to={`/projects/${projectId}/members`} className="sm muted row" style={{ marginBottom: 12 }}>
        <ArrowLeft size={14} />
        Members
      </Link>
      <div className="page-head">
        <div>
          <h1 className="page-title">Roles</h1>
          <p className="page-sub">Choose what each role can do in {project?.name}. Only the Owner can change roles.</p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setComparing(true)}>
            <Columns3 size={15} />
            Compare roles
          </button>
          {isOwner && (
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              <Plus size={15} />
              New role
            </button>
          )}
        </div>
      </div>

      <div className="roles-layout">
        <div className="card" style={{ padding: 6 }}>
          {roles.map((r) => (
            <div
              key={r.id}
              role="button"
              tabIndex={0}
              className={`role-item ${r.id === selected.id ? 'active' : ''}`}
              onClick={() => setParams({ role: r.id })}
              onKeyDown={(e) => e.key === 'Enter' && setParams({ role: r.id })}
            >
              <span
                className="stat-ic"
                style={{
                  background: r.isOwner ? 'var(--primary-soft)' : 'var(--bg-muted)',
                  color: r.isOwner ? 'var(--primary)' : 'var(--text-muted)',
                }}
              >
                {r.isOwner ? <Shield size={14} /> : <Users size={14} />}
              </span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="sm row" style={{ fontWeight: 500, gap: 6 }}>
                  {r.name}
                  {!r.isBuiltIn && <span className="custom-pill">Custom</span>}
                </div>
                <div className="xs muted truncate">{r.description}</div>
              </div>
              <span className="xs muted">{r.members.length}</span>
            </div>
          ))}
        </div>

        <RoleDetail
          key={selected.id}
          role={selected}
          catalog={catalog}
          isOwner={isOwner}
          projectId={projectId}
          onDuplicate={(r) => duplicate.mutate(r.id)}
          onDelete={setDeleting}
        />
      </div>

      {comparing && <CompareRoles roles={roles} catalog={catalog} onClose={() => setComparing(false)} />}
      {creating && (
        <NewRoleModal
          projectId={projectId}
          onClose={() => setCreating(false)}
          onCreated={(r) => setParams({ role: r.id })}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          danger
          confirmLabel="Delete role"
          busy={del.isPending}
          error={del.error && errorMessage(del.error)}
          message={
            deleting.members.length
              ? `Role ini masih dipakai oleh ${deleting.members.map((m) => m.name).join(', ')}. Pindahkan anggota tersebut ke role lain di halaman Members sebelum menghapus.`
              : 'Role ini akan dihapus permanen.'
          }
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
