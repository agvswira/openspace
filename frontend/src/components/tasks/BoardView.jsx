import { useState } from 'react';
import { Plus, Calendar, Paperclip, MessageCircle, Lock } from 'lucide-react';
import { AvatarStack } from '../ui';
import { MoreButton, useMenuBinder } from '../ui/ContextMenu';
import { STATUS, STATUS_ORDER, PriorityFlag, StatusIcon } from '../../lib/status';
import { fmtShort } from '../../lib/format';
import QuickAdd from './QuickAdd';

// Kartu tugas. Klik = buka detail, klik kanan / tekan lama / "..." = menu aksi,
// Enter = buka, Delete = hapus (lewat item menu yang sama sehingga izin tetap dicek).
export function TaskCard({ task, onOpen, menuFor, draggable, onDragStart, onDragEnd, dragging }) {
  const overdue = task.isOverdue;
  const bind = useMenuBinder();
  const menu = bind(menuFor && (() => menuFor(task)));
  return (
    <article
      className={`task-card ${dragging ? 'dragging' : ''}`}
      onClick={() => onOpen(task.id)}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      tabIndex={0}
      aria-label={task.title}
      {...menu}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter') onOpen(task.id);
        if (e.key === 'Delete' && menuFor) {
          const del = menuFor(task).find((i) => i.label === 'Delete task');
          if (del && !del.disabled) del.onSelect();
        }
        menu.onKeyDown?.(e);
      }}
    >
      <div className="row-between">
        <span className={`mono row ${overdue ? 'st-OVERDUE' : 'muted'}`} style={{ gap: 5 }}>
          {overdue ? <StatusIcon status="OVERDUE" size={13} /> : <Calendar size={13} />}
          {task.dueDate ? fmtShort(task.dueDate) : 'No date'}
          {overdue && ' · Overdue'}
        </span>
        {menuFor && (
          <MoreButton
            className="icon-btn card-more"
            size={15}
            label={`Menu ${task.title}`}
            getItems={() => menuFor(task)}
          />
        )}
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
export default function BoardView({ tasks, onOpen, onCreate, onMove, canCreate, menuFor, onQuickAdd }) {
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null);
  const bind = useMenuBinder();

  return (
    <div className="board">
      {STATUS_ORDER.map((status) => {
        const items = tasks.filter((t) => t.status === status);
        // Klik kanan di area kosong kolom: buat tugas baru di kolom ini.
        const colMenu = bind(
          canCreate &&
            (() => [
              { label: `New task in ${STATUS[status].label}…`, icon: Plus, onSelect: () => onCreate(status) },
            ]),
        );
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
              {...colMenu}
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
                  menuFor={menuFor}
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
              {onQuickAdd && <QuickAdd onSubmit={(title) => onQuickAdd(status, title)} />}
            </div>
          </section>
        );
      })}
    </div>
  );
}
