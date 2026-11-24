import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ListChecks, CircleAlert, Lock, Plus, UserPlus, Check, X, Flag } from 'lucide-react';
import { useMeetings, useOverview, useProject, useTasks } from '../api/hooks';
import { AvatarStack, EmptyState, ErrorState, LoadingBlock } from '../components/ui';
import { StatusBadge, StatusIcon, displayState } from '../lib/status';
import { addDays, fmtLong, fmtShort, relativeDue, startOfDay } from '../lib/format';
import TaskFormModal from '../components/tasks/TaskFormModal';
import ContributionPanel from '../components/overview/ContributionPanel';
import MeetingAttendance from '../components/overview/MeetingAttendance';
import { useCan } from '../components/tasks/TaskDetailPanel';

// Pie (donut) chart sederhana untuk komposisi status tugas.
function StatusPie({ parts, size = 120, label }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  const r = 16;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label={`Task status ${label}`}>
      <circle cx="20" cy="20" r={r} fill="none" stroke="var(--bg-muted)" strokeWidth="7" />
      {total > 0 &&
        parts.map((p, i) => {
          if (!p.value) return null;
          const len = (p.value / total) * c;
          const el = (
            <circle
              key={i}
              cx="20"
              cy="20"
              r={r}
              fill="none"
              stroke={p.color}
              strokeWidth="7"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 20 20)"
            />
          );
          offset += len;
          return el;
        })}
      <text x="20" y="21.5" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="var(--text)">
        {label}
      </text>
    </svg>
  );
}

