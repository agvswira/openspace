import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Calendar,
  Paperclip,
  MessageCircle,
  Columns3,
  Trash2,
  EyeOff,
  X,
  CircleDot,
} from 'lucide-react';
import { AvatarStack, Menu } from '../ui';
import { MoreButton, useMenuBinder } from '../ui/ContextMenu';
import { STATUS, STATUS_ORDER, PriorityFlag, StatusBadge, StatusIcon, displayState } from '../../lib/status';
import { fmtLong } from '../../lib/format';
import QuickAdd from './QuickAdd';

// Kolom yang dapat disembunyikan/ditampilkan; pilihan disimpan di perangkat.
const COLUMNS = [
  { key: 'status', label: 'Status' },
  { key: 'assignees', label: 'Assignees' },
  { key: 'due', label: 'Due date' },
  { key: 'priority', label: 'Priority' },
  { key: 'milestone', label: 'Milestone' },
  { key: 'activity', label: 'Activity' },
];
const COLS_KEY = 'openspace-list-columns';

function readCols() {
  try {
    const v = JSON.parse(localStorage.getItem(COLS_KEY));
    if (Array.isArray(v)) return v;
  } catch {
    /* pakai bawaan */
  }
  return COLUMNS.map((c) => c.key);
}

// Judul yang dapat diubah langsung: klik dua kali, Enter simpan, Esc batal.
// Klik sekali pada judul tetap membuka detail, tetapi ditunda sebentar (250 ms) agar klik kedua
// sempat dikenali sebagai "ganti judul" tanpa panel detail ikut terbuka.
function InlineTitle({ task, onRename, canEdit, onOpen }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.title);
  const clickTimer = useRef(null);
  useEffect(() => () => clearTimeout(clickTimer.current), []);
  if (!editing)
    return (
      <button
        type="button"
        className="task-title-btn"
        style={{ fontWeight: 500 }}
        title={canEdit ? 'Double-click to rename' : undefined}
        onClick={(e) => {
          e.stopPropagation();
          if (!canEdit) {
            onOpen();
            return;
          }
          clearTimeout(clickTimer.current);
          if (e.detail >= 2) {
            setValue(task.title);
            setEditing(true);
          } else {
            clickTimer.current = setTimeout(onOpen, 250);
          }
        }}
      >
        {task.title}
      </button>
    );
  const save = async () => {
    setEditing(false);
    if (value.trim().length >= 2) await onRename(task, value);
  };
  return (
    <input
      className="input inline-title"
      autoFocus
      value={value}
      aria-label="Ubah judul tugas"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          if (e.nativeEvent.isComposing || e.keyCode === 229) return;
          save();
        }
        if (e.key === 'Escape') setEditing(false);
      }}
      onBlur={save}
    />
  );
}

