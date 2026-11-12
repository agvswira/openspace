import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Users, Flag } from 'lucide-react';
import { AvatarStack } from '../ui';
import { StatusBadge, StatusIcon, displayState } from '../../lib/status';
import { addDays, fmtDow, monthName, sameDay, startOfDay } from '../../lib/format';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Calendar: tugas (pada deadline), rapat, dan milestone ditampilkan pada tanggalnya.
export default function CalendarView({ tasks, meetings = [], milestones = [], onOpen }) {
  const [cursor, setCursor] = useState(() => startOfDay());
  const [mode, setMode] = useState('month');
  const today = startOfDay();

  const days = useMemo(() => {
    if (mode === 'week') {
      const mon = addDays(cursor, -((cursor.getDay() + 6) % 7));
      return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = addDays(first, -((first.getDay() + 6) % 7));
    const weeks = Math.ceil(
      (((first.getDay() + 6) % 7) + new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()) / 7,
    );
    return Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
  }, [cursor, mode]);

  const shift = (dir) =>
    setCursor((c) => (mode === 'week' ? addDays(c, dir * 7) : new Date(c.getFullYear(), c.getMonth() + dir, 1)));

  const eventsOn = (d) => [
    ...milestones
      .filter((m) => m.dueDate && sameDay(m.dueDate, d))
      .map((m) => ({ type: 'milestone', id: m.id, title: m.name })),
    ...meetings
      .filter((m) => sameDay(m.date, d))
      .map((m) => ({ type: 'meeting', id: m.id, title: `${m.startTime} ${m.title}` })),
    ...tasks
      .filter((t) => t.dueDate && sameDay(t.dueDate, d))
      .map((t) => ({ type: 'task', id: t.id, title: t.title, state: displayState(t) })),
  ];

  const upcoming = tasks
    .filter(
      (t) =>
        t.status !== 'DONE' &&
        t.dueDate &&
        startOfDay(t.dueDate) >= today &&
        startOfDay(t.dueDate) <= addDays(today, 7),
    )
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  return (
    <div className="calendar">
      <div className="calendar-main">
        <div className="row-between" style={{ marginBottom: 12 }}>
          <div className="row">
            <button className="btn btn-sm" onClick={() => shift(-1)} aria-label="Sebelumnya">
              <ChevronLeft size={14} />
            </button>
            <button className="btn btn-sm" onClick={() => shift(1)} aria-label="Berikutnya">
              <ChevronRight size={14} />
            </button>
            <strong style={{ fontSize: 16, marginLeft: 6 }}>
              {monthName(cursor)} {cursor.getFullYear()}
            </strong>
            <button className="btn btn-sm" onClick={() => setCursor(startOfDay())}>
              Today
            </button>
          </div>
          <div className="segmented">
            <button className={mode === 'month' ? 'active' : ''} onClick={() => setMode('month')}>
              Month
            </button>
            <button className={mode === 'week' ? 'active' : ''} onClick={() => setMode('week')}>
              Week
            </button>
          </div>
        </div>
        {/* Baris minggu dibagi rata sehingga grid mengisi tinggi halaman */}
        <div className="cal-grid" style={{ gridTemplateRows: `auto repeat(${days.length / 7}, minmax(84px, 1fr))` }}>
          {DOW.map((d) => (
            <div key={d} className="cal-dow">
              {d}
            </div>
          ))}
          {days.map((d) => {
            const out = mode === 'month' && d.getMonth() !== cursor.getMonth();
            const evs = eventsOn(d);
            return (
              <div
                key={d.toISOString()}
                className={`cal-cell ${out ? 'out' : ''} ${[0, 6].includes(d.getDay()) ? 'weekend' : ''}`}
              >
                <span className={`cal-day ${sameDay(d, today) ? 'today' : ''}`}>{d.getDate()}</span>
                {evs.slice(0, mode === 'week' ? 12 : 3).map((ev) =>
                  ev.type === 'task' ? (
                    <button
                      key={ev.id}
                      className={`cal-ev bg-${ev.state} st-${ev.state}`}
                      style={{ border: 'none', textAlign: 'left' }}
                      onClick={() => onOpen(ev.id)}
                      title={ev.title}
                    >
                      <StatusIcon status={ev.state} size={11} />
                      <span className="truncate" style={{ color: 'var(--text)' }}>
                        {ev.title}
                      </span>
                    </button>
                  ) : (
                    <span
                      key={ev.id}
                      className="cal-ev"
                      style={{ background: ev.type === 'meeting' ? 'var(--bg-muted)' : 'var(--purple-bg)' }}
                      title={ev.title}
                    >
                      {ev.type === 'meeting' ? <Users size={11} /> : <Flag size={11} color="var(--purple)" />}
                      <span className="truncate">{ev.title}</span>
                    </span>
                  ),
                )}
                {evs.length > (mode === 'week' ? 12 : 3) && <span className="xs muted">+{evs.length - 3} more</span>}
              </div>
            );
          })}
        </div>
      </div>

      <aside className="card" style={{ marginTop: 40, display: 'flex', flexDirection: 'column' }}>
        <div className="card-head">
          <strong className="sm">Upcoming</strong>
          <span className="xs muted">Next 7 days</span>
        </div>
        {!upcoming.length && (
          <p className="sm faint" style={{ padding: '0 16px 16px' }}>
            Tidak ada deadline dalam 7 hari.
          </p>
        )}
        {upcoming.map((t) => (
          <button
            key={t.id}
            className="list-row clickable"
            style={{
              width: '100%',
              border: 'none',
              borderTop: '1px solid var(--border)',
              background: 'none',
              textAlign: 'left',
            }}
            onClick={() => onOpen(t.id)}
          >
            <div style={{ width: 34, textAlign: 'center' }}>
              <div className="xs muted">{fmtDow(t.dueDate)}</div>
              <div className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
                {new Date(t.dueDate).getDate()}
              </div>
            </div>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="sm truncate" style={{ fontWeight: 500 }}>
                {t.title}
              </div>
              <div className="row" style={{ marginTop: 3 }}>
                <StatusBadge status={displayState(t)} plain />
                <AvatarStack users={t.assignees} size={18} />
              </div>
            </div>
          </button>
        ))}
      </aside>
    </div>
  );
}
