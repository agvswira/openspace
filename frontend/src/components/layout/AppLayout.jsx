import { useEffect, useRef, useState } from 'react';
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
  Menu as MenuIcon,
  X,
  Inbox,
  CircleUser,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useProjects, useProject, useSummary } from '../../api/hooks';
import { Avatar, Menu, ProjectMark } from '../ui';
import SearchDialog from './SearchDialog';
import NotificationsMenu from './NotificationsMenu';
import NewProjectModal from './NewProjectModal';
import InviteModal from '../InviteModal';
import { ThemeSwitcher, ThemeToggleButton } from '../ThemeSwitcher';
import { useMenuBinder } from '../ui/ContextMenu';
import { useProjectMenu } from './projectMenu';

const PROJECT_NAV = [
  { to: 'overview', label: 'Overview', Icon: LayoutGrid },
  { to: 'tasks', label: 'Tasks', Icon: Kanban },
  { to: 'milestones', label: 'Milestones', Icon: Flag },
  { to: 'meetings', label: 'Meetings', Icon: CalendarDays },
  { to: 'members', label: 'Members', Icon: Users },
  { to: 'settings', label: 'Settings', Icon: Settings },
];

function Sidebar({ onSearch, onNewProject, open, onClose }) {
  const { user, workspace, logout } = useAuth();
  const { data: projects = [] } = useProjects();
  const { data: summary } = useSummary();
  const match = useMatch('/projects/:projectId/*');
  const activeId = match?.params.projectId;
  const [expanded, setExpanded] = useState({});
  const isOpen = (id) => expanded[id] ?? id === activeId;
  const navigate = useNavigate();
  const bind = useMenuBinder();
  const projectMenu = useProjectMenu();

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Navigasi utama">
      <button className="icon-btn mobile-only sidebar-close" onClick={onClose} aria-label="Tutup menu">
        <X size={16} />
      </button>
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
              {...bind(() => projectMenu(p))}
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
          width="100%"
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
          <div className="menu-label">Theme</div>
          <div style={{ padding: '0 6px 6px' }}>
            <ThemeSwitcher />
          </div>
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

function Topbar({ onInvite, onMenu }) {
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
      <button className="icon-btn mobile-only" onClick={onMenu} aria-label="Buka menu navigasi">
        <MenuIcon size={18} />
      </button>
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
        <ThemeToggleButton />
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
        <span className="desktop-only">
          <Avatar user={user} size={28} />
        </span>
      </div>
    </header>
  );
}

// Tab proyek yang dapat digeser horizontal (hanya tampil di layar kecil, Figma "M / Overview").
function ProjectTabs({ projectId }) {
  const ref = useRef(null);
  const { pathname } = useLocation();
  // Tab aktif digeser ke tengah agar terlihat walau berada di ujung daftar.
  useEffect(() => {
    ref.current?.querySelector('.mobile-tab.active')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [pathname]);
  return (
    <nav ref={ref} className="mobile-tabs mobile-only" aria-label="Navigasi proyek">
      {PROJECT_NAV.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={`/projects/${projectId}/${to}`}
          className={({ isActive }) => `mobile-tab ${isActive ? 'active' : ''}`}
        >
          <Icon size={14} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

// Navigasi bawah untuk ponsel: Home, My tasks, Search, Inbox, Account (Figma Screens · Mobile).
function BottomNav({ onSearch, onMenu }) {
  const { user } = useAuth();
  const { data: summary } = useSummary();
  const item = ({ isActive }) => `bnav-item ${isActive ? 'active' : ''}`;
  return (
    <nav className="bottom-nav mobile-only" aria-label="Navigasi bawah">
      <NavLink to="/" end className={item}>
        <Home size={20} />
        Home
      </NavLink>
      <NavLink to="/my-tasks" className={item}>
        <SquareCheckBig size={20} />
        My tasks
        {summary?.openTasks ? <span className="bnav-count">{summary.openTasks}</span> : null}
      </NavLink>
      <button className="bnav-item" onClick={onSearch}>
        <Search size={20} />
        Search
      </button>
      <NotificationsMenu
        trigger={({ toggle, unread }) => (
          <button className="bnav-item" onClick={toggle}>
            <Inbox size={20} />
            Inbox
            {unread ? <span className="bnav-count">{unread}</span> : null}
          </button>
        )}
      />
      <button className="bnav-item" onClick={onMenu}>
        {user ? <Avatar user={user} size={20} /> : <CircleUser size={20} />}
        Account
      </button>
    </nav>
  );
}

export default function AppLayout() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [newProject, setNewProject] = useState(false);
  const [invite, setInvite] = useState(false);
  const match = useMatch('/projects/:projectId/*');
  const location = useLocation();
  // Layar kecil: sidebar menjadi laci (drawer) yang ditutup otomatis saat pindah halaman.
  const [navOpen, setNavOpen] = useState(false);
  const [navPath, setNavPath] = useState(location.pathname);
  if (navPath !== location.pathname) {
    setNavPath(location.pathname);
    setNavOpen(false);
  }

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
      <Sidebar
        open={navOpen}
        onClose={() => setNavOpen(false)}
        onSearch={() => setSearchOpen(true)}
        onNewProject={() => setNewProject(true)}
      />
      {navOpen && <div className="sidebar-backdrop" onClick={() => setNavOpen(false)} />}
      <main className="main">
        <Topbar onInvite={() => setInvite(true)} onMenu={() => setNavOpen(true)} />
        {match && <ProjectTabs projectId={match.params.projectId} />}
        <div className="content">
          <Outlet context={{ openNewProject: () => setNewProject(true), openInvite: () => setInvite(true) }} />
        </div>
      </main>
      <BottomNav onSearch={() => setSearchOpen(true)} onMenu={() => setNavOpen(true)} />
      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
      {newProject && <NewProjectModal onClose={() => setNewProject(false)} />}
      {invite && match && <InviteModal projectId={match.params.projectId} onClose={() => setInvite(false)} />}
    </div>
  );
}
