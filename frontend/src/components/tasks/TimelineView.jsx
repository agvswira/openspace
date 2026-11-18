import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Diamond, Lock, Unlink, MousePointerClick } from 'lucide-react';
import { AvatarStack } from '../ui';
import { useContextMenu, useMenuBinder } from '../ui/ContextMenu';
import { STATUS, StatusIcon, displayState } from '../../lib/status';
import { MONTHS, addDays, diffDays, fmtDow, fmtShort, monthName, sameDay, startOfDay } from '../../lib/format';

const MIN_DAY_W = 56;
const ROW_H = 36;
const HEAD_ROW = 34; // baris milestone di atas daftar tugas
const SPAN = 14;
const DRAG_THRESHOLD = 4; // px; di bawah ini dianggap klik biasa

const COLORS = {
  TODO: { bg: 'var(--todo-bg)', border: 'var(--todo-border)' },
  IN_PROGRESS: { bg: 'var(--progress-bg)', border: 'var(--progress-border)' },
  DONE: { bg: 'var(--done-bg)', border: 'var(--done-border)' },
  OVERDUE: { bg: 'var(--overdue-bg)', border: 'var(--overdue-border)' },
  BLOCKED: { bg: 'var(--blocked-bg)', border: 'var(--blocked-border)' },
};

// "8 – 21 October 2026" bila satu bulan, "29 Oct – 11 Nov 2026" bila lintas bulan (format Figma).
function rangeLabel(a, b) {
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${b.getDate()} ${monthName(b)} ${b.getFullYear()}`;
  return `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
}

// Tanggal mulai/akhir efektif sebuah tugas; tugas tanpa salah satunya dianggap satu hari.
const spanOf = (t) => ({ s: startOfDay(t.startDate || t.dueDate), e: startOfDay(t.dueDate || t.startDate) });

/**
 * Timeline: setiap tugas digambar sebagai bar dari tanggal mulai sampai deadline, hubungan
 * prasyarat sebagai garis putus-putus (Gambar 2.14). Interaksi langsung:
 *  - seret bar            → geser jadwal (mulai & deadline bergeser bersama)
 *  - seret tepi kiri/kanan → ubah tanggal mulai / deadline
 *  - seret titik di ujung kanan bar ke bar lain → bar tujuan menunggu bar asal (prasyarat)
 *  - klik garis prasyarat  → hapus hubungan
 * Semua perubahan tetap divalidasi backend (izin role, siklus, status tugas).
 */
