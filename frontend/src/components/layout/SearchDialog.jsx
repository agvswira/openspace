import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Flag, FileText, X } from 'lucide-react';
import { api } from '../../api/client';
import { StatusIcon, displayState } from '../../lib/status';
import { ProjectMark, useModalDialog } from '../ui';

// FR-16: pencarian tugas, milestone, dan halaman (Ctrl+K).
export default function SearchDialog({ onClose }) {
  const [q, setQ] = useState('');
  // Hasil disimpan bersama kata kuncinya; respons lama yang datang terlambat otomatis diabaikan.
  const [found, setFound] = useState({ q: '', data: null });
  const navigate = useNavigate();
  const { dialogRef, requestClose } = useModalDialog(onClose);

  useEffect(() => {
    if (q.trim().length < 2) return undefined;
    const id = setTimeout(() => api.get('/search', { params: { q } }).then((r) => setFound({ q, data: r.data })), 200);
    return () => clearTimeout(id);
  }, [q]);
  const res = q.trim().length >= 2 && found.q === q ? found.data : null;

  const go = (to) => {
    navigate(to);
    requestClose();
  };
  const pages = [
    { label: 'Home', to: '/' },
    { label: 'My tasks', to: '/my-tasks' },
    { label: 'Workspace settings', to: '/settings' },
  ].filter((p) => q && p.label.toLowerCase().includes(q.toLowerCase()));
  const empty = res && !res.tasks.length && !res.milestones.length && !res.projects.length && !pages.length;

  return (
    <dialog ref={dialogRef} className="modal-dialog search-dialog" aria-label="Pencarian" {...{ closedby: 'any' }}>
      <search>
        <div className="input-icon row" style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
          <Search size={16} style={{ left: 24 }} aria-hidden="true" />
          <input
            autoFocus
            type="search"
            name="search"
            spellCheck={false}
            enterKeyHint="search"
            aria-label="Cari tugas, milestone, dan halaman"
            className="input grow"
            style={{ border: 'none', boxShadow: 'none' }}
            placeholder="Search tasks, milestones and pages…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="button" className="icon-btn" onClick={requestClose} aria-label="Tutup pencarian">
            <X size={16} />
          </button>
        </div>
      </search>
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
            type="button"
            key={t.id}
            className="menu-item"
            style={{ minBlockSize: 40 }}
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
          <button
            type="button"
            key={m.id}
            className="menu-item"
            onClick={() => go(`/projects/${m.project.id}/milestones/${m.id}`)}
          >
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
          <button type="button" key={p.id} className="menu-item" onClick={() => go(`/projects/${p.id}/overview`)}>
            <ProjectMark project={p} size={16} />
            {p.name}
          </button>
        ))}
        {pages.map((p) => (
          <button type="button" key={p.to} className="menu-item" onClick={() => go(p.to)}>
            <FileText size={14} className="faint" />
            {p.label}
          </button>
        ))}
      </div>
    </dialog>
  );
}
