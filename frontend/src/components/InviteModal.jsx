import { useState } from 'react';
import { Mail } from 'lucide-react';
import { api, errorMessage } from '../api/client';
import { keys, useApiMutation, useMembers, useRoles } from '../api/hooks';
import { Avatar, Field, FormError, Modal } from './ui';
import { useToast } from '../context/ToastContext';

// FR-04: undangan anggota lewat email beserta role tujuan.
export default function InviteModal({ projectId, onClose }) {
  const { data: roles = [] } = useRoles(projectId);
  const { data: members } = useMembers(projectId);
  const assignable = roles.filter((r) => !r.isOwner);
  const memberRole = assignable.find((r) => r.name === 'Member');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [fieldError, setFieldError] = useState('');
  const toast = useToast();
  const invite = useApiMutation((body) => api.post(`/projects/${projectId}/invitations`, body), {
    invalidate: [keys.members(projectId)],
    onSuccess: (_d, vars) => {
      toast(`Undangan dikirim ke ${vars.email}`);
      setEmail('');
    },
  });

  const submit = (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setFieldError('Format email tidak valid.');
    setFieldError('');
    invite.mutate({ email: email.trim(), roleId: roleId || memberRole?.id });
  };

  return (
    <Modal
      title="Share project"
      subtitle="Invite people by email. They join with the role you choose."
      onClose={onClose}
    >
      <form onSubmit={submit} className="row" style={{ alignItems: 'flex-start' }}>
        <div className="grow">
          <Field error={fieldError}>
            <div className="input-icon">
              <Mail size={15} />
              <input
                autoFocus
                className="input"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Email"
              />
            </div>
          </Field>
        </div>
        <select
          className="select"
          style={{ width: 140 }}
          value={roleId || memberRole?.id || ''}
          onChange={(e) => setRoleId(e.target.value)}
          aria-label="Role"
        >
          {assignable.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button className="btn btn-primary" disabled={invite.isPending}>
          Invite
        </button>
      </form>
      <FormError message={invite.error && errorMessage(invite.error)} />
      <div>
        <div className="section-title">People with access</div>
        {members?.members.map((m) => (
          <div key={m.id} className="row" style={{ padding: '6px 0' }}>
            <Avatar user={m.user} size={28} />
            <div className="grow">
              <div className="sm">{m.user.name}</div>
              <div className="xs muted">{m.user.email}</div>
            </div>
            <span className="xs muted">{m.role.name}</span>
          </div>
        ))}
        {members?.invitations.map((i) => (
          <div key={i.id} className="row" style={{ padding: '6px 0' }}>
            <span
              className="avatar"
              style={{ width: 28, height: 28, background: 'var(--bg-muted)', color: 'var(--text-muted)' }}
            >
              <Mail size={13} />
            </span>
            <div className="grow">
              <div className="sm">{i.email}</div>
              <div className="xs muted">Pending invite</div>
            </div>
            <span className="xs muted">{i.role.name}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
