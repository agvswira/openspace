import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Mail, Lock, User, Building2, MailCheck, Lock as LockIcon, CircleCheck, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Field, FormError } from '../components/ui';

function AuthShell({ children }) {
  return (
    <div className="auth">
      <section className="auth-hero">
        <div className="auth-logo">
          <img src="/logo.png" height="44" alt="Logo Openspace" style={{ width: 'auto' }} />
        </div>
        <div className="auth-brand">Openspace</div>
        <p className="auth-tagline">Tasks, meetings and milestones for your team, connected in one place.</p>
        <div className="card auth-preview card-pad" aria-hidden>
          <div className="row-between xs" style={{ marginBottom: 10 }}>
            <span className="row" style={{ fontWeight: 600 }}>
              <span
                className="project-dot"
                style={{ background: 'var(--primary)', width: 16, height: 16, fontSize: 9 }}
              >
                ✱
              </span>
              Penyelenggaraan kegiatan
            </span>
            <span className="muted">This week</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="badge bg-DONE st-DONE" style={{ width: 150 }}>
              <CircleCheck size={12} />
              Desain poster
            </span>
            <span className="badge bg-IN_PROGRESS st-IN_PROGRESS" style={{ width: 170, marginLeft: 60 }}>
              Persetujuan desain
            </span>
            <span className="badge bg-BLOCKED st-BLOCKED" style={{ width: 170, marginLeft: 150 }}>
              <LockIcon size={12} />
              Pencetakan materi
            </span>
          </div>
          <p className="xs muted" style={{ marginTop: 12 }}>
            Printing waits for design approval, so nobody starts too early.
          </p>
        </div>
      </section>
      <section className="auth-form-wrap">{children}</section>
    </div>
  );
}

export function SignIn() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Format email tidak valid.';
    if (!form.password) errs.password = 'Password wajib diisi.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setError('');
    try {
      await login(form.email, form.password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <form className="auth-form" onSubmit={submit} noValidate>
        <div>
          <h1>Welcome to Openspace</h1>
          <p className="muted sm" style={{ marginTop: 4 }}>
            Continue to your workspace.
          </p>
        </div>
        <Field label="Email" error={errors.email} htmlFor="email">
          <div className="input-icon">
            <Mail size={15} />
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="name@example.com"
            />
          </div>
        </Field>
        <Field label="Password" error={errors.password} htmlFor="password">
          <div className="input-icon">
            <Lock size={15} />
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
            />
          </div>
        </Field>
        <div style={{ textAlign: 'right', marginTop: -8 }}>
          <Link to="/forgot-password" className="link sm">
            Forgot password?
          </Link>
        </div>
        <FormError message={error} />
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="sm muted" style={{ textAlign: 'center' }}>
          New to Openspace?{' '}
          <Link to="/signup" className="link">
            Create an account
          </Link>
        </p>
        <p className="xs faint" style={{ textAlign: 'center' }}>
          Demo: wira@openspace.example / password123
        </p>
      </form>
    </AuthShell>
  );
}

