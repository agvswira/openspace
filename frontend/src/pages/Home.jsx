import { useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { UserPlus, Plus, ArrowRight, Users, CalendarDays, CircleDot, MoreHorizontal } from 'lucide-react';
import { useMyTasks, useProjects, useSummary } from '../api/hooks';
import { useAuth } from '../context/AuthContext';
import { AvatarStack, ErrorState, LoadingBlock, ProgressRing, ProjectMark } from '../components/ui';
import { StatusBadge } from '../lib/status';
import { addDays, fmtLong, greeting, startOfDay } from '../lib/format';
import TaskRow from '../components/tasks/TaskRow';

const PROJECT_STATUS = { TODO: 'TODO', IN_PROGRESS: 'IN_PROGRESS', DONE: 'DONE' };

export default function Home() {
  const { user } = useAuth();
  const { openNewProject } = useOutletContext();
  const navigate = useNavigate();
  const projects = useProjects();
  const myTasks = useMyTasks('open');
  const completed = useMyTasks('completed');
  const [showAll, setShowAll] = useState(false);
  // Senin minggu ini: tugas selesai sejak awal minggu ikut tampil (dicentang).
  const weekAgo = addDays(startOfDay(), -((new Date().getDay() + 6) % 7)).getTime();
  // Figma: tugas terbuka ditambah tugas yang baru selesai minggu ini (dicentang dan dicoret).
  const homeTasks = [
    ...(myTasks.data ?? []),
    ...(completed.data ?? []).filter((t) => t.completedAt && new Date(t.completedAt).getTime() >= weekAgo),
  ].slice(0, 6);
  const visibleProjects = showAll ? projects.data : projects.data?.slice(0, 2);
  const { data: summary } = useSummary();
  const today = new Date()
    .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    .replace(' ', ', ');

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">
            {greeting()}, {user.name}
          </h1>
          <p className="page-sub">
            {today} · {summary?.overdue ?? 0} task{summary?.overdue === 1 ? '' : 's'} overdue,{' '}
            {summary?.meetingsToday ?? 0} meeting{summary?.meetingsToday === 1 ? '' : 's'} today
          </p>
        </div>
        <div className="row">
          {projects.data?.[0] && (
            <button className="btn" onClick={() => navigate(`/projects/${projects.data[0].id}/members`)}>
              <UserPlus size={15} />
              Invite people
            </button>
          )}
          <button className="btn btn-primary" onClick={openNewProject}>
            <Plus size={15} />
            New project
          </button>
        </div>
      </div>

      <div className="row-between" style={{ marginBottom: 12 }}>
        <h2 className="card-title">Projects</h2>
        <button
          className="link sm row"
          style={{ color: 'var(--text-muted)', gap: 6, fontWeight: 400 }}
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
        >
          <ArrowRight size={14} />
          {showAll && projects.data?.length > 2 ? 'Show less' : 'View all'}
        </button>
      </div>
      {projects.isLoading ? (
        <LoadingBlock rows={1} height={170} />
      ) : projects.error ? (
        <ErrorState error={projects.error} onRetry={projects.refetch} />
      ) : (
        <div className="project-grid">
          {visibleProjects.map((p) => (
            <Link
              key={p.id}
              to={`/projects/${p.id}/overview`}
              className="card project-card"
              style={{ boxShadow: 'var(--shadow-sm)' }}
            >
              <div className="row">
                <ProjectMark project={p} size={32} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }} className="truncate">
                    {p.name}
                  </div>
                  <div className="xs muted truncate">{p.description}</div>
                </div>
                <ProgressRing percent={p.progress.percent ?? 0} />
                <MoreHorizontal size={16} className="faint" />
              </div>
              <dl className="kv">
                <dt>
                  <Users size={14} />
                  Members
                </dt>
                <dd>
                  <AvatarStack users={p.members} size={22} />
                </dd>
                <dt>
                  <CalendarDays size={14} />
                  Due date
                </dt>
                <dd>{p.dueDate ? fmtLong(p.dueDate) : <span className="muted">No due date</span>}</dd>
                <dt>
                  <CircleDot size={14} />
                  Status
                </dt>
                <dd>
                  <StatusBadge status={PROJECT_STATUS[p.status]} plain />
                </dd>
              </dl>
              <div>
                <div className="row-between xs muted" style={{ marginBottom: 6 }}>
                  <span>
                    {p.progress.total ? `${p.progress.done} of ${p.progress.total} tasks done` : 'No tasks yet'}
                  </span>
                  <span className="mono">{p.progress.percent ?? 0}%</span>
                </div>
                <div className="progress">
                  <span style={{ width: `${p.progress.percent ?? 0}%` }} />
                </div>
              </div>
            </Link>
          ))}
          <button
            className="card project-card"
            onClick={openNewProject}
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              borderStyle: 'dashed',
              cursor: 'pointer',
              background: 'var(--bg-subtle)',
              minHeight: 170,
            }}
          >
            <span className="empty-icon" style={{ background: '#fff', border: '1px solid var(--border)' }}>
              <Plus size={18} />
            </span>
            <strong className="sm">New project</strong>
            <span className="xs muted">Start from a template or blank.</span>
          </button>
        </div>
      )}

      <div className="row-between" style={{ margin: '28px 0 12px' }}>
        <h2 className="card-title">My tasks</h2>
        <Link to="/my-tasks" className="sm muted row">
          <ArrowRight size={14} />
          Open My tasks
        </Link>
      </div>
      <div className="card">
        {myTasks.isLoading && (
          <div className="card-pad">
            <LoadingBlock rows={3} height={36} />
          </div>
        )}
        {!myTasks.isLoading && homeTasks.length === 0 && (
          <p className="sm muted card-pad">Tidak ada tugas untuk Anda saat ini.</p>
        )}
        {homeTasks.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
      </div>
    </div>
  );
}
