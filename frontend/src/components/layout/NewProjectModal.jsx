import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../../api/client';
import { keys, useApiMutation } from '../../api/hooks';
import { Field, FormError, Modal, PROJECT_ICONS, ProjectMark } from '../ui';
import { fromInputDate } from '../../lib/format';
import { useToast } from '../../context/ToastContext';

export const PROJECT_COLORS = ['#2563EB', '#EA580C', '#7C3AED', '#16A34A', '#DB2777', '#0891B2'];

export default function NewProjectModal({ onClose }) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    color: PROJECT_COLORS[0],
    icon: 'asterisk',
    dueDate: '',
  });
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();
  const toast = useToast();
  const create = useApiMutation((body) => api.post('/projects', body).then((r) => r.data), {
    invalidate: [keys.projects],
    onSuccess: (p) => {
      toast('Proyek dibuat');
      onClose();
      navigate(`/projects/${p.id}/overview?onboarding=1`);
    },
  });

  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    if (form.name.trim().length < 2) errs.name = 'Nama proyek minimal 2 karakter.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    create.mutate({ ...form, description: form.description || null, dueDate: fromInputDate(form.dueDate) });
  };

  return (
    <Modal
      title="New project"
      subtitle="Projects group the tasks, meetings and milestones of one team effort."
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" form="new-project" disabled={create.isPending}>
            Create project
          </button>
        </>
      }
    >
      <form id="new-project" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Project name" error={errors.name} htmlFor="pname">
          <input
            id="pname"
            autoFocus
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Penyelenggaraan kegiatan"
          />
        </Field>
        <Field label="Description" htmlFor="pdesc">
          <textarea
            id="pdesc"
            className="textarea"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What is this project about?"
          />
        </Field>
        <Field label="Icon">
          <div className="row">
            {Object.keys(PROJECT_ICONS).map((key) => (
              <button
                type="button"
                key={key}
                onClick={() => setForm({ ...form, icon: key })}
                aria-label={`Ikon ${key}`}
                aria-pressed={form.icon === key}
                style={{
                  padding: 2,
                  border: 'none',
                  background: 'none',
                  borderRadius: 9,
                  cursor: 'pointer',
                  boxShadow: form.icon === key ? `0 0 0 2px ${form.color}` : 'none',
                }}
              >
                <ProjectMark project={{ color: form.color, icon: key }} size={28} />
              </button>
            ))}
          </div>
        </Field>
        <div className="form-grid">
          <Field label="Color">
            <div className="row">
              {PROJECT_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  aria-label={`Warna ${c}`}
                  aria-pressed={form.color === c}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: c,
                    border: form.color === c ? '3px solid #fff' : 'none',
                    boxShadow: form.color === c ? `0 0 0 2px ${c}` : 'none',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </Field>
          <Field label="Due date (optional)" htmlFor="pdue">
            <input
              id="pdue"
              type="date"
              className="input"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </Field>
        </div>
        <FormError message={create.error && errorMessage(create.error)} />
      </form>
    </Modal>
  );
}
