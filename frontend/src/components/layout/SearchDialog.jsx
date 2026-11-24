import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Flag, FileText } from 'lucide-react';
import { api } from '../../api/client';
import { StatusIcon, displayState } from '../../lib/status';
import { ProjectMark } from '../ui';

// FR-16: pencarian tugas, milestone, dan halaman (Ctrl+K).
export default function SearchDialog({ onClose }) {
  const [q, setQ] = useState('');
  // Hasil disimpan bersama kata kuncinya; respons lama yang datang terlambat otomatis diabaikan.
  const [found, setFound] = useState({ q: '', data: null });
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (q.trim().length < 2) return undefined;
    const id = setTimeout(() => api.get('/search', { params: { q } }).then((r) => setFound({ q, data: r.data })), 200);
    return () => clearTimeout(id);
  }, [q]);
  const res = q.trim().length >= 2 && found.q === q ? found.data : null;

  const go = (to) => {
    navigate(to);
    onClose();
  };
  const pages = [
    { label: 'Home', to: '/' },
    { label: 'My tasks', to: '/my-tasks' },
    { label: 'Workspace settings', to: '/settings' },
  ].filter((p) => q && p.label.toLowerCase().includes(q.toLowerCase()));
  const empty = res && !res.tasks.length && !res.milestones.length && !res.projects.length && !pages.length;

  return (
    <div
      className="overlay"
      style={{ alignItems: 'start', paddingTop: '12vh' }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal" role="dialog" aria-label="Pencarian">
        <div className="input-icon" style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
          <Search size={16} style={{ left: 24 }} />
          <input
            autoFocus
            className="input"
            style={{ border: 'none', boxShadow: 'none' }}
            placeholder="Search tasks, milestones and pages…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div style={{ padding: 6, maxHeight: 420, overflow: 'auto' }}>
          {!q && (
            <p className="sm muted" style={{ padding: 14 }}>
              Ketik minimal 2 huruf untuk mencari.
            </p>
          )}
          {empty && (
            <p className="sm muted" style={{ padding: 14 }}>
              Tidak ada hasil untuk “{q}”.
            </p>
          )}
          {res?.tasks.length > 0 && (
            <div className="section-title" style={{ padding: '8px 10px 2px' }}>
              Tasks
            </div>
          )}
          {res?.tasks.map((t) => (
            <button
              key={t.id}
              className="menu-item"
              style={{ height: 40 }}
              onClick={() => go(`/projects/${t.projectId}/tasks?task=${t.id}`)}
            >
              <StatusIcon status={displayState(t)} />
              <span className="grow truncate">{t.title}</span>
              <span className="xs muted truncate">{t.project?.name}</span>
            </button>
          ))}
          {res?.milestones.length > 0 && (
            <div className="section-title" style={{ padding: '8px 10px 2px' }}>
              Milestones
            </div>
          )}
          {res?.milestones.map((m) => (
            <button key={m.id} className="menu-item" onClick={() => go(`/projects/${m.project.id}/milestones/${m.id}`)}>
              <Flag size={14} className="faint" />
              <span className="grow truncate">{m.name}</span>
              <span className="xs muted">{m.project.name}</span>
            </button>
          ))}
          {(res?.projects.length > 0 || pages.length > 0) && (
            <div className="section-title" style={{ padding: '8px 10px 2px' }}>
              Pages
            </div>
          )}
          {res?.projects.map((p) => (
            <button key={p.id} className="menu-item" onClick={() => go(`/projects/${p.id}/overview`)}>
              <ProjectMark project={p} size={16} />
              {p.name}
            </button>
          ))}
          {pages.map((p) => (
            <button key={p.to} className="menu-item" onClick={() => go(p.to)}>
              <FileText size={14} className="faint" />
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