export function SignUp() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', workspaceName: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (form.name.trim().length < 2) errs.name = 'Nama minimal 2 karakter.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Format email tidak valid.';
    if (form.password.length < 8) errs.password = 'Password minimal 8 karakter.';
    if (form.workspaceName.trim().length < 2) errs.workspaceName = 'Nama workspace minimal 2 karakter.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setError('');
    try {
      await register(form);
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <form className="auth-form" onSubmit={submit} noValidate>
        <div>
          <h1>Create your account</h1>
          <p className="muted sm" style={{ marginTop: 4 }}>
            You will also create a workspace for your team.
          </p>
        </div>
        <Field label="Full name" error={errors.name} htmlFor="name">
          <div className="input-icon">
            <User size={15} />
            <input id="name" className="input" value={form.name} onChange={set('name')} />
          </div>
        </Field>
        <Field label="Email" error={errors.email} htmlFor="email">
          <div className="input-icon">
            <Mail size={15} />
            <input id="email" type="email" className="input" value={form.email} onChange={set('email')} />
          </div>
        </Field>
        <Field label="Password" error={errors.password} hint="At least 8 characters." htmlFor="pw">
          <div className="input-icon">
            <Lock size={15} />
            <input id="pw" type="password" className="input" value={form.password} onChange={set('password')} />
          </div>
        </Field>
        <Field label="Workspace name" error={errors.workspaceName} htmlFor="ws">
          <div className="input-icon">
            <Building2 size={15} />
            <input
              id="ws"
              className="input"
              value={form.workspaceName}
              onChange={set('workspaceName')}
              placeholder="e.g. Kelompok 3"
            />
          </div>
        </Field>
        <FormError message={error} />
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <p className="sm muted" style={{ textAlign: 'center' }}>
          Already have an account?{' '}
          <Link to="/signin" className="link">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Format email tidak valid.');
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <AuthShell>
      {sent ? (
        <div className="auth-form" style={{ textAlign: 'center', alignItems: 'center' }}>
          <div className="empty-icon" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>
            <MailCheck size={20} />
          </div>
          <h1>Check your email</h1>
          <p className="sm muted">
            If <strong>{email}</strong> is registered, a reset link valid for 30 minutes is on its way. (Mode
            pengembangan: tautan dicetak di terminal backend.)
          </p>
          <Link to="/signin" className="btn btn-block">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form className="auth-form" onSubmit={submit} noValidate>
          <div>
            <h1>Forgot password?</h1>
            <p className="muted sm" style={{ marginTop: 4 }}>
              Enter your email and we will send a reset link.
            </p>
          </div>
          <Field label="Email" htmlFor="email">
            <div className="input-icon">
              <Mail size={15} />
              <input
                id="email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </Field>
          <FormError message={error} />
          <button className="btn btn-primary btn-block">Send reset link</button>
          <p className="sm" style={{ textAlign: 'center' }}>
            <Link to="/signin" className="link">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) return setError('Password minimal 8 karakter.');
    if (password !== confirm) return setError('Konfirmasi password tidak sama.');
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => navigate('/signin'), 1500);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <AuthShell>
      <form className="auth-form" onSubmit={submit} noValidate>
        <h1>Set a new password</h1>
        <Field label="New password" htmlFor="np">
          <input
            id="np"
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label="Confirm password" htmlFor="cp">
          <input
            id="cp"
            type="password"
            className="input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <FormError message={error} />
        {done && <p className="sm st-DONE">Password diperbarui. Mengarahkan ke halaman login…</p>}
        <button className="btn btn-primary btn-block" disabled={done}>
          Update password
        </button>
      </form>
    </AuthShell>
  );
}

// Penerimaan undangan proyek dari tautan email.
export function AcceptInvite() {
  const { token } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const {
    data: inv,
    isLoading,
    error: loadError,
  } = useQuery({ queryKey: ['invite', token], queryFn: () => api.get(`/invitations/${token}`).then((r) => r.data) });

  const accept = async () => {
    try {
      const { data } = await api.post(`/invitations/${token}/accept`);
      navigate(`/projects/${data.projectId}/overview`);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <AuthShell>
      <div className="auth-form">
        <div className="empty-icon" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>
          <Users size={20} />
        </div>
        {isLoading && <p className="sm muted">Memuat undangan…</p>}
        {loadError && <FormError message={errorMessage(loadError)} />}
        {inv && (
          <>
            <h1>Join {inv.project.name}</h1>
            <p className="sm muted">
              Undangan untuk <strong>{inv.email}</strong> sebagai <strong>{inv.role.name}</strong>.
            </p>
            {inv.status !== 'PENDING' ? (
              <FormError message="Undangan ini sudah tidak berlaku." />
            ) : user ? (
              <button className="btn btn-primary btn-block" onClick={accept}>
                Accept invitation
              </button>
            ) : (
              <div className="row">
                <Link to="/signin" state={{ from: `/invite/${token}` }} className="btn btn-primary grow">
                  Sign in
                </Link>
                <Link to="/signup" className="btn grow">
                  Create account
                </Link>
              </div>
            )}
            <FormError message={error} />
          </>
        )}
      </div>
    </AuthShell>
  );
}
