import { useMemo, useState } from 'react';
import { Users, X } from 'lucide-react';
import { Avatar, EmptyState } from '../ui';
import { AssigneeFilter, RoleFilter } from '../tasks/TaskFilterBar';
import { attendanceByMember } from './MeetingAttendance';

// Progres tiap anggota: tugas yang ditugaskan, status pengerjaannya, dan kehadiran rapat.
export function memberStats(tasks, members, meetings = []) {
  const att = attendanceByMember(meetings);
  const rows = new Map(
    members.map((m) => [
      m.id,
      {
        user: m,
        role: m.role?.name,
        assigned: 0,
        done: 0,
        inProgress: 0,
        inReview: 0,
        overdue: 0,
        attendance: att.get(m.id) ?? { recorded: 0, attended: 0 },
      },
    ]),
  );
  tasks.forEach((t) =>
    t.assignees.forEach((a) => {
      const r = rows.get(a.id);
      if (!r) return;
      r.assigned++;
      if (t.status === 'DONE') r.done++;
      else if (t.status === 'IN_PROGRESS') r.inProgress++;
      else if (t.status === 'IN_REVIEW') r.inReview++;
      if (t.isOverdue) r.overdue++;
    }),
  );
  return [...rows.values()]
    .map((r) => ({ ...r, completion: r.assigned ? Math.round((r.done / r.assigned) * 100) : 0 }))
    .sort((a, b) => b.completion - a.completion || b.assigned - a.assigned);
}

export default function ContributionPanel({ tasks, members, meetings, onOpenMember }) {
  const [roleFilter, setRoleFilter] = useState([]);
  const [people, setPeople] = useState([]);
  const all = useMemo(() => memberStats(tasks, members, meetings), [tasks, members, meetings]);
  // Sama seperti filter Tasks: role dan orang yang dipilih harus sama-sama cocok.
  const rows = all.filter(
    (r) => (!roleFilter.length || roleFilter.includes(r.role)) && (!people.length || people.includes(r.user.id)),
  );
  const activeFilters = roleFilter.length + people.length;
  const done = tasks.filter((t) => t.status === 'DONE').length;
  const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <section className="card" style={{ marginTop: 14 }}>
      <div className="card-head card-head-stack">
        <div>
          <span className="card-title">Team progress &amp; contribution</span>
          <div className="row head-sub">
            <span className="stat-num">{percent}%</span>
            <span className="xs muted">
              project progress · {done} of {tasks.length} tasks done
            </span>
          </div>
        </div>
        <div className="filter-bar">
          {activeFilters > 0 && (
            <button
              type="button"
              className="btn btn-sm filter-clear"
              onClick={() => {
                setRoleFilter([]);
                setPeople([]);
              }}
            >
              <X size={12} />
              Clear
            </button>
          )}
          <RoleFilter members={members} value={roleFilter} onChange={setRoleFilter} />
          <AssigneeFilter members={members} value={people} onChange={setPeople} label="Member" />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Users} title="Tidak ada anggota yang cocok" />
      ) : (
        <div role="table" aria-label="Progres anggota">
          <div className="contrib-row contrib-headrow" role="row">
            <span role="columnheader">Member</span>
            <span role="columnheader">Assigned</span>
            <span role="columnheader" className="contrib-hide-sm contrib-hide-md">
              In progress
            </span>
            <span role="columnheader" className="contrib-hide-sm">
              In review
            </span>
            <span role="columnheader">Done</span>
            <span role="columnheader" className="contrib-hide-sm contrib-hide-md">
              Overdue
            </span>
            <span role="columnheader">Completion</span>
            <span role="columnheader" className="contrib-hide-sm" title="Kehadiran rapat yang sudah dicatat">
              Meeting attendance
            </span>
          </div>
          {rows.map((r) => (
            <button
              key={r.user.id}
              type="button"
              role="row"
              className="contrib-row contrib-member"
              onClick={() => onOpenMember?.(r.user)}
              title={`Lihat tugas ${r.user.name}`}
            >
              <span className="row" role="cell" style={{ minWidth: 0, textAlign: 'left' }}>
                <Avatar user={r.user} size={34} />
                <span style={{ minWidth: 0 }}>
                  <span className="contrib-name">{r.user.name}</span>
                  <span className="contrib-role">{r.role}</span>
                </span>
              </span>
              <span className="mono" role="cell">
                {r.assigned}
              </span>
              <span className="mono contrib-hide-sm contrib-hide-md" role="cell">
                {r.inProgress}
              </span>
              <span className={`mono contrib-hide-sm ${r.inReview ? 'st-IN_REVIEW' : 'muted'}`} role="cell">
                {r.inReview}
              </span>
              <span className="mono st-DONE" role="cell">
                {r.done}
              </span>
              <span
                className={`mono contrib-hide-sm contrib-hide-md ${r.overdue ? 'st-OVERDUE' : 'muted'}`}
                role="cell"
              >
                {r.overdue}
              </span>
              <span role="cell">
                <span className="mono contrib-pct">{r.assigned ? `${r.completion}%` : '–'}</span>
                <span className="progress contrib-bar" style={{ display: 'block' }}>
                  <span style={{ width: `${r.completion}%`, background: '#16a34a' }} />
                </span>
              </span>
              <span
                className="mono contrib-hide-sm"
                role="cell"
                title={`${r.attendance.attended} dari ${r.attendance.recorded} rapat hadir`}
              >
                {r.attendance.recorded ? `${Math.round((r.attendance.attended / r.attendance.recorded) * 100)}%` : '–'}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
