import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';

const SignIn = lazy(() => import('./pages/AuthPages').then((m) => ({ default: m.SignIn })));
const SignUp = lazy(() => import('./pages/AuthPages').then((m) => ({ default: m.SignUp })));
const ForgotPassword = lazy(() => import('./pages/AuthPages').then((m) => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./pages/AuthPages').then((m) => ({ default: m.ResetPassword })));
const AcceptInvite = lazy(() => import('./pages/AuthPages').then((m) => ({ default: m.AcceptInvite })));
const Home = lazy(() => import('./pages/Home'));
const MyTasks = lazy(() => import('./pages/MyTasks'));
const Overview = lazy(() => import('./pages/Overview'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Milestones = lazy(() => import('./pages/Milestones'));
const MilestoneDetail = lazy(() => import('./pages/Milestones').then((m) => ({ default: m.MilestoneDetail })));
const Meetings = lazy(() => import('./pages/Meetings'));
const Members = lazy(() => import('./pages/Members'));
const Roles = lazy(() => import('./pages/Roles'));
const ProjectSettings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.ProjectSettings })));
const WorkspaceSettings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.WorkspaceSettings })));

function PageLoader() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
      <progress className="loading-spinner" aria-label="Memuat halaman" />
    </div>
  );
}

// Rute yang memerlukan login; pengunjung diarahkan ke halaman Sign in.
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route
          path="/signin"
          element={
            <GuestOnly>
              <SignIn />
            </GuestOnly>
          }
        />
        <Route
          path="/signup"
          element={
            <GuestOnly>
              <SignUp />
            </GuestOnly>
          }
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/invite/:token" element={<AcceptInvite />} />

        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Home />} />
          <Route path="my-tasks" element={<MyTasks />} />
          <Route path="settings" element={<WorkspaceSettings />} />
          <Route path="projects/:projectId">
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<Overview />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="milestones" element={<Milestones />} />
            <Route path="milestones/:milestoneId" element={<MilestoneDetail />} />
            <Route path="meetings" element={<Meetings />} />
            <Route path="members" element={<Members />} />
            <Route path="roles" element={<Roles />} />
            <Route path="settings" element={<ProjectSettings />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
