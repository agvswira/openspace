import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Lock, Unlink } from 'lucide-react';
import { AvatarStack } from '../ui';
import { useContextMenu, useMenuBinder } from '../ui/ContextMenu';
import { STATUS, StatusIcon, displayState } from '../../lib/status';
import { MONTHS, addDays, diffDays, fmtDow, fmtShort, monthName, sameDay, startOfDay } from '../../lib/format';
import { scheduleBody, shiftSpan, spanOf } from '../../lib/taskGuards';

const MIN_DAY_W = 56;
const ROW_H = 36;
const HEAD_ROW = 8; // jarak kecil di atas baris tugas pertama
const VISIBLE_DAYS = 14; // jumlah hari yang muat di layar; sisanya digeser (scroll)
const DRAG_THRESHOLD = 4; // px; di bawah ini dianggap klik biasa
const DAY_MS = 864e5;
const BAR_H = 26;
const LINK_STUB = 12; // px; jarak garis keluar/masuk dari ujung bar sebelum berbelok
const LINK_RADIUS = 6; // px; jari-jari sudut garis prasyarat

// Polyline siku dengan sudut membulat (kurva kuadratik di setiap belokan).
function roundedPath(points) {
  const pts = points.filter((p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1]);
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const l1 = Math.hypot(cx - px, cy - py);
    const l2 = Math.hypot(nx - cx, ny - cy);
    const r = Math.min(LINK_RADIUS, l1 / 2, l2 / 2);
    if (r < 1) {
      d += ` L${cx} ${cy}`;
      continue;
    }
    const ax = cx - ((cx - px) / l1) * r;
    const ay = cy - ((cy - py) / l1) * r;
    const bx = cx + ((nx - cx) / l2) * r;
    const by = cy + ((ny - cy) / l2) * r;
    d += ` L${ax} ${ay} Q${cx} ${cy} ${bx} ${by}`;
  }
  const [lx, ly] = pts.at(-1);
  return `${d} L${lx} ${ly}`;
}

const LINK_SPREAD = 8; // px; jarak antar garis yang berbagi bar/celah agar tidak saling menumpuk
const LINK_TUCK = 8; // px; garis dimulai dari balik bar prasyarat

// Geser ke-k dari n garis agar tersebar simetris di sekitar titik tengah.
const spread = (k, n, step) => (k - (n - 1) / 2) * step;

// Celah kosong antarbaris tempat garis boleh lewat mendatar.
const gapY = (a, b) => {
  const gap = (ROW_H - BAR_H) / 2;
  return b.y > a.y ? b.y - gap : b.y + BAR_H + gap;
};

// Rute garis dari belakang bar prasyarat (a) ke awal bar tugas yang menunggu (b).
// Garis keluar dari balik ujung kanan bar a dan berakhir dengan panah tepat di tepi kiri bar b.
// Ada ruang di antara keduanya: lurus ke kanan, belok tepat sebelum bar tujuan, lalu masuk.
// Tumpang tindih: keluar sedikit ke kanan, menyusuri celah kosong di atas/bawah bar tujuan,
// lalu masuk dari kiri, sehingga garis tidak menembus bar.
// `o` berisi urutan garis ini di antara garis lain yang berbagi bar asal (ks/ns),
// bar tujuan (kt/nt), atau celah (kg/ng), untuk memberi jarak di antara mereka.
function linkRoute(a, b, o) {
  const x1 = a.x + a.w - LINK_TUCK;
  const y1 = a.y + BAR_H / 2 + spread(o.ks, o.ns, LINK_SPREAD);
  const x2 = b.x;
  const y2 = b.y + BAR_H / 2 + spread(o.kt, o.nt, LINK_SPREAD);
  const xo = a.x + a.w + LINK_STUB + o.ks * LINK_SPREAD;
  // Garis yang masuk ke bar-bar dengan tanggal mulai sama berbagi kolom belok yang sama;
  // masing-masing mendapat jalur sendiri (kv) agar garis vertikalnya tidak berimpit.
  const xi = x2 - LINK_STUB - o.kv * LINK_SPREAD;
  if (xi - xo >= 0) {
    return [
      [x1, y1],
      [xi, y1],
      [xi, y2],
      [x2, y2],
    ];
  }
  // Ruang sempit tetapi bar tujuan berada di bawah/atas titik belok: turun (atau naik)
  // lalu masuk dari tepi atas/bawah bar tujuan, tanpa memutar.
  if (b.x <= xo - 6 && b.x + b.w >= xo + 6) {
    const yEdge = b.y > a.y ? b.y : b.y + BAR_H;
    return [
      [x1, y1],
      [xo, y1],
      [xo, yEdge],
    ];
  }
  const yg = gapY(a, b) + spread(o.kg, o.ng, 4);
  return [
    [x1, y1],
    [xo, y1],
    [xo, yg],
    [xi, yg],
    [xi, y2],
    [x2, y2],
  ];
}