// List: tugas dikelompokkan per status dalam tabel berkolom sejajar.
// Fitur: pilih banyak tugas (aksi massal), atur kolom, ubah judul langsung, tambah cepat.
export default function ListView({ tasks, onOpen, onCreate, canCreate, menuFor, onQuickAdd, bulk }) {
  const [collapsed, setCollapsed] = useState({ DONE: true });
  const [cols, setColsState] = useState(readCols);
  const [selected, setSelected] = useState([]);
  const bind = useMenuBinder();
  const toggle = (status) => setCollapsed((c) => ({ ...c, [status]: !c[status] }));
  const show = (k) => cols.includes(k);
  const setCols = (next) => {
    setColsState(next);
    try {
      localStorage.setItem(COLS_KEY, JSON.stringify(next));
    } catch {
      /* abaikan */
    }
  };
  const colSpan = 3 + cols.length;

  // Pilihan hanya untuk tugas yang terlihat: tidak terfilter/terhapus dan grupnya tidak ditutup,
  // sehingga aksi massal tidak pernah mengenai tugas yang tidak tampak.
  const shownTasks = tasks.filter((t) => !collapsed[t.status]);
  const selectedTasks = shownTasks.filter((t) => selected.includes(t.id));
  const isSel = (id) => selected.includes(id);
  const flip = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const flipGroup = (items) => {
    const ids = items.map((t) => t.id);
    const all = ids.every((id) => selected.includes(id));
    setSelected((s) => (all ? s.filter((id) => !ids.includes(id)) : [...new Set([...s, ...ids])]));
  };
  const clear = () => setSelected([]);

  return (
    <>
      <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 8 }}>
        <Menu
          width={200}
          trigger={({ toggle: t }) => (
            <button className="btn btn-sm" onClick={t}>
              <Columns3 size={14} />
              Columns · {cols.length}/{COLUMNS.length}
            </button>
          )}
        >
          <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="xs muted">Show columns</div>
            {COLUMNS.map((c) => (
              <label key={c.key} className="check">
                <input
                  type="checkbox"
                  checked={show(c.key)}
                  onChange={(e) =>
                    setCols(
                      e.target.checked
                        ? COLUMNS.map((x) => x.key).filter((k) => k === c.key || cols.includes(k))
                        : cols.filter((k) => k !== c.key),
                    )
                  }
                />
                {c.label}
              </label>
            ))}
            {cols.length < COLUMNS.length && (
              <button className="btn btn-sm" onClick={() => setCols(COLUMNS.map((c) => c.key))}>
                Show all
              </button>
            )}
          </div>
        </Menu>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-scroll" tabIndex={0} role="region" aria-labelledby="tasks-table-caption">
          <table className="table">
            <caption id="tasks-table-caption" className="sr-only">
              Daftar tugas proyek
            </caption>
            <thead>
              <tr>
                <th scope="col" style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    aria-label="Pilih semua tugas"
                    checked={shownTasks.length > 0 && selectedTasks.length === shownTasks.length}
                    ref={(el) =>
                      el && (el.indeterminate = selectedTasks.length > 0 && selectedTasks.length < shownTasks.length)
                    }
                    onChange={() =>
                      selectedTasks.length === shownTasks.length ? clear() : setSelected(shownTasks.map((t) => t.id))
                    }
                  />
                </th>
                <th scope="col" style={{ width: '34%' }}>
                  Task
                </th>
                {show('status') && <th scope="col">Status</th>}
                {show('assignees') && <th scope="col">Assignees</th>}
                {show('due') && <th scope="col">Due date</th>}
                {show('priority') && <th scope="col">Priority</th>}
                {show('milestone') && <th scope="col">Milestone</th>}
                {show('activity') && <th scope="col">Activity</th>}
                <th scope="col" style={{ width: 44 }} aria-label="Aksi" />
              </tr>
            </thead>
            {STATUS_ORDER.map((status) => {
              const items = tasks.filter((t) => t.status === status);
              const closed = collapsed[status];
              return (
                <tbody key={status}>
                  <tr>
                    <td colSpan={colSpan} className={`bg-${status}`} style={{ padding: '6px 12px' }}>
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
                        {!closed && items.length > 0 && (
                          <input
                            type="checkbox"
                            aria-label={`Pilih semua ${STATUS[status].label}`}
                            checked={items.every((t) => isSel(t.id))}
                            onChange={() => flipGroup(items)}
                          />
                        )}
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
                      <tr
                        key={t.id}
                        className={`clickable ${isSel(t.id) ? 'selected' : ''}`}
                        onClick={() => onOpen(t.id)}
                        {...bind(menuFor && (() => menuFor(t)))}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`Pilih ${t.title}`}
                            checked={isSel(t.id)}
                            onChange={() => flip(t.id)}
                          />
                        </td>
                        <td>
                          <InlineTitle
                            task={t}
                            onRename={bulk?.rename}
                            canEdit={!!bulk?.canEditAll}
                            onOpen={() => onOpen(t.id)}
                          />
                          {t.description && (
                            <div className="xs muted truncate" style={{ maxWidth: 360 }}>
                              {t.description}
                            </div>
                          )}
                        </td>
                        {show('status') && (
                          <td>
                            {/* Terlambat ditunjukkan lewat tanggal merah; kolom status tetap status asli (Figma) */}
                            <StatusBadge status={displayState(t) === 'OVERDUE' ? t.status : displayState(t)} plain />
                          </td>
                        )}
                        {show('assignees') && (
                          <td>
                            <AvatarStack users={t.assignees} size={22} />
                          </td>
                        )}
                        {show('due') && (
                          <td className={`mono ${t.isOverdue ? 'st-OVERDUE' : ''}`}>
                            <span className="row" style={{ gap: 5 }}>
                              {t.isOverdue ? <StatusIcon status="OVERDUE" size={12} /> : <Calendar size={12} />}
                              {t.dueDate ? fmtLong(t.dueDate) : '—'}
                            </span>
                          </td>
                        )}
                        {show('priority') && (
                          <td>
                            <PriorityFlag priority={t.priority} />
                          </td>
                        )}
                        {show('milestone') && (
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
                        )}
                        {show('activity') && (
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
                        )}
                        <td>{menuFor && <MoreButton label={`Menu ${t.title}`} getItems={() => menuFor(t)} />}</td>
                      </tr>
                    ))}
                  {!closed && !items.length && (
                    <tr>
                      <td colSpan={colSpan} className="xs faint" style={{ textAlign: 'center' }}>
                        No tasks
                      </td>
                    </tr>
                  )}
                  {!closed && onQuickAdd && (
                    <tr className="quick-row">
                      <td />
                      <td colSpan={colSpan - 1}>
                        <QuickAdd onSubmit={(title) => onQuickAdd(status, title)} />
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
          </table>
        </div>
      </div>

      {/* Bilah aksi massal muncul saat ada tugas terpilih */}
      {selectedTasks.length > 0 && bulk && (
        <div className="bulk-bar" role="toolbar" aria-label="Aksi massal">
          <strong className="sm">{selectedTasks.length} selected</strong>
          <span className="bulk-sep" />
          <Menu
            align="left"
            width={180}
            trigger={({ toggle: t }) => (
              <button className="btn btn-sm" onClick={t}>
                <CircleDot size={14} />
                Set status
              </button>
            )}
          >
            {STATUS_ORDER.map((s) => (
              <button key={s} className="menu-item" onClick={() => bulk.setStatusMany(selectedTasks, s).then(clear)}>
                <StatusIcon status={s} />
                {STATUS[s].label}
              </button>
            ))}
          </Menu>
          <button
            className="btn btn-sm"
            onClick={() => {
              bulk.hide(selectedTasks);
              clear();
            }}
          >
            <EyeOff size={14} />
            Hide
          </button>
          <button
            className="btn btn-sm btn-danger-soft"
            disabled={!bulk.canEditAll}
            title={bulk.canEditAll ? undefined : 'Role Anda tidak memiliki izin Edit all tasks.'}
            onClick={() => {
              bulk.deleteMany(selectedTasks);
              clear();
            }}
          >
            <Trash2 size={14} />
            Delete
          </button>
          <button className="icon-btn" onClick={clear} aria-label="Batalkan pilihan">
            <X size={15} />
          </button>
        </div>
      )}
    </>
  );
}
