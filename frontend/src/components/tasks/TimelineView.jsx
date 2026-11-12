import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Diamond, Lock } from 'lucide-react';
import { AvatarStack } from '../ui';
import { STATUS, StatusIcon, displayState } from '../../lib/status';
import { MONTHS, addDays, diffDays, fmtDow, monthName, sameDay, startOfDay } from '../../lib/format';

const MIN_DAY_W = 56;
const ROW_H = 36;
const HEAD_ROW = 34; // baris milestone di atas daftar tugas
const SPAN = 14;

const COLORS = {
  TODO: { bg: '#eff6ff', border: '#bfdbfe' },
  IN_PROGRESS: { bg: '#fff7ed', border: '#fed7aa' },
  DONE: { bg: '#f0fdf4', border: '#bbf7d0' },
  OVERDUE: { bg: '#fef2f2', border: '#fecaca' },
  BLOCKED: { bg: '#fffbeb', border: '#fde68a' },
};

// "8 – 21 October 2026" bila satu bulan, "29 Oct – 11 Nov 2026" bila lintas bulan (format Figma).
function rangeLabel(a, b) {
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${b.getDate()} ${monthName(b)} ${b.getFullYear()}`;
  return `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
}

// Timeline: setiap tugas digambar sebagai bar dari tanggal mulai sampai deadline,
// sedangkan hubungan prasyarat digambar sebagai garis putus-putus (Gambar 2.14).
export default function TimelineView({ tasks, milestones = [], onOpen }) {
  const [start, setStart] = useState(() => addDays(startOfDay(), -6));
  const days = Array.from({ length: SPAN }, (_, i) => addDays(start, i));
  const today = startOfDay();

  // Lebar kolom hari mengikuti lebar panel agar grid selalu terisi penuh tanpa sisa kosong.
  const boxRef = useRef(null);
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

  const rows = useMemo(
    () =>
      tasks
        .filter((t) => t.startDate || t.dueDate)
        .sort((a, b) => new Date(a.startDate || a.dueDate) - new Date(b.startDate || b.dueDate)),
    [tasks],
  );

  // Hanya tugas yang beririsan dengan rentang 14 hari yang digambar; bar dipotong di tepi rentang.
  const visible = rows.filter((t) => {
    const s = diffDays(t.startDate || t.dueDate, start);
    const e = diffDays(t.dueDate || t.startDate, start);
    return e >= 0 && s < SPAN;
  });
  const layout = new Map();
  visible.forEach((t, i) => {
    const s = Math.max(0, diffDays(t.startDate || t.dueDate, start));
    const e = Math.min(SPAN - 1, diffDays(t.dueDate || t.startDate, start));
    layout.set(t.id, { x: s * DAY_W + 4, w: (e - s + 1) * DAY_W - 8, y: HEAD_ROW + i * ROW_H + 5 });
  });

  // Garis prasyarat: dari ujung kanan bar prasyarat ke awal bar tugas yang menunggu.
  const links = [];
  visible.forEach((t) => {
    t.prerequisites.forEach((p) => {
      const a = layout.get(p.id);
      const b = layout.get(t.id);
      // Seperti Figma, hanya hubungan yang masih menghambat (prasyarat belum Done) yang digambar.
      if (a && b && p.status !== 'DONE')
        links.push({
          key: `${p.id}-${t.id}`,
          x1: a.x + a.w,
          y1: a.y + 13,
          x2: b.x,
          y2: b.y + 13,
          done: p.status === 'DONE',
        });
    });
  });

  const width = SPAN * DAY_W;
  // Tinggi grid minimal setinggi panel (dikurangi header hari) agar tidak ada ruang kosong di bawahnya.
  const contentH = HEAD_ROW + Math.max(visible.length, 1) * ROW_H + 12;
  const height = Math.max(contentH, Math.floor(box.h));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="row-between" style={{ marginBottom: 12 }}>
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

      <div className="timeline" ref={boxRef}>
        <div className="tl-head" style={{ gridTemplateColumns: `repeat(${SPAN}, ${DAY_W}px)`, width }}>
          {days.map((d) => (
            <div key={d.toISOString()} className={`tl-day ${sameDay(d, today) ? 'today' : ''}`}>
              {fmtDow(d)}
              <b>{d.getDate()}</b>
            </div>
          ))}
        </div>
        <div className="tl-body" style={{ width, height, overflow: 'hidden' }}>
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
                  ? 'rgba(37,99,235,0.06)'
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

          <svg
            width={width}
            height={height}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}
            aria-hidden
          >
            {links.map((l) => {
              // Jika bar lanjutan dimulai setelah bar prasyarat: siku sederhana.
              // Jika tumpang tindih: turun ke celah antarbaris dulu, lalu masuk dari kiri.
              const d =
                l.x2 - l.x1 >= 16
                  ? `M${l.x1} ${l.y1} H${(l.x1 + l.x2) / 2} V${l.y2} H${l.x2}`
                  : `M${l.x1} ${l.y1} h8 V${l.y2 - 18} H${l.x2 - 10} V${l.y2} H${l.x2}`;
              return (
                <path
                  key={l.key}
                  d={d}
                  fill="none"
                  stroke={l.done ? 'var(--text-faint)' : '#d97706'}
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                  markerEnd="url(#arrow)"
                />
              );
            })}
            <defs>
              <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0 0 L8 4 L0 8 z" fill="#d97706" />
              </marker>
            </defs>
          </svg>

          {visible.map((t) => {
            const pos = layout.get(t.id);
            const state = displayState(t);
            const c = COLORS[state];
            return (
              <button
                key={t.id}
                className={`tl-bar st-${state}`}
                style={{ left: pos.x, top: pos.y, width: Math.max(pos.w, 40), background: c.bg, borderColor: c.border }}
                onClick={() => onOpen(t.id)}
                title={`${t.title} · ${STATUS[state].label}`}
              >
                {state === 'BLOCKED' ? <Lock size={12} /> : <StatusIcon status={state} size={12} />}
                <span className="truncate" style={{ color: 'var(--text)' }}>
                  {t.title}
                </span>
                <span className="grow" />
                <AvatarStack users={t.assignees} size={18} max={2} />
              </button>
            );
          })}
        </div>
      </div>
      <p className="xs muted row" style={{ marginTop: 10, gap: 6 }}>
        <Lock size={12} className="st-BLOCKED" />
        Dashed line = dependency.{' '}
        {visible
          .filter((t) => t.isBlocked && t.status !== 'DONE')
          .map((t) => `${t.title} waits for ${t.waitingFor.map((w) => w.title).join(', ')}`)
          .join(' · ')}
      </p>
    </div>
  );
}
