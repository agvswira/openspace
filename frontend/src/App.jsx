import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import { SignIn, SignUp, ForgotPassword, ResetPassword, AcceptInvite } from './pages/AuthPages';
import Home from './pages/Home';
import MyTasks from './pages/MyTasks';
import Overview from './pages/Overview';
import Tasks from './pages/Tasks';
import Milestones, { MilestoneDetail } from './pages/Milestones';
import Meetings from './pages/Meetings';
import Members from './pages/Members';
import Roles from './pages/Roles';
import { ProjectSettings, WorkspaceSettings } from './pages/Settings';

// Rute yang memerlukan login; pengunjung diarahkan ke halaman Sign in.
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
        <div className="spinner" />
      </div>
    );
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
  );
}
