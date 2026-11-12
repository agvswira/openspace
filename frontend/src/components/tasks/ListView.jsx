import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Calendar, Paperclip, MessageCircle, MoreHorizontal } from 'lucide-react';
import { AvatarStack } from '../ui';
import { STATUS, STATUS_ORDER, PriorityFlag, StatusBadge, StatusIcon, displayState } from '../../lib/status';
import { fmtLong } from '../../lib/format';

// List: tugas dikelompokkan per status dalam tabel berkolom sejajar.
export default function ListView({ tasks, onOpen, onCreate, canCreate }) {
  const [collapsed, setCollapsed] = useState({ DONE: true });
  const toggle = (status) => setCollapsed((c) => ({ ...c, [status]: !c[status] }));

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: '34%' }}>Task</th>
            <th>Status</th>
            <th>Assignees</th>
            <th>Due date</th>
            <th>Priority</th>
            <th>Milestone</th>
            <th>Activity</th>
            <th style={{ width: 44 }} aria-label="Aksi" />
          </tr>
        </thead>
        {STATUS_ORDER.map((status) => {
          const items = tasks.filter((t) => t.status === status);
          const closed = collapsed[status];
          return (
            <tbody key={status}>
              <tr>
                <td colSpan={8} className={`bg-${status}`} style={{ padding: '6px 12px' }}>
                  <div className="row">
                    <button
                      className="icon-btn"
                      style={{ width: 22, height: 22 }}
                      onClick={() => toggle(status)}
                      aria-expanded={!closed}
                      aria-label={`${closed ? 'Buka' : 'Tutup'} grup ${STATUS[status].label}`}
                    >
                      {closed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <StatusIcon status={status} />
                    <strong className="sm">{STATUS[status].label}</strong>
                    <span className="xs muted">{items.length}</span>
                    {closed && (
                      <span className="xs muted">
                        · Collapsed · click to show {status === 'DONE' ? 'completed tasks' : 'tasks'}
                      </span>
                    )}
                    <span className="grow" />
                    {canCreate && (
                      <button className="link xs" onClick={() => onCreate(status)}>
                        <Plus size={12} /> Add task
                      </button>
                    )}
                  </div>
                </td>
              </tr>
              {!closed &&
                items.map((t) => (
                  <tr key={t.id} className="clickable" onClick={() => onOpen(t.id)}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{t.title}</div>
                      {t.description && (
                        <div className="xs muted truncate" style={{ maxWidth: 360 }}>
                          {t.description}
                        </div>
                      )}
                    </td>
                    <td>
                      {/* Terlambat ditunjukkan lewat tanggal merah; kolom status tetap status asli (Figma) */}
                      <StatusBadge status={displayState(t) === 'OVERDUE' ? t.status : displayState(t)} plain />
                    </td>
                    <td>
                      <AvatarStack users={t.assignees} size={22} />
                    </td>
                    <td className={`mono ${t.isOverdue ? 'st-OVERDUE' : ''}`}>
                      <span className="row" style={{ gap: 5 }}>
                        {t.isOverdue ? <StatusIcon status="OVERDUE" size={12} /> : <Calendar size={12} />}
                        {t.dueDate ? fmtLong(t.dueDate) : '—'}
                      </span>
                    </td>
                    <td>
                      <PriorityFlag priority={t.priority} />
                    </td>
                    <td>
                      {t.milestone ? (
                        <span className="tag">
                          <span className="tag-dot" />
                          {t.milestone.name}
                        </span>
                      ) : (
                        <span className="xs faint">No milestone</span>
                      )}
                    </td>
                    <td className="xs muted">
                      <span className="row" style={{ gap: 10 }}>
                        <span className="meta-ic">
                          <Paperclip size={12} />
                          {t.linkCount}
                        </span>
                        <span className="meta-ic">
                          <MessageCircle size={12} />
                          {t.commentCount}
                        </span>
                      </span>
                    </td>
                    <td>
                      <button className="icon-btn" aria-label={`Buka ${t.title}`}>
                        <MoreHorizontal size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              {!closed && !items.length && (
                <tr>
                  <td colSpan={8} className="xs faint" style={{ textAlign: 'center' }}>
                    No tasks
                  </td>
                </tr>
              )}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
