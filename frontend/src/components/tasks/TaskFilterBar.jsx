import { useState } from 'react';
import { ChevronDown, Flag, Search, X } from 'lucide-react';
import { Avatar, Menu } from '../ui';
import { PRIORITY } from '../../lib/status';
import { addDays, sameDay, startOfDay } from '../../lib/format';

export const NO_TASK_FILTERS = {
  roles: [],
  people: [],
  priorities: [],
  milestones: [],
  due: '',
};

const DUE_OPTIONS = [
  ['', 'Any due date'],
  ['overdue', 'Overdue'],
  ['today', 'Due today'],
  ['week', 'Due this week'],
  ['none', 'No due date'],
];

const toggleIn = (list, value, on) => (on ? [...list, value] : list.filter((x) => x !== value));

// Satu tugas lolos bila memenuhi semua filter yang aktif (filter kosong = tidak membatasi).
export function applyTaskFilters(tasks, f, { members, query }) {
  const today = startOfDay();
  const weekStart = addDays(today, -((today.getDay() + 6) % 7));
  const weekEnd = addDays(weekStart, 7);
  const roleOf = (id) => members.find((m) => m.id === id)?.role?.name;
  const q = query.trim().toLowerCase();

  return tasks.filter((t) => {
    if (q && !`${t.title} ${t.description ?? ''}`.toLowerCase().includes(q)) return false;
    if (f.roles.length && !t.assignees.some((a) => f.roles.includes(roleOf(a.id)))) return false;
    if (f.people.length && !t.assignees.some((a) => f.people.includes(a.id))) return false;
    if (f.priorities.length && !f.priorities.includes(t.priority)) return false;
    if (f.milestones.length && !f.milestones.includes(t.milestone?.id ?? 'none')) return false;
    if (f.due) {
      const due = t.dueDate ? new Date(t.dueDate) : null;
      if (f.due === 'overdue' && !t.isOverdue) return false;
      if (f.due === 'today' && !(due && sameDay(due, today))) return false;
      if (f.due === 'week' && !(due && due >= weekStart && due < weekEnd)) return false;
      if (f.due === 'none' && due) return false;
    }
    return true;
  });
}

export const countTaskFilters = (f) =>
  f.roles.length + f.people.length + f.priorities.length + f.milestones.length + (f.due ? 1 : 0);

function Dropdown({ label, count, active, width = 220, children }) {
  return (
    <Menu
      align="left"
      width={width}
      trigger={({ toggle, open }) => (
        <button
          type="button"
          className={`btn filter-btn ${count || active ? 'active' : ''}`}
          onClick={toggle}
          aria-expanded={open}
        >
          {label}
          {count ? <span className="filter-count">{count}</span> : null}
          <ChevronDown size={14} />
        </button>
      )}
    >
      <div className="filter-pop" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </Menu>
  );
}

function CheckList({ items, selected, onChange }) {
  return items.map(({ value, label, icon }) => (
    <label key={value} className="check">
      <input
        type="checkbox"
        checked={selected.includes(value)}
        onChange={(e) => onChange(toggleIn(selected, value, e.target.checked))}
      />
      {icon}
      <span className="grow filter-label">{label}</span>
    </label>
  ));
}

// Dropdown Role dan Assignee dipakai bersama oleh Tasks dan Overview.
export function RoleFilter({ members, value, onChange }) {
  const roles = [...new Set(members.map((m) => m.role?.name).filter(Boolean))];
  return (
    <Dropdown label="Role" count={value.length}>
      {roles.length ? (
        <CheckList items={roles.map((r) => ({ value: r, label: r }))} selected={value} onChange={onChange} />
      ) : (
        <span className="xs muted">Belum ada role</span>
      )}
    </Dropdown>
  );
}

export function AssigneeFilter({ members, value, onChange, label = 'Assignee' }) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const people = members.filter((m) => !q || m.name.toLowerCase().includes(q));
  return (
    <Dropdown label={label} count={value.length} width={250}>
      <input
        className="input"
        type="search"
        placeholder="Search member..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Cari anggota"
      />
      <div className="contrib-people">
        <CheckList
          items={people.map((m) => ({ value: m.id, label: m.name, icon: <Avatar user={m} size={20} /> }))}
          selected={value}
          onChange={onChange}
        />
        {people.length === 0 && <span className="xs muted">Tidak ditemukan</span>}
      </div>
    </Dropdown>
  );
}

// Bar filter Tasks: setiap kategori punya tombol sendiri, sejajar dengan pencarian.
export default function TaskFilterBar({ query, onQuery, filters, onChange, members, milestones }) {
  const set = (key) => (value) => onChange({ ...filters, [key]: value });
  const active = countTaskFilters(filters);

  return (
    <div className="filter-bar">
      {active > 0 && (
        <button type="button" className="btn btn-sm filter-clear" onClick={() => onChange(NO_TASK_FILTERS)}>
          <X size={12} />
          Clear
        </button>
      )}

      <RoleFilter members={members} value={filters.roles} onChange={set('roles')} />
      <AssigneeFilter members={members} value={filters.people} onChange={set('people')} />

      <Dropdown label="Priority" count={filters.priorities.length}>
        <CheckList
          items={Object.entries(PRIORITY).map(([k, v]) => ({
            value: k,
            label: v.label,
            icon: <Flag size={13} fill={v.color} color={v.color} />,
          }))}
          selected={filters.priorities}
          onChange={set('priorities')}
        />
      </Dropdown>

      <Dropdown label="Milestone" count={filters.milestones.length} width={240}>
        <div className="contrib-people">
          <CheckList
            items={[
              ...(milestones ?? []).map((m) => ({ value: m.id, label: m.name })),
              { value: 'none', label: 'No milestone' },
            ]}
            selected={filters.milestones}
            onChange={set('milestones')}
          />
        </div>
      </Dropdown>

      <Dropdown label={DUE_OPTIONS.find(([v]) => v === filters.due)[1]} active={!!filters.due}>
        {DUE_OPTIONS.map(([value, label]) => (
          <label key={value || 'any'} className="check">
            <input type="radio" name="due-filter" checked={filters.due === value} onChange={() => set('due')(value)} />
            {label}
          </label>
        ))}
      </Dropdown>

      <div className="input-icon filter-search">
        <Search size={14} />
        <input
          className="input"
          placeholder="Search tasks..."
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          aria-label="Cari tugas"
        />
      </div>
    </div>
  );
}
