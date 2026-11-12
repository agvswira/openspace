import { useState } from 'react';
import { Plus, MoreHorizontal, Calendar, Paperclip, MessageCircle, Lock } from 'lucide-react';
import { AvatarStack } from '../ui';
import { STATUS, STATUS_ORDER, PriorityFlag, StatusIcon } from '../../lib/status';
import { fmtShort } from '../../lib/format';

export function TaskCard({ task, onOpen, draggable, onDragStart, onDragEnd, dragging }) {
  const overdue = task.isOverdue;
  return (
    <article
      className={`task-card ${dragging ? 'dragging' : ''}`}
      onClick={() => onOpen(task.id)}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(task.id)}
      aria-label={task.title}
    >
      <div className="row-between">
        <span className={`mono row ${overdue ? 'st-OVERDUE' : 'muted'}`} style={{ gap: 5 }}>
          {overdue ? <StatusIcon status="OVERDUE" size={13} /> : <Calendar size={13} />}
          {task.dueDate ? fmtShort(task.dueDate) : 'No date'}
          {overdue && ' · Overdue'}
        </span>
        <MoreHorizontal size={15} className="faint" />
      </div>
      <div>
        <div className="task-card-title">{task.title}</div>
        {task.description && (
          <div className="task-card-desc" style={{ marginTop: 4 }}>
            {task.description}
          </div>
        )}
      </div>
      {task.milestone && (
        <span className="tag">
          <span className="tag-dot" />
          {task.milestone.name}
        </span>
      )}
      {task.isBlocked && task.status !== 'DONE' && (
        <span className="tag st-BLOCKED">
          <Lock size={12} />
          Waiting for {task.waitingFor[0]?.title}
          {task.waitingFor.length > 1 ? ` +${task.waitingFor.length - 1}` : ''}
        </span>
      )}
      <div className="task-card-foot">
        <AvatarStack users={task.assignees} size={22} />
        <span className="grow" />
        <PriorityFlag priority={task.priority} />
        <span className="meta-ic">
          <Paperclip size={12} />
          {task.linkCount}
        </span>
        <span className="meta-ic">
          <MessageCircle size={12} />
          {task.commentCount}
        </span>
      </div>
    </article>
  );
}

// Board: tugas per status. Kartu dapat diseret antar kolom untuk mengubah status.
export default function BoardView({ tasks, onOpen, onCreate, onMove, canCreate }) {
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null);

  return (
    <div className="board">
      {STATUS_ORDER.map((status) => {
        const items = tasks.filter((t) => t.status === status);
        return (
          <section key={status} aria-label={STATUS[status].label}>
            <div className={`col-head bg-${status}`}>
              <StatusIcon status={status} />
              {STATUS[status].label}
              <span className="n">{items.length}</span>
              {canCreate && (
                <button
                  className="icon-btn"
                  aria-label={`Tambah tugas ${STATUS[status].label}`}
                  onClick={() => onCreate(status)}
                >
                  <Plus size={15} />
                </button>
              )}
            </div>
            <div
              className={`col-body ${over === status ? 'drop' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(status);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={() => {
                const t = tasks.find((x) => x.id === dragId);
                if (t && t.status !== status) onMove(t, status);
                setOver(null);
                setDragId(null);
              }}
            >
              {items.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  onOpen={onOpen}
                  draggable
                  dragging={dragId === t.id}
                  onDragStart={() => setDragId(t.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setOver(null);
                  }}
                />
              ))}
              {!items.length && (
                <p className="xs faint" style={{ textAlign: 'center', padding: 20 }}>
                  No tasks
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
