import { useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import {
  Search,
  ShieldCheck,
  UserPlus,
  Lock,
  MoreHorizontal,
  Mail,
  SlidersHorizontal,
  Settings2,
  Shield,
  Users,
} from 'lucide-react';
import { api, errorMessage } from '../api/client';
import { keys, projectTaskKeys, useApiMutation, useMembers, useProject, useRoles } from '../api/hooks';
import { Avatar, ConfirmDialog, ErrorState, Field, FormError, LoadingBlock, Menu, Modal } from '../components/ui';
import { diffDays, timeAgo } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

function RemoveMemberModal({ projectId, member, members, onClose }) {
  const toast = useToast();
  const others = members.filter((m) => m.id !== member.id);
  const [target, setTarget] = useState(others[0]?.user.id ?? '');
  const remove = useApiMutation(
    () =>
      api.delete(`/projects/${projectId}/members/${member.id}`, {
        data: { reassignToUserId: member.openTasks ? target : undefined },
      }),
    {
      invalidate: projectTaskKeys(projectId),
      onSuccess: () => {
        toast(`${member.user.name} dikeluarkan dari proyek`);
        onClose();
      },
    },
  );
  return (
    <Modal
      title={`Remove ${member.user.name}?`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-danger-solid" disabled={remove.isPending} onClick={() => remove.mutate()}>
            Remove member
          </button>
        </>
      }
    >
      {member.openTasks > 0 ? (
        <>
          <p className="sm" style={{ lineHeight: 1.55 }}>
            {member.user.name} masih menangani <strong>{member.openTasks} tugas terbuka</strong>. Tugas tersebut harus
            dialihkan ke anggota lain sebelum ia dikeluarkan.
          </p>
          <Field label="Reassign open tasks to" htmlFor="rm-target">
            <select id="rm-target" className="select" value={target} onChange={(e) => setTarget(e.target.value)}>
              {others.map((m) => (
                <option key={m.id} value={m.user.id}>
                  {m.user.name} · {m.role.name}
                </option>
              ))}
            </select>
          </Field>
        </>
      ) : (
        <p className="sm">{member.user.name} akan kehilangan akses ke proyek ini.</p>
      )}
      <FormError message={remove.error && errorMessage(remove.error)} />
    </Modal>
  );
}

function expiresLabel(date) {
  const n = diffDays(date, new Date());
  if (n < 0) return 'expired';
  if (n === 0) return 'expires today';
  return `expires in ${n} day${n > 1 ? 's' : ''}`;
}

export default function Members() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const { openInvite } = useOutletContext();
  const toast = useToast();
  const { data: project } = useProject(projectId);
  const { data, isLoading, error, refetch } = useMembers(projectId);
  const { data: roles = [] } = useRoles(projectId);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [removing, setRemoving] = useState(null);
  const [transfer, setTransfer] = useState(null);
  const isOwner = project?.access?.isOwner;
  const inv = [keys.members(projectId), keys.roles(projectId), keys.project(projectId)];

  const changeRole = useApiMutation(({ id, roleId }) => api.patch(`/projects/${projectId}/members/${id}`, { roleId }), {
    invalidate: inv,
    onSuccess: () => toast('Role diperbarui'),
  });
  const resend = useApiMutation((id) => api.post(`/projects/${projectId}/invitations/${id}/resend`), {
    invalidate: inv,
    onSuccess: () => toast('Undangan dikirim ulang'),
  });
  const revoke = useApiMutation((id) => api.delete(`/projects/${projectId}/invitations/${id}`), {
    invalidate: inv,
    onSuccess: () => toast('Undangan dibatalkan'),
  });
  const doTransfer = useApiMutation((userId) => api.post(`/projects/${projectId}/transfer`, { userId }), {
    invalidate: [...inv, keys.projects],
    onSuccess: () => {
      toast('Kepemilikan dialihkan');
      setTransfer(null);
    },
  });

  if (isLoading)
    return (
      <div className="page">
        <LoadingBlock rows={4} />
      </div>
    );
  if (error)
    return (
      <div className="page">
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );

  const members = data.members.filter(
    (m) =>
      (!q || `${m.user.name} ${m.user.email}`.toLowerCase().includes(q.toLowerCase())) &&
      (!roleFilter || m.role.id === roleFilter),
  );
  const maxOpen = Math.max(...data.members.map((m) => m.openTasks), 1);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Members</h1>
          <p className="page-sub">
            {data.members.length} people have access to {project?.name}
          </p>
        </div>
        <div className="row">
          <Link to={`/projects/${projectId}/roles`} className="btn">
            <ShieldCheck size={15} />
            Manage roles
          </Link>
          {isOwner && (
            <button className="btn btn-primary" onClick={openInvite}>
              <UserPlus size={15} />
              Invite member
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(240px, 300px)',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <div>
          <div className="row" style={{ marginBottom: 12 }}>
            <div className="input-icon" style={{ flex: 1, maxWidth: 260, minWidth: 0 }}>
              <Search size={14} />
              <input
                className="input"
                placeholder="Search by name or email..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Cari anggota"
              />
            </div>
            <Menu
              align="left"
              width={200}
              trigger={({ toggle }) => (
                <button className="btn" onClick={toggle} aria-label="Filter role">
                  <SlidersHorizontal size={14} />
                  {roles.find((r) => r.id === roleFilter)?.name ?? 'All roles'}
                </button>
              )}
            >
              <button className="menu-item" onClick={() => setRoleFilter('')}>
                All roles
              </button>
              {roles.map((r) => (
                <button key={r.id} className="menu-item" onClick={() => setRoleFilter(r.id)}>
                  {r.name}
                </button>
              ))}
            </Menu>
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Open tasks</th>
                  <th>Last active</th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="row">
                        <Avatar user={m.user} size={32} />
                        <div>
                          <div style={{ fontWeight: 500 }}>
                            {m.user.name} {m.user.id === user.id && <span className="xs muted">You</span>}
                          </div>
                          <div className="xs muted">{m.user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {m.role.isOwner || !isOwner ? (
                        <span className={`badge ${m.role.isOwner ? 'bg-TODO st-TODO' : ''}`}>
                          {m.role.isOwner && <Shield size={12} />}
                          {m.role.name}
                        </span>
                      ) : (
                        <span className="row" style={{ gap: 2 }}>
                          <Users size={14} className="muted" />
                          <select
                            className="inline-select"
                            value={m.role.id}
                            onChange={(e) => changeRole.mutate({ id: m.id, roleId: e.target.value })}
                            aria-label={`Role ${m.user.name}`}
                          >
                            {roles
                              .filter((r) => !r.isOwner)
                              .map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name}
                                </option>
                              ))}
                          </select>
                        </span>
                      )}
                    </td>
                    <td style={{ width: '26%' }}>
                      <div className="row">
                        <span className="mono" style={{ width: 16 }}>
                          {m.openTasks}
                        </span>
                        <div className="progress grow">
                          <span style={{ width: `${(m.openTasks / maxOpen) * 100}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="sm">
                      {m.isOnline ? (
                        <span className="st-DONE">● Online</span>
                      ) : (
                        <span className="muted">{timeAgo(m.lastActiveAt)}</span>
                      )}
                    </td>
                    <td>
                      {m.role.isOwner ? (
                        <Lock size={14} className="faint" aria-label="Owner tidak dapat dikeluarkan" />
                      ) : (
                        isOwner && (
                          <Menu
                            trigger={({ toggle }) => (
                              <button className="icon-btn" onClick={toggle} aria-label={`Menu ${m.user.name}`}>
                                <MoreHorizontal size={16} />
                              </button>
                            )}
                          >
                            <button className="menu-item" onClick={() => setTransfer(m)}>
                              <Shield size={14} />
                              Make owner
                            </button>
                            <button className="menu-item danger" onClick={() => setRemoving(m)}>
                              Remove from project
                            </button>
                          </Menu>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <FormError message={changeRole.error && errorMessage(changeRole.error)} />
        </div>

        <aside className="card">
          <div className="card-head">
            <span className="card-title">Roles</span>
            <Link to={`/projects/${projectId}/roles`} className="btn btn-sm">
              <Settings2 size={13} />
              Manage
            </Link>
          </div>
          {roles.map((r) => (
            <Link key={r.id} to={`/projects/${projectId}/roles?role=${r.id}`} className="list-row clickable">
              <span
                className="stat-ic"
                style={{
                  background: r.isOwner ? 'var(--primary-soft)' : 'var(--bg-muted)',
                  color: r.isOwner ? 'var(--primary)' : 'var(--text-muted)',
                }}
              >
                {r.isOwner ? <Shield size={14} /> : <Users size={14} />}
              </span>
              <div className="grow">
                <div className="sm row" style={{ fontWeight: 500, gap: 6 }}>
                  {r.name}
                  {!r.isBuiltIn && <span className="custom-pill">Custom</span>}
                </div>
                <div className="xs muted">{r.description}</div>
              </div>
              <span className="badge" style={{ background: 'var(--bg-muted)' }}>
                {r.members.length}
              </span>
            </Link>
          ))}
        </aside>
      </div>

      {data.invitations.length > 0 && (
        <div className="card" style={{ marginTop: 16, background: 'var(--bg-subtle)' }}>
          {data.invitations.map((i) => (
            <div key={i.id} className="list-row">
              <span
                className="avatar"
                style={{
                  width: 30,
                  height: 30,
                  background: '#fff',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                }}
              >
                <Mail size={14} />
              </span>
              <div className="grow">
                <div className="sm" style={{ fontWeight: 500 }}>
                  {i.email}
                </div>
                <div className="xs muted">
                  Invited as {i.role.name} · {expiresLabel(i.expiresAt)}
                </div>
              </div>
              {isOwner && (
                <>
                  <button className="btn btn-ghost btn-sm" onClick={() => revoke.mutate(i.id)}>
                    Revoke
                  </button>
                  <button className="btn btn-sm" onClick={() => resend.mutate(i.id)}>
                    <Mail size={12} />
                    Resend
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {removing && (
        <RemoveMemberModal
          projectId={projectId}
          member={removing}
          members={data.members}
          onClose={() => setRemoving(null)}
        />
      )}
      {transfer && (
        <ConfirmDialog
          title="Transfer ownership?"
          confirmLabel="Transfer"
          busy={doTransfer.isPending}
          error={doTransfer.error && errorMessage(doTransfer.error)}
          message={`${transfer.user.name} akan menjadi Owner proyek. Anda akan menjadi Member dan tidak lagi dapat mengelola anggota atau role.`}
          onConfirm={() => doTransfer.mutate(transfer.user.id)}
          onClose={() => setTransfer(null)}
        />
      )}
    </div>
  );
}