// Beri setiap garis urutannya di antara garis yang berbagi bar asal, bar tujuan, atau celah yang sama.
function layoutLinks(raw) {
  // Urut dari atas ke bawah agar garis dalam satu kelompok tidak saling menyilang.
  const sorted = [...raw].sort((p, q) => p.a.y - q.a.y || p.b.y - q.b.y);
  const rank = (keyOf) => {
    const groups = new Map();
    sorted.forEach((l) => {
      const k = keyOf(l);
      if (k == null) return;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(l);
    });
    const out = new Map();
    groups.forEach((list) => list.forEach((l, i) => out.set(l.key, { k: i, n: list.length })));
    return out;
  };
  const bySource = rank((l) => l.pre.id);
  const byTarget = rank((l) => l.task.id);
  const byGap = rank((l) => (l.b.x - (l.a.x + l.a.w) < LINK_STUB * 2 ? gapY(l.a, l.b) : null));
  // Jalur vertikal: garis dari bar paling atas mendapat jalur paling kanan.
  const byColumn = rank((l) => Math.round(l.b.x));
  return sorted.map((l) => {
    const s = bySource.get(l.key);
    const t = byTarget.get(l.key);
    const g = byGap.get(l.key) || { k: 0, n: 1 };
    const v = byColumn.get(l.key);
    return {
      ...l,
      d: roundedPath(linkRoute(l.a, l.b, { ks: s.k, ns: s.n, kt: t.k, nt: t.n, kg: g.k, ng: g.n, kv: v.k })),
    };
  });
}

const COLORS = {
  TODO: { bg: 'var(--todo-bg)', border: 'var(--todo-border)' },
  IN_PROGRESS: { bg: 'var(--progress-bg)', border: 'var(--progress-border)' },
  IN_REVIEW: { bg: 'var(--purple-bg)', border: 'var(--review-border)' },
  DONE: { bg: 'var(--done-bg)', border: 'var(--done-border)' },
  OVERDUE: { bg: 'var(--overdue-bg)', border: 'var(--overdue-border)' },
  BLOCKED: { bg: 'var(--blocked-bg)', border: 'var(--blocked-border)' },
};

// "8 – 21 October 2026" bila satu bulan, "29 Oct – 11 Nov 2026" bila lintas bulan (format Figma).
function rangeLabel(a, b) {
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${b.getDate()} ${monthName(b)} ${b.getFullYear()}`;
  return `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
}

/**
 * Timeline: setiap tugas digambar sebagai bar dari tanggal mulai sampai deadline, hubungan
 * prasyarat sebagai garis putus-putus (Gambar 2.14). Navigasi tanggal cukup digeser:
 * touchpad (dua jari kiri/kanan), scrollbar di bawah, Shift + roda mouse, atau roda mouse
 * biasa bila tidak ada baris yang perlu di-scroll vertikal. Rentang tanggal mengikuti tugas
 * yang ada (tugas paling awal sampai paling akhir). Interaksi langsung pada bar:
 *  - seret bar            → geser jadwal (mulai & deadline bergeser bersama)
 *  - seret tepi kiri/kanan → ubah tanggal mulai / deadline
 *  - seret titik di ujung kanan bar ke bar lain → bar tujuan menunggu bar asal (prasyarat)
 *  - klik garis prasyarat  → hapus hubungan
 * Semua perubahan tetap divalidasi backend (izin role, siklus, status tugas).
 */