// FR-18: panduan langkah awal setelah proyek dibuat.
function Onboarding({ project, onInvite, onTask, onClose }) {
  const steps = [
    { done: true, label: 'Create the project', desc: 'Name, color and description are set.' },
    {
      done: project.members.length > 1,
      label: 'Invite your team',
      desc: 'Invite members from the Members page.',
      action: (
        <button className="btn btn-sm" onClick={onInvite}>
          <UserPlus size={13} />
          Go to Members
        </button>
      ),
    },
    {
      done: project._count.tasks > 0,
      label: 'Create the first task',
      desc: 'Give it an owner and a due date.',
      action: (
        <button className="btn btn-sm btn-primary" onClick={onTask}>
          <Plus size={13} />
          New task
        </button>
      ),
    },
  ];
  return (
    <div
      className="card card-pad"
      style={{ marginBottom: 16, background: 'var(--primary-soft)', borderColor: 'var(--primary-border)' }}
    >
      <div className="row-between">
        <strong>Get started with {project.name}</strong>
        <button className="icon-btn" onClick={onClose} aria-label="Tutup panduan">
          <X size={15} />
        </button>
      </div>
      <div className="grid-2" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 12 }}>
        {steps.map((s, i) => (
          <div key={i} className="card card-pad row" style={{ alignItems: 'flex-start' }}>
            <span className={`stat-ic ${s.done ? 'bg-DONE st-DONE' : 'bg-TODO st-TODO'}`}>
              {s.done ? <Check size={15} /> : i + 1}
            </span>
            <div className="grow">
              <div className="sm" style={{ fontWeight: 500, textDecoration: s.done ? 'line-through' : undefined }}>
                {s.label}
              </div>
              <div className="xs muted" style={{ margin: '2px 0 8px' }}>
                {s.desc}
              </div>
              {!s.done && s.action}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Ringkasan status untuk kartu Task status. "This week" = tugas dengan deadline pada minggu ini (Senin–Minggu).
function statusSummary(tasks, scope) {
  const today = startOfDay();
  const from = addDays(today, -((today.getDay() + 6) % 7));
  const to = addDays(from, 7);
  const list =
    scope === 'all'
      ? tasks
      : tasks.filter((t) => !t.dueDate || (new Date(t.dueDate) >= from && new Date(t.dueDate) < to));
  const byStatus = { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 };
  list.forEach((t) => byStatus[t.status]++);
  return {
    total: list.length,
    byStatus,
    percent: list.length ? Math.round((byStatus.DONE / list.length) * 100) : 0,
    overdue: list.filter((t) => t.isOverdue).length,
    blocked: list.filter((t) => t.isBlocked && t.status !== 'DONE').length,
  };
}

export default function Overview() {
  const { projectId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const can = useCan(projectId);
  const { data: project } = useProject(projectId);
  const { data: o, isLoading, error, refetch } = useOverview(projectId);
  const { data: tasks = [] } = useTasks(projectId);
  const { data: meetings = [] } = useMeetings(projectId);
  const [scope, setScope] = useState('all');
  const [creating, setCreating] = useState(false);
  const [hideOnboarding, setHideOnboarding] = useState(false);
  const openTask = (id) => navigate(`/projects/${projectId}/tasks?task=${id}`);

  if (isLoading || !project)
    return (
      <div className="page">
        <LoadingBlock rows={4} height={110} />
      </div>
    );
  if (error)
    return (
      <div className="page">
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );

  const showOnboarding = !hideOnboarding && (params.get('onboarding') || project._count.tasks === 0);
  const st = statusSummary(tasks, scope);
  const pct = (n) => (st.total ? Math.round((n / st.total) * 100) : 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="page-sub">
            {project.name}
            {project.dueDate && ` · Due ${fmtLong(project.dueDate)}`}
          </p>
        </div>
        <div className="row">
          <AvatarStack users={project.members} size={28} />
          {can('CREATE_TASKS') && (
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              <Plus size={15} />
              New task
            </button>
          )}
        </div>
      </div>

      {showOnboarding && (
        <Onboarding
          project={project}
          onInvite={() => navigate(`/projects/${projectId}/members`)}
          onTask={() => setCreating(true)}
          onClose={() => {
            setHideOnboarding(true);
            params.delete('onboarding');
            setParams(params, { replace: true });
          }}
        />
      )}

      {o.total === 0 ? (
        <div className="card">
          <EmptyState icon={ListChecks} title="Belum ada tugas">
            Ringkasan progres, keterlambatan, dan beban kerja akan muncul setelah tugas pertama dibuat.
          </EmptyState>
        </div>
      ) : (
        <>
          <ContributionPanel
            tasks={tasks}
            members={project.members}
            meetings={meetings}
            onOpenMember={(m) => navigate(`/projects/${projectId}/tasks?view=list&assignee=${m.id}`)}
          />

          <div className="grid-2" style={{ marginTop: 14 }}>
            <section className="card">
              <div className="card-head">
                <div>
                  <span className="card-title">Task status</span>
                  <div className="row head-sub">
                    <span className="stat-num">{st.total}</span>
                    <span className="xs muted">tasks · {st.percent}% done</span>
                  </div>
                </div>
                <select
                  className="select select-sm"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  aria-label="Rentang tugas"
                >
                  <option value="week">This week</option>
                  <option value="all">All time</option>
                </select>
              </div>
              <div style={{ padding: '0 16px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div className="status-pie">
                  <StatusPie
                    size={200}
                    parts={[
                      ['DONE', '#16a34a'],
                      ['IN_REVIEW', '#9333ea'],
                      ['IN_PROGRESS', '#ea580c'],
                      ['TODO', '#2563eb'],
                    ].map(([k, color]) => ({ value: st.byStatus[k], color }))}
                    label={`${st.percent}%`}
                  />
                  <div className="legend">
                    {[
                      ['DONE', '#16a34a'],
                      ['IN_REVIEW', '#9333ea'],
                      ['IN_PROGRESS', '#ea580c'],
                      ['TODO', '#2563eb'],
                    ].map(([s, c]) => (
                      <div key={s} className="row sm" style={{ padding: '5px 0' }}>
                        <span style={{ width: 9, height: 9, borderRadius: 2, background: c }} />
                        <span className="grow">
                          {{ DONE: 'Done', IN_REVIEW: 'In review', IN_PROGRESS: 'In progress', TODO: 'To do' }[s]}
                        </span>
                        <span className="mono" style={{ width: 72, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {st.byStatus[s]} tasks
                        </span>
                        <span className="mono muted" style={{ width: 40, textAlign: 'right' }}>
                          {pct(st.byStatus[s])}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div
                  className="divider"
                  style={{
                    margin: 'auto 0 10px',
                    paddingTop: 10,
                    background: 'none',
                    borderTop: '1px solid var(--border)',
                  }}
                />
                <div className="row xs">
                  <span className="st-OVERDUE row" style={{ gap: 4 }}>
                    <CircleAlert size={12} />
                    {st.overdue} overdue
                  </span>
                  <span className="st-BLOCKED row" style={{ gap: 4 }}>
                    <Lock size={12} />
                    {st.blocked} blocked
                  </span>
                  <span className="grow" />
                  {project.dueDate && <span className="mono muted">Due {fmtLong(project.dueDate)}</span>}
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <span className="card-title">Next milestone</span>
                <Link to={`/projects/${projectId}/milestones`} className="btn btn-sm">
                  View all
                </Link>
              </div>
              {o.nextMilestone ? (
                <div style={{ padding: '0 16px 16px' }}>
                  <div className="row">
                    <span className="stat-ic" style={{ background: 'var(--purple-bg)', color: 'var(--purple)' }}>
                      <Flag size={15} />
                    </span>
                    <div className="grow">
                      <div className="sm" style={{ fontWeight: 600 }}>
                        {o.nextMilestone.name}
                      </div>
                      <div className="mono muted">
                        {o.nextMilestone.dueDate
                          ? `${fmtLong(o.nextMilestone.dueDate)} · ${relativeDue(o.nextMilestone.dueDate)}`
                          : 'No due date'}
                      </div>
                    </div>
                    <StatusBadge status={o.nextMilestone.progress.done ? 'IN_PROGRESS' : 'TODO'} plain />
                  </div>
                  <div className="row-between xs muted" style={{ margin: '12px 0 6px' }}>
                    <span>Progress</span>
                    <span className="mono">
                      {o.nextMilestone.progress.done} / {o.nextMilestone.progress.total} tasks
                    </span>
                  </div>
                  <div className="progress">
                    <span style={{ width: `${o.nextMilestone.progress.percent ?? 0}%`, background: 'var(--purple)' }} />
                  </div>
                  <div style={{ marginTop: 10 }}>
                    {o.nextMilestone.tasks.map((t) => (
                      <button
                        key={t.id}
                        className="row-between sm"
                        style={{
                          width: '100%',
                          padding: '6px 0',
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                        }}
                        onClick={() => openTask(t.id)}
                      >
                        <span>{t.title}</span>
                        <StatusBadge status={displayState(t)} plain />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState icon={Flag} title="Tidak ada milestone aktif" />
              )}
            </section>
          </div>

          <div style={{ marginTop: 14 }}>
            <section className="card">
              <div className="card-head">
                <span className="card-title">Needs attention</span>
                <span className="badge bg-OVERDUE st-OVERDUE">{o.needsAttention.length}</span>
              </div>
              {o.needsAttention.length === 0 && (
                <p className="sm muted" style={{ padding: '0 16px 16px' }}>
                  Tidak ada tugas yang terlambat atau terhambat.
                </p>
              )}
              {o.needsAttention.map((t) => {
                const st = displayState(t);
                return (
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
                    onClick={() => openTask(t.id)}
                  >
                    <span className={`stat-ic bg-${st} st-${st}`}>
                      <StatusIcon status={st} />
                    </span>
                    <div className="grow">
                      <div className="sm" style={{ fontWeight: 500 }}>
                        {t.title}
                      </div>
                      <div className="xs muted">
                        {st === 'BLOCKED'
                          ? `Waiting for ${t.waitingFor.map((w) => w.title).join(', ')}`
                          : `Overdue by ${relativeDue(t.dueDate).replace(' ago', '')}`}
                      </div>
                    </div>
                    <AvatarStack users={t.assignees} size={22} />
                    <span className={`mono ${t.isOverdue ? 'st-OVERDUE' : 'muted'}`} style={{ width: 56 }}>
                      {fmtShort(t.dueDate)}
                    </span>
                  </button>
                );
              })}
            </section>
          </div>

          <MeetingAttendance meetings={meetings} projectId={projectId} />
        </>
      )}
      {creating && <TaskFormModal projectId={projectId} onClose={() => setCreating(false)} />}
    </div>
  );
}
