import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { EmptyState } from '../ui';
import { fmtLong, startOfDay } from '../../lib/format';

const STATES = [
  ['PRESENT', 'Present'],
  ['LATE', 'Late'],
  ['EXCUSED', 'Excused'],
  ['ABSENT', 'Absent'],
];
const isAttended = (a) => a === 'PRESENT' || a === 'LATE';

// Kehadiran tiap anggota dari semua rapat yang kehadirannya sudah dicatat.
export function attendanceByMember(meetings = []) {
  const map = new Map();
  meetings.forEach((m) =>
    m.participants.forEach((p) => {
      if (!p.attendance) return;
      const r = map.get(p.id) ?? { recorded: 0, attended: 0 };
      r.recorded++;
      if (isAttended(p.attendance)) r.attended++;
      map.set(p.id, r);
    }),
  );
  return map;
}

// Kartu Overview: rekap kehadiran rapat terakhir (yang sudah berlangsung) per rapat.
export default function MeetingAttendance({ meetings = [], projectId }) {
  const today = startOfDay();
  const recent = meetings
    .filter((m) => startOfDay(m.date) <= today)
    .sort((a, b) => new Date(b.date) - new Date(a.date) || b.startTime.localeCompare(a.startTime))
    .slice(0, 5);
  const totals = recent.reduce(
    (acc, m) => {
      m.participants.forEach((p) => {
        if (p.attendance) acc.recorded++;
        if (isAttended(p.attendance)) acc.attended++;
      });
      return acc;
    },
    { recorded: 0, attended: 0 },
  );
  const rate = totals.recorded ? Math.round((totals.attended / totals.recorded) * 100) : null;

  return (
    <section className="card" style={{ marginTop: 14 }}>
      <div className="card-head">
        <span className="card-title">Meeting attendance</span>
        <div className="row" style={{ gap: 10 }}>
          {rate !== null && <span className="xs muted">{rate}% attended in recent meetings</span>}
          <Link to={`/projects/${projectId}/meetings`} className="btn btn-sm">
            View all
          </Link>
        </div>
      </div>
      {recent.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Belum ada rapat yang berlangsung">
          Rekap kehadiran muncul setelah rapat dicatat di halaman Meetings.
        </EmptyState>
      ) : (
        recent.map((m) => {
          const attended = m.participants.filter((p) => isAttended(p.attendance)).length;
          const recorded = m.participants.filter((p) => p.attendance).length;
          const pct = m.participants.length ? (attended / m.participants.length) * 100 : 0;
          return (
            <Link key={m.id} to={`/projects/${projectId}/meetings`} className="meeting-att-row">
              <span style={{ minWidth: 0 }}>
                <span className="sm" style={{ display: 'block', fontWeight: 600 }}>
                  {m.title}
                </span>
                <span className="xs muted">
                  {fmtLong(m.date)} · {m.startTime}
                </span>
              </span>
              <span className="row meeting-att-pills" style={{ gap: 6, flexWrap: 'wrap' }}>
                {recorded === 0 ? (
                  <span className="att-pill att-NONE">Not recorded</span>
                ) : (
                  STATES.map(([key, label]) => {
                    const n = m.participants.filter((p) => p.attendance === key).length;
                    return n ? (
                      <span key={key} className={`att-pill att-${key}`}>
                        {label} <strong>{n}</strong>
                      </span>
                    ) : null;
                  })
                )}
              </span>
              <span className="meeting-att-rate">
                <span className="mono sm" style={{ fontWeight: 600 }}>
                  {attended}/{m.participants.length}
                </span>
                <span className="progress" style={{ display: 'block', marginTop: 4 }}>
                  <span style={{ width: `${pct}%`, background: '#16a34a' }} />
                </span>
              </span>
            </Link>
          );
        })
      )}
    </section>
  );
}