export default function TimelineView({ tasks, onOpen, menuFor, bulk }) {
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
  // Lebar kolom: 14 hari pas memenuhi panel, minimal 56 px.
  const DAY_W = Math.max(MIN_DAY_W, boxW / VISIBLE_DAYS || 64);

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
    return shiftSpan(sp, drag.mode, deltaDays);
  };

  // ---- Rentang tanggal = dari tugas paling awal sampai tugas paling akhir ----
  // Timeline hanya bisa digeser sejauh tanggal yang memang berisi tugas, ditambah
  // 1 hari ruang di tiap sisi. Tugas baru atau bar yang dipindah keluar rentang otomatis
  // memperluas rentang. Bila rentang lebih pendek dari 14 hari, rentang dilebarkan ke kedua sisi
  // agar grid tetap memenuhi panel.
  let minS = null;
  let maxE = null;
  const include = (a, b) => {
    if (!minS || a < minS) minS = a;
    if (!maxE || b > maxE) maxE = b;
  };
  // Rentang dihitung dari jadwal tersimpan (bukan pratinjau seretan), sehingga tetap diam selama
  // bar diseret. Bar boleh melewati ujung (tooltip menunjukkan tanggalnya); rentang melebar
  // setelah bar dilepas dan jadwal baru tersimpan.
  rows.forEach((t) => {
    const sp = pendingDates[t.id] || spanOf(t);
    include(sp.s, sp.e);
  });
  if (!minS) {
    minS = addDays(today, -6);
    maxE = addDays(today, VISIBLE_DAYS - 7);
  }
  let start = addDays(minS, -1);
  let SPAN = diffDays(maxE, minS) + 3;
  if (SPAN < VISIBLE_DAYS) {
    start = addDays(start, -Math.floor((VISIBLE_DAYS - SPAN) / 2));
    SPAN = VISIBLE_DAYS;
  }
  const startMs = start.getTime();
  const days = Array.from({ length: SPAN }, (_, i) => addDays(start, i));

  // ---- Posisi geser horizontal ----
  // anchorMs = tanggal (ms, boleh pecahan hari) di tepi kiri layar. Dipakai untuk menjaga posisi
  // saat rentang berubah (tugas baru, bar diseret) atau lebar kolom berubah karena ukuran jendela.
  // Browser otomatis membatasi scrollLeft ke rentang yang ada.
  const anchorMs = useRef(addDays(startOfDay(), -6).getTime());
  const [scrollX, setScrollX] = useState(0);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el || !boxW) return;
    el.scrollLeft = ((anchorMs.current - startMs) / DAY_MS) * DAY_W;
    setScrollX(el.scrollLeft);
  }, [startMs, SPAN, DAY_W, boxW]);

  const onScroll = (e) => {
    const el = e.currentTarget;
    anchorMs.current = startMs + (el.scrollLeft / DAY_W) * DAY_MS;
    setScrollX(el.scrollLeft);
  };

  // Scroll memakai perilaku bawaan browser: geser atas-bawah menggulir baris tugas
  // (lalu halaman bila sudah di ujung), geser ke samping di touchpad atau Shift + roda menggeser tanggal.

  // Label rentang mengikuti hari yang sedang terlihat di layar.
  const firstVisible = Math.min(Math.max(0, Math.round(scrollX / DAY_W)), SPAN - 1);
  const visibleCount = Math.max(1, Math.floor((boxW || VISIBLE_DAYS * DAY_W) / DAY_W));
  const lastVisible = Math.min(SPAN - 1, firstVisible + visibleCount - 1);

  // Semua tugas bertanggal berada di dalam rentang.
  const visible = rows;
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

  // Baris tugas paling atas yang beririsan dengan jendela [fromIdx, fromIdx + 14 hari).
  // Dipakai agar tampilan langsung menunjukkan tugas minggu ini, bukan baris tugas lama yang kosong.
  const firstRowTop = (fromIdx) => {
    let best = null;
    visible.forEach((t) => {
      const sp = spanOf(t);
      if (diffDays(sp.e, start) >= fromIdx && diffDays(sp.s, start) < fromIdx + VISIBLE_DAYS) {
        const y = layout.get(t.id).y;
        if (best === null || y < best) best = y;
      }
    });
    return best === null ? 0 : Math.max(0, best - HEAD_ROW - 5);
  };
  const todayIdx = diffDays(addDays(startOfDay(), -6), start);

  const goToday = () => {
    boxRef.current?.scrollTo({ left: todayIdx * DAY_W, top: firstRowTop(todayIdx), behavior: 'smooth' });
  };

  // Saat pertama dibuka (data dan ukuran panel sudah siap), scroll vertikal ke tugas minggu ini.
  const didInitV = useRef(false);
  const topForToday = firstRowTop(todayIdx);
  useEffect(() => {
    if (didInitV.current || !boxW || !tasks.length || !boxRef.current) return;
    didInitV.current = true;
    boxRef.current.scrollTop = topForToday;
  }, [boxW, tasks.length, topForToday]);

  // Garis prasyarat: dari ujung kanan bar prasyarat ke awal bar tugas yang menunggu.
  // Hubungan yang masih menghambat digambar tegas; yang sudah selesai digambar samar.
  const rawLinks = [];
  visible.forEach((t) => {
    t.prerequisites.forEach((p) => {
      const a = layout.get(p.id);
      const b = layout.get(t.id);
      if (a?.w && b?.w)
        rawLinks.push({
          key: `${p.id}-${t.id}`,
          task: t,
          pre: p,
          // Lebar bar minimal 40 px saat dirender; ujung garis mengikuti lebar yang terlihat.
          a: { ...a, w: Math.max(a.w, 40) },
          b,
          done: p.status === 'DONE',
        });
    });
  });
  const links = layoutLinks(rawLinks);

  // Tugas yang masih menunggu prasyarat, dirangkum di bawah timeline.
  const waiting = visible.filter((t) => t.isBlocked && t.status !== 'DONE');

  // ---- Penanganan pointer ----
  const begin = (e, task, mode) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (mode !== 'link' && !canEdit) return;
    e.stopPropagation();
    const rect = bodyRef.current.getBoundingClientRect();
    setDrag({
      mode,
      task,
      // Tanggal (ms) di bawah pointer saat mulai menyeret. Pergeseran dihitung dalam tanggal,
      // bukan piksel, sehingga tetap benar walau rentang/scroll timeline berubah saat menyeret.
      t0: startMs + ((e.clientX - rect.left) / DAY_W) * DAY_MS,
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
      const box = boxRef.current;
      if (!rect || !box) return;
      // Saat menyeret dekat tepi kiri/kanan, timeline ikut bergeser.
      const b = box.getBoundingClientRect();
      if (e.clientX < b.left + 40) box.scrollLeft -= 16;
      else if (e.clientX > b.right - 40) box.scrollLeft += 16;
      const tNow = startMs + ((e.clientX - rect.left) / DAY_W) * DAY_MS;
      const dx = ((tNow - drag.t0) / DAY_MS) * DAY_W;
      const moved = drag.moved || Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > DRAG_THRESHOLD;
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
      const next = shiftSpan(spanOf(d.task), d.mode, n);
      const body = scheduleBody(d.task, d.mode, next);
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
    // Gesture dibatalkan sistem (notifikasi, gestur OS): seretan dihentikan tanpa menyimpan.
    const onCancel = () => setDrag(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
    };
  }, [drag, DAY_W, startMs, tasks, bulk, onOpen]);

  const width = SPAN * DAY_W;
  // Tinggi grid minimal setinggi panel (dikurangi header hari) agar tidak ada ruang kosong di bawahnya.
  const contentH = HEAD_ROW + Math.max(visible.length, 1) * ROW_H + 12;
  const height = Math.max(contentH, Math.floor(box.h));

  const linkSource = drag?.mode === 'link' && drag.moved ? layout.get(drag.task.id) : null;
  const active = (t) => drag?.task.id === t.id;
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
          <strong style={{ fontSize: 16 }} aria-live="polite">
            {rangeLabel(days[firstVisible], days[lastVisible])}
          </strong>
          <button className="btn btn-sm" onClick={goToday}>
            Today
          </button>
        </div>
        <div className="tl-legend">
          {['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'OVERDUE', 'BLOCKED'].map((s) => (
            <span key={s} className={`row st-${s}`} style={{ gap: 4 }}>
              <StatusIcon status={s} size={12} />
              {STATUS[s].label}
            </span>
          ))}
        </div>
      </div>

      <div
        className={`timeline ${dragging ? 'is-dragging' : ''}`}
        ref={boxRef}
        onScroll={onScroll}
        tabIndex={0}
        aria-label="Timeline, geser ke kiri atau kanan untuk melihat tanggal lain"
      >
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

          {/* Garis prasyarat digambar di bawah bar (z-index), jadi tidak menutupi judul tugas. */}
          <svg width={width} height={height} className="tl-links" aria-hidden>
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                markerUnits="userSpaceOnUse"
                orient="auto"
              >
                <path d="M1 1 L9 5 L1 9 z" fill="var(--dep-line)" />
              </marker>
              <marker
                id="arrow-done"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                markerUnits="userSpaceOnUse"
                orient="auto"
              >
                <path d="M1 1 L9 5 L1 9 z" fill="var(--dep-line-done)" />
              </marker>
              <marker
                id="arrow-new"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                markerUnits="userSpaceOnUse"
                orient="auto"
              >
                <path d="M1 1 L9 5 L1 9 z" fill="var(--primary)" />
              </marker>
            </defs>
            {links.map((l) => {
              const d = l.d;
              return (
                <g key={l.key} className={`tl-link ${l.done ? 'done' : ''}`}>
                  <path
                    d={d}
                    fill="none"
                    stroke={l.done ? 'var(--dep-line-done)' : 'var(--dep-line)'}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    strokeLinejoin="round"
                    markerEnd={l.done ? 'url(#arrow-done)' : 'url(#arrow)'}
                  />
                  {/* Area klik lebar di atas garis untuk menghapus hubungan */}
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
          </svg>
          {/* Garis sementara saat menarik prasyarat baru: di atas bar agar selalu terlihat. */}
          {linkSource && (
            <svg width={width} height={height} className="tl-links tl-links-live" aria-hidden>
              <path
                d={`M${linkSource.x + Math.max(linkSource.w, 40)} ${linkSource.y + BAR_H / 2} L${drag.px} ${drag.py}`}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2"
                strokeDasharray="5 3"
                strokeLinecap="round"
                markerEnd="url(#arrow-new)"
              />
            </svg>
          )}

          {visible.map((t) => {
            const pos = layout.get(t.id);
            if (!pos.w) return null;
            const state = displayState(t);
            const c = COLORS[state];
            const active = drag?.task.id === t.id && drag.moved;
            const isTarget = drag?.mode === 'link' && drag.targetId === t.id;
            // Membuka menu (klik kanan / tekan lama) membatalkan seretan, sehingga tekan lama
            // tidak sekaligus membuka panel detail saat jari diangkat.
            const menu = bind(
              menuFor &&
                (() => {
                  setDrag(null);
                  return menuFor(t);
                }),
            );
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

          {/* Penanda tugas di luar layar: klik untuk menggeser timeline ke bar tersebut */}
          {boxW > 0 &&
            visible.map((t) => {
              const pos = layout.get(t.id);
              if (!pos.w || (active(t) && dragging)) return null;
              const viewL = scrollX;
              const viewR = scrollX + boxW;
              const side = pos.x + pos.w < viewL + 8 ? 'left' : pos.x > viewR - 8 ? 'right' : null;
              if (!side) return null;
              return (
                <button
                  key={`off-${t.id}`}
                  className={`tl-offscreen ${side}`}
                  style={{ top: pos.y + 3, left: side === 'left' ? viewL + 6 : viewR - 6 }}
                  onClick={() => boxRef.current?.scrollTo({ left: Math.max(0, pos.x - 2 * DAY_W), behavior: 'smooth' })}
                  title={`${t.title} · ${fmtShort(spanOf(t).s)} – ${fmtShort(spanOf(t).e)}`}
                >
                  {side === 'left' && <ChevronLeft size={12} />}
                  <span className="truncate">{t.title}</span>
                  {side === 'right' && <ChevronRight size={12} />}
                </button>
              );
            })}

          {dragging && (
            <div className="tl-tip" style={{ left: Math.min(drag.px + 14, width - 260), top: drag.py + 16 }}>
              {tip}
            </div>
          )}
        </div>
      </div>
      {waiting.length > 0 && (
        <p className="xs muted row" style={{ marginTop: 10, gap: 6, flexWrap: 'wrap' }}>
          <Lock size={12} className="st-BLOCKED" />
          {waiting.map((t) => `${t.title} waits for ${t.waitingFor.map((w) => w.title).join(', ')}`).join(' · ')}
        </p>
      )}
    </div>
  );
}
