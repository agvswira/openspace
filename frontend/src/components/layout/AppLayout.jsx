import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useMatch, useNavigate, Link } from 'react-router-dom';
import {
  Home,
  SquareCheckBig,
  Plus,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  Kanban,
  Flag,
  CalendarDays,
  Users,
  Settings,
  Search,
  Share2,
  Bell,
  ChevronLeft,
  ChevronsUpDown,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useProjects, useProject, useSummary } from '../../api/hooks';
import { Avatar, Menu, ProjectMark } from '../ui';
import SearchDialog from './SearchDialog';
import NotificationsMenu from './NotificationsMenu';
import NewProjectModal from './NewProjectModal';
import InviteModal from '../InviteModal';

const PROJECT_NAV = [
  { to: 'overview', label: 'Overview', Icon: LayoutGrid },
  { to: 'tasks', label: 'Tasks', Icon: Kanban },
  { to: 'milestones', label: 'Milestones', Icon: Flag },
  { to: 'meetings', label: 'Meetings', Icon: CalendarDays },
  { to: 'members', label: 'Members', Icon: Users },
  { to: 'settings', label: 'Settings', Icon: Settings },
];

function Sidebar({ onSearch, onNewProject }) {
  const { user, workspace, logout } = useAuth();
  const { data: projects = [] } = useProjects();
  const { data: summary } = useSummary();
  const match = useMatch('/projects/:projectId/*');
  const activeId = match?.params.projectId;
  const [expanded, setExpanded] = useState({});
  const isOpen = (id) => expanded[id] ?? id === activeId;
  const navigate = useNavigate();

  return (
    <aside className="sidebar" aria-label="Navigasi utama">
      <div className="ws-switch">
        <span className="ws-logo">
          <img src="/logo.png" height="20" alt="" style={{ width: 'auto' }} />
        </span>
        <div className="grow">
          <div className="ws-name truncate">Openspace</div>
          <div className="xs muted truncate">{workspace?.name || 'Workspace'} · Team</div>
        </div>
        <ChevronsUpDown size={14} className="faint" />
      </div>

      <button className="search-trigger" onClick={onSearch}>
        <Search size={15} /> Search <span className="kbd">⌘K</span>
      </button>

      <div className="nav-section">
        <div className="nav-title">General</div>
        <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Home size={16} />
          Home
        </NavLink>
        <NavLink to="/my-tasks" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <SquareCheckBig size={16} />
          My tasks<span className="count">{summary?.openTasks ?? ''}</span>
        </NavLink>
      </div>

      <div className="nav-section">
        <div className="nav-title">
          Projects
          <button
            className="icon-btn"
            style={{ width: 22, height: 22 }}
            onClick={onNewProject}
            aria-label="Buat proyek baru"
          >
            <Plus size={14} />
          </button>
        </div>
        {projects.map((p) => (
          <div key={p.id}>
            <button
              className={`nav-item ${p.id === activeId && !isOpen(p.id) ? 'active' : ''}`}
              onClick={() => {
                setExpanded((e) => ({ ...e, [p.id]: !isOpen(p.id) }));
                if (p.id !== activeId) navigate(`/projects/${p.id}/overview`);
              }}
              aria-expanded={isOpen(p.id)}
            >
              <ProjectMark project={p} />
              <span className="grow truncate" style={{ fontWeight: 500 }}>
                {p.name}
              </span>
              {isOpen(p.id) ? (
                <ChevronDown size={14} className="faint" />
              ) : (
                <ChevronRight size={14} className="faint" />
              )}
            </button>
            {isOpen(p.id) && (
              <div className="nav-sub">
                {PROJECT_NAV.map(({ to, label, Icon }) => (
                  <NavLink
                    key={to}
                    to={`/projects/${p.id}/${to}`}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={15} />
                    {label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Settings size={16} />
          Workspace settings
        </NavLink>
        <Menu
          align="left"
          width={220}
          trigger={({ toggle }) => (
            <button className="account" onClick={toggle}>
              <Avatar user={user} size={30} />
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="sm truncate" style={{ display: 'block', fontWeight: 500 }}>
                  {user?.name}
                </span>
                <span className="xs muted truncate" style={{ display: 'block' }}>
                  {user?.email}
                </span>
              </span>
              <ChevronsUpDown size={14} className="faint" />
            </button>
          )}
        >
          <Link to="/settings" className="menu-item">
            <Settings size={14} />
            Profile & preferences
          </Link>
          <button
            className="menu-item danger"
            onClick={() => {
              logout();
              navigate('/signin');
            }}
          >
            <LogOut size={14} />
            Log out
          </button>
        </Menu>
      </div>
    </aside>
  );
}

function Topbar({ onInvite }) {
  const { user, workspace } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const match = useMatch('/projects/:projectId/*');
  const { data: project } = useProject(match?.params.projectId);

  let crumbs;
  if (match) {
    crumbs = (
      <>
        <span>Projects</span>
        <ChevronRight size={14} />
        <span className="current">
          <ProjectMark project={project} />
          {project?.name ?? '…'}
        </span>
      </>
    );
  } else {
    const page = { '/my-tasks': 'My tasks', '/settings': 'Workspace settings' }[location.pathname];
    crumbs = (
      <>
        <span>Workspace</span>
        <ChevronRight size={14} />
        <span className="current">
          {page ?? (
            <>
              <ProjectMark size={18} />
              {workspace?.name}
            </>
          )}
        </span>
      </>
    );
  }

  return (
    <header className="topbar">
      <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Kembali">
        <ChevronLeft size={16} />
      </button>
      <nav className="crumbs" aria-label="Breadcrumb">
        {crumbs}
      </nav>
      <div className="topbar-actions">
        {/* Di proyek: undang anggota (Owner). Di halaman workspace: salin tautan halaman. */}
        {(!match || project?.access?.isOwner) && (
          <button
            className="icon-btn"
            onClick={() => {
              if (match) return onInvite();
              navigator.clipboard?.writeText(window.location.href);
              toast('Tautan halaman disalin');
            }}
            aria-label={match ? 'Bagikan proyek' : 'Salin tautan halaman'}
            title={match ? 'Share project' : 'Copy link'}
          >
            <Share2 size={16} />
          </button>
        )}
        <NotificationsMenu
          trigger={({ toggle, unread }) => (
            <button
              className={`icon-btn ${unread ? 'dot-badge' : ''}`}
              onClick={toggle}
              aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ''}`}
            >
              <Bell size={16} />
            </button>
          )}
        />
        <Avatar user={user} size={28} />
      </div>
    </header>
  );
}

export default function AppLayout() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [newProject, setNewProject] = useState(false);
  const [invite, setInvite] = useState(false);
  const match = useMatch('/projects/:projectId/*');

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <Sidebar onSearch={() => setSearchOpen(true)} onNewProject={() => setNewProject(true)} />
      <main className="main">
        <Topbar onInvite={() => setInvite(true)} />
        <div className="content">
          <Outlet context={{ openNewProject: () => setNewProject(true), openInvite: () => setInvite(true) }} />
        </div>
      </main>
      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
      {newProject && <NewProjectModal onClose={() => setNewProject(false)} />}
      {invite && match && <InviteModal projectId={match.params.projectId} onClose={() => setInvite(false)} />}
    </div>
  );
}
