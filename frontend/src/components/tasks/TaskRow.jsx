import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Check, MoreHorizontal, ExternalLink, CircleCheck, RotateCcw } from 'lucide-react';
import { api, errorMessage } from '../../api/client';
import { projectTaskKeys, useApiMutation } from '../../api/hooks';
import { ConfirmDialog, Menu, ProjectMark } from '../ui';
import { PriorityFlag, StatusBadge, StatusIcon, displayState } from '../../lib/status';
import { fmtShort } from '../../lib/format';
import { useToast } from '../../context/ToastContext';

// Baris tugas pada Home dan My tasks (Figma): checkbox selesai, judul, proyek, status, tanggal, prioritas.
export default function TaskRow({ task, showMilestone = false, showMenu = false }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [rejected, setRejected] = useState(null);
  const done = task.status === 'DONE';
  const state = displayState(task);
  const open = () => navigate(`/projects/${task.projectId}/tasks?task=${task.id}`);

  const toggle = useApiMutation((status) => api.patch(`/tasks/${task.id}`, { status }), {
    invalidate: projectTaskKeys(task.projectId),
    onSuccess: (_d, status) => toast(status === 'DONE' ? 'Tugas ditandai selesai' : 'Tugas dibuka kembali'),
  });
  const setDone = (value) => toggle.mutate(value ? 'DONE' : 'TODO', { onError: (e) => setRejected(errorMessage(e)) });

  return (
    <div className="list-row clickable task-row" onClick={open}>
      <button
        type="button"
        className={`task-check ${done ? 'checked' : ''}`}
        aria-label={done ? `Buka kembali ${task.title}` : `Tandai ${task.title} selesai`}
        aria-pressed={done}
        disabled={toggle.isPending}
        onClick={(e) => {
          e.stopPropagation();
          setDone(!done);
        }}
      >
        {done && <Check size={12} strokeWidth={3} />}
      </button>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className={`row ${showMilestone ? '' : 'task-row-inline'}`} style={{ gap: showMilestone ? 0 : 10 }}>
          <span className={`sm truncate ${done ? 'task-done-title' : ''}`} style={{ fontWeight: 500 }}>
            {task.title}
          </span>
          {!showMilestone && (
            <span className="xs muted row truncate" style={{ gap: 5 }}>
              <ProjectMark project={task.project} size={14} />
              {task.project.name}
            </span>
          )}
        </div>
        {showMilestone && (
          <div className="xs muted row" style={{ gap: 6, marginTop: 3 }}>
            <ProjectMark project={task.project} size={14} />
            {task.project.name}
            {task.milestone && (
              <>
                <span className="faint">·</span>
                <span className="tag-dot" />
                {task.milestone.name}
              </>
            )}
          </div>
        )}
      </div>
      <div className="row task-row-meta" style={{ gap: 12 }}>
        <span className="task-row-col" style={{ width: 120 }}>
          <StatusBadge status={state === 'OVERDUE' ? task.status : state} plain />
        </span>
        <span
          className={`mono row task-row-col ${task.isOverdue ? 'st-OVERDUE' : 'muted'}`}
          style={{ width: 76, gap: 5 }}
        >
          {task.isOverdue ? <StatusIcon status="OVERDUE" size={13} /> : <Calendar size={13} />}
          {task.dueDate ? fmtShort(task.dueDate) : '—'}
        </span>
        <span className="task-row-col" style={{ width: 84 }}>
          <PriorityFlag priority={task.priority} />
        </span>
      </div>
      {showMenu && (
        <span onClick={(e) => e.stopPropagation()}>
          <Menu
            trigger={({ toggle: t }) => (
              <button className="icon-btn" onClick={t} aria-label={`Menu ${task.title}`}>
                <MoreHorizontal size={16} />
              </button>
            )}
          >
            <button className="menu-item" onClick={open}>
              <ExternalLink size={14} />
              Open task
            </button>
            <button className="menu-item" onClick={() => setDone(!done)}>
              {done ? <RotateCcw size={14} /> : <CircleCheck size={14} />}
              {done ? 'Mark as not done' : 'Mark as done'}
            </button>
          </Menu>
        </span>
      )}
      {rejected && (
        <span onClick={(e) => e.stopPropagation()}>
          <ConfirmDialog title="Perubahan ditolak" message={rejected} onClose={() => setRejected(null)} />
        </span>
      )}
    </div>
  );
}