export default function TimelineView({ tasks, milestones = [], onOpen, menuFor, bulk }) {
  const [start, setStart] = useState(() => addDays(startOfDay(), -6));
  const days = Array.from({ length: SPAN }, (_, i) => addDays(start, i));
  const today = startOfDay();
  const bind = useMenuBinder();
  const openMenu = useContextMenu();
  const canEdit = !!bulk?.canEditAll;
  const canLink = !!bulk?.canLink;

  // Lebar kolom hari mengikuti lebar panel agar grid selalu terisi penuh tanpa sisa kosong.
  const boxRef = useRef(null);
  const bodyRef = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const boxW = box.w;
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    // clientWidth/clientHeight tidak termasuk scrollbar, sehingga ukuran grid tidak memicu
    // pengukuran ulang yang terus membesar. Header hari dikurangkan dari tinggi yang tersedia.
    const ro = new ResizeObserver(() => {
      const headH = el.querySelector('.tl-head')?.offsetHeight ?? 0;
      const next = { w: el.clientWidth, h: el.clientHeight - headH };
      setBox((prev) => (Math.abs(prev.w - next.w) < 1 && Math.abs(prev.h - next.h) < 1 ? prev : next));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const DAY_W = Math.max(MIN_DAY_W, boxW / SPAN || 64);

  // ---- Status seret ----
  // drag = { mode: 'move'|'start'|'end'|'link', task, x0, y0, dx, px, py, moved, targetId }
  const [drag, setDrag] = useState(null);
  // Jadwal sementara setelah dilepas, ditampilkan sampai data server diperbarui.
  const [pendingDates, setPendingDates] = useState({});

  const rows = useMemo(
    () =>
      tasks
        .filter((t) => t.startDate || t.dueDate)
        .sort((a, b) => new Date(a.startDate || a.dueDate) - new Date(b.startDate || b.dueDate)),
    [tasks],
  );

  // Rentang efektif (memperhitungkan seretan yang sedang berlangsung).
  const deltaDays = drag && drag.mode !== 'link' ? Math.round(drag.dx / DAY_W) : 0;
  const effSpan = (t) => {
    if (pendingDates[t.id]) return pendingDates[t.id];
    const sp = spanOf(t);
    if (!drag || drag.task.id !== t.id || !deltaDays) return sp;
    if (drag.mode === 'move') return { s: addDays(sp.s, deltaDays), e: addDays(sp.e, deltaDays) };
    if (drag.mode === 'start') return { s: addDays(sp.s, Math.min(deltaDays, diffDays(sp.e, sp.s))), e: sp.e };
    if (drag.mode === 'end') return { s: sp.s, e: addDays(sp.e, Math.max(deltaDays, -diffDays(sp.e, sp.s))) };
    return sp;
  };

  // Hanya tugas yang beririsan dengan rentang 14 hari yang digambar; bar dipotong di tepi rentang.
  const visible = rows.filter((t) => {
    const { s, e } = spanOf(t);
    const sp = effSpan(t);
    const inRange = (a, b) => diffDays(b, start) >= 0 && diffDays(a, start) < SPAN;
    return inRange(s, e) || inRange(sp.s, sp.e);
  });
  const layout = new Map();
  visible.forEach((t, i) => {
    const sp = effSpan(t);
    const s = Math.max(0, diffDays(sp.s, start));
    const e = Math.min(SPAN - 1, diffDays(sp.e, start));
    layout.set(t.id, {
      x: s * DAY_W + 4,
      w: Math.max((e - s + 1) * DAY_W - 8, 0),
      y: HEAD_ROW + i * ROW_H + 5,
      clipL: diffDays(sp.s, start) < 0,
      clipR: diffDays(sp.e, start) > SPAN - 1,
    });
  });

  // Garis prasyarat: dari ujung kanan bar prasyarat ke awal bar tugas yang menunggu.
  // Hubungan yang masih menghambat digambar tegas; yang sudah selesai digambar samar.
  const links = [];
  visible.forEach((t) => {
    t.prerequisites.forEach((p) => {
      const a = layout.get(p.id);
      const b = layout.get(t.id);
      if (a && b)
        links.push({
          key: `${p.id}-${t.id}`,
          task: t,
          pre: p,
          x1: a.x + a.w,
          y1: a.y + 13,
          x2: b.x,
          y2: b.y + 13,
          done: p.status === 'DONE',
        });
    });
  });

  // ---- Penanganan pointer ----
  const begin = (e, task, mode) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (mode !== 'link' && !canEdit) return;
    e.stopPropagation();
    const rect = bodyRef.current.getBoundingClientRect();
    setDrag({
      mode,
      task,
      x0: e.clientX,
      y0: e.clientY,
      dx: 0,
      px: e.clientX - rect.left,
      py: e.clientY - rect.top,
      moved: false,
      targetId: null,
    });
  };

  useEffect(() => {
    if (!drag) return undefined;
    const onMove = (e) => {
      const rect = bodyRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = e.clientX - drag.x0;
      const moved = drag.moved || Math.hypot(dx, e.clientY - drag.y0) > DRAG_THRESHOLD;
      let targetId = null;
      if (drag.mode === 'link') {
        const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-task-id]');
        targetId = el && el.dataset.taskId !== drag.task.id ? el.dataset.taskId : null;
      }
      setDrag((d) => d && { ...d, dx, moved, px: e.clientX - rect.left, py: e.clientY - rect.top, targetId });
    };
    const onUp = () => {
      const d = drag;
      setDrag(null);
      if (!d.moved) {
        // Tanpa gerakan berarti klik: buka detail tugas.
        if (d.mode === 'move') onOpen(d.task.id);
        return;
      }
      if (d.mode === 'link') {
        const target = tasks.find((t) => t.id === d.targetId);
        if (target) bulk.link(d.task, target);
        return;
      }
      const n = Math.round(d.dx / DAY_W);
      if (!n) return;
      const sp = spanOf(d.task);
      let next = sp;
      if (d.mode === 'move') next = { s: addDays(sp.s, n), e: addDays(sp.e, n) };
      if (d.mode === 'start') next = { s: addDays(sp.s, Math.min(n, diffDays(sp.e, sp.s))), e: sp.e };
      if (d.mode === 'end') next = { s: sp.s, e: addDays(sp.e, Math.max(n, -diffDays(sp.e, sp.s))) };
      const body = {};
      if (d.task.startDate || d.mode === 'start') body.startDate = next.s.toISOString();
      if (d.task.dueDate || d.mode === 'end') body.dueDate = next.e.toISOString();
      setPendingDates((p) => ({ ...p, [d.task.id]: next }));
      bulk.setDates(d.task, body).finally(() =>
        setPendingDates((p) => {
          const rest = { ...p };
          delete rest[d.task.id];
          return rest;
        }),
      );
    };
    const onKey = (e) => e.key === 'Escape' && setDrag(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [drag, DAY_W, tasks, bulk, onOpen]);

  const width = SPAN * DAY_W;
  // Tinggi grid minimal setinggi panel (dikurangi header hari) agar tidak ada ruang kosong di bawahnya.
  const contentH = HEAD_ROW + Math.max(visible.length, 1) * ROW_H + 12;
  const height = Math.max(contentH, Math.floor(box.h));

  const linkSource = drag?.mode === 'link' && drag.moved ? layout.get(drag.task.id) : null;
  const dragging = drag?.moved ? drag : null;
  const tip =
    dragging && dragging.mode !== 'link'
      ? (() => {
          const sp = effSpan(dragging.task);
          return `${fmtShort(sp.s)} – ${fmtShort(sp.e)}${deltaDays ? ` (${deltaDays > 0 ? '+' : ''}${deltaDays}d)` : ''}`;
        })()
      : dragging?.mode === 'link'
        ? dragging.targetId
          ? `"${tasks.find((t) => t.id === dragging.targetId)?.title}" will wait for "${dragging.task.title}"`
          : 'Drop on a task that should wait for this one'
        : null;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="row-between tl-toolbar" style={{ marginBottom: 12 }}>
        <div className="row">
          <button className="btn btn-sm" onClick={() => setStart((s) => addDays(s, -7))} aria-label="Minggu sebelumnya">
            <ChevronLeft size={14} />
          </button>
          <button className="btn btn-sm" onClick={() => setStart((s) => addDays(s, 7))} aria-label="Minggu berikutnya">
            <ChevronRight size={14} />
          </button>
          <strong style={{ fontSize: 16, marginLeft: 6 }}>{rangeLabel(days[0], days[SPAN - 1])}</strong>
          <button className="btn btn-sm" onClick={() => setStart(addDays(startOfDay(), -6))}>
            Today
          </button>
        </div>
        <div className="tl-legend">
          {['TODO', 'IN_PROGRESS', 'DONE', 'OVERDUE', 'BLOCKED'].map((s) => (
            <span key={s} className={`row st-${s}`} style={{ gap: 4 }}>
              <StatusIcon status={s} size={12} />
              {STATUS[s].label}
            </span>
          ))}
        </div>
      </div>

      <div className={`timeline ${dragging ? 'is-dragging' : ''}`} ref={boxRef}>
        <div className="tl-head" style={{ gridTemplateColumns: `repeat(${SPAN}, ${DAY_W}px)`, width }}>
          {days.map((d) => (
            <div key={d.toISOString()} className={`tl-day ${sameDay(d, today) ? 'today' : ''}`}>
              {fmtDow(d)}
              <b>{d.getDate()}</b>
            </div>
          ))}
        </div>
        <div className="tl-body" ref={bodyRef} style={{ width, height, overflow: 'hidden' }}>
          {/* kolom hari + penanda hari ini */}
          {days.map((d, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: i * DAY_W,
                top: 0,
                bottom: 0,
                width: DAY_W,
                borderLeft: '1px solid var(--border)',
                background: sameDay(d, today)
                  ? 'var(--tl-today)'
                  : [0, 6].includes(d.getDay())
                    ? 'var(--bg-subtle)'
                    : undefined,
              }}
            />
          ))}
          {days.some((d) => sameDay(d, today)) && (
            <div
              style={{
                position: 'absolute',
                left: diffDays(today, start) * DAY_W + DAY_W / 2,
                top: 0,
                bottom: 0,
                width: 2,
                background: 'var(--primary)',
                opacity: 0.6,
              }}
            />
          )}

          {milestones
            .filter((m) => m.dueDate)
            .map((m) => {
              const i = diffDays(m.dueDate, start);
              if (i < 0 || i >= SPAN) return null;
              // Milestone di 3 kolom terakhir diratakan kanan agar tidak keluar dari grid.
              const anchor = i >= SPAN - 3 ? { right: (SPAN - i - 1) * DAY_W + 6 } : { left: i * DAY_W + 6 };
              return (
                <span
                  key={m.id}
                  className="badge"
                  style={{
                    position: 'absolute',
                    top: 6,
                    ...anchor,
                    background: 'var(--purple-bg)',
                    color: 'var(--purple)',
                    zIndex: 1,
                  }}
                >
                  <Diamond size={11} fill="currentColor" />
                  {m.name}
                  <span className="mono">
                    {m.progress.done}/{m.progress.total}
                  </span>
                </span>
              );
            })}

          <svg width={width} height={height} className="tl-links" aria-hidden>
            {links.map((l) => {
              // Jika bar lanjutan dimulai setelah bar prasyarat: siku sederhana.
              // Jika tumpang tindih: turun ke celah antarbaris dulu, lalu masuk dari kiri.
              const d =
                l.x2 - l.x1 >= 16
                  ? `M${l.x1} ${l.y1} H${(l.x1 + l.x2) / 2} V${l.y2} H${l.x2}`
                  : `M${l.x1} ${l.y1} h8 V${l.y2 - 18} H${l.x2 - 10} V${l.y2} H${l.x2}`;
              return (
                <g key={l.key}>
                  <path
                    d={d}
                    fill="none"
                    stroke={l.done ? 'var(--text-faint)' : 'var(--dep-line)'}
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    opacity={l.done ? 0.6 : 1}
                    markerEnd={l.done ? 'url(#arrow-done)' : 'url(#arrow)'}
                  />
                  {/* Area klik lebar di atas garis tipis untuk menghapus hubungan */}
                  {canLink && (
                    <path
                      d={d}
                      className="tl-link-hit"
                      onClick={(e) =>
                        openMenu(e.clientX, e.clientY, [
                          { heading: `${l.task.title} waits for ${l.pre.title}` },
                          {
                            label: 'Remove dependency',
                            icon: Unlink,
                            danger: true,
                            onSelect: () => bulk.unlink(l.task, l.pre),
                          },
                        ])
                      }
                    >
                      <title>{`${l.task.title} waits for ${l.pre.title} · click to remove`}</title>
                    </path>
                  )}
                </g>
              );
            })}
            {linkSource && (
              <path
                d={`M${linkSource.x + linkSource.w} ${linkSource.y + 13} L${drag.px} ${drag.py}`}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2"
                strokeDasharray="5 3"
                markerEnd="url(#arrow-new)"
              />
            )}
            <defs>
              <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0 0 L8 4 L0 8 z" fill="var(--dep-line)" />
              </marker>
              <marker id="arrow-done" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0 0 L8 4 L0 8 z" fill="var(--text-faint)" />
              </marker>
              <marker id="arrow-new" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0 0 L8 4 L0 8 z" fill="var(--primary)" />
              </marker>
            </defs>
          </svg>

          {visible.map((t) => {
            const pos = layout.get(t.id);
            if (!pos.w) return null;
            const state = displayState(t);
            const c = COLORS[state];
            const active = drag?.task.id === t.id && drag.moved;
            const isTarget = drag?.mode === 'link' && drag.targetId === t.id;
            const menu = bind(menuFor && (() => menuFor(t)));
            return (
              <div
                key={t.id}
                data-task-id={t.id}
                role="button"
                tabIndex={0}
                className={`tl-bar st-${state} ${active ? 'active' : ''} ${isTarget ? 'link-target' : ''} ${canEdit ? 'editable' : ''} ${canLink ? 'linkable' : ''}`}
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: Math.max(pos.w, 40),
                  background: c.bg,
                  borderColor: c.border,
                }}
                onPointerDown={(e) => (canEdit ? begin(e, t, 'move') : undefined)}
                onClick={() => !canEdit && onOpen(t.id)}
                {...menu}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onOpen(t.id);
                  menu.onKeyDown?.(e);
                }}
                title={`${t.title} · ${STATUS[state].label}${canEdit ? ' · drag to reschedule' : ''}`}
              >
                {canEdit && !pos.clipL && (
                  <span
                    className="tl-handle left"
                    onPointerDown={(e) => begin(e, t, 'start')}
                    aria-label="Ubah tanggal mulai"
                  />
                )}
                {state === 'BLOCKED' ? <Lock size={12} /> : <StatusIcon status={state} size={12} />}
                <span className="truncate" style={{ color: 'var(--text)' }}>
                  {t.title}
                </span>
                <span className="grow" />
                <AvatarStack users={t.assignees} size={18} max={2} />
                {canEdit && !pos.clipR && (
                  <span
                    className="tl-handle right"
                    onPointerDown={(e) => begin(e, t, 'end')}
                    aria-label="Ubah deadline"
                  />
                )}
                {canLink && (
                  <span
                    className="tl-connector"
                    title="Drag to another task to make it wait for this one"
                    onPointerDown={(e) => begin(e, t, 'link')}
                    aria-label={`Tarik untuk menjadikan ${t.title} prasyarat`}
                  />
                )}
              </div>
            );
          })}

          {dragging && (
            <div className="tl-tip" style={{ left: Math.min(drag.px + 14, width - 260), top: drag.py + 16 }}>
              {tip}
            </div>
          )}
        </div>
      </div>
      <p className="xs muted row" style={{ marginTop: 10, gap: 6, flexWrap: 'wrap' }}>
        <Lock size={12} className="st-BLOCKED" />
        Dashed line = dependency.
        {(canEdit || canLink) && (
          <span className="row" style={{ gap: 4 }}>
            <MousePointerClick size={12} />
            {canEdit && 'Drag a bar to reschedule, drag its edges to change dates. '}
            {canLink && 'Drag the dot on a bar onto another task to add a dependency; click a line to remove it.'}
          </span>
        )}{' '}
        {visible
          .filter((t) => t.isBlocked && t.status !== 'DONE')
          .map((t) => `${t.title} waits for ${t.waitingFor.map((w) => w.title).join(', ')}`)
          .join(' · ')}
      </p>
    </div>
  );
}
