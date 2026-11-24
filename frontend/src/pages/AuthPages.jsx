import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Mail,
  Lock,
  User,
  Building2,
  MailCheck,
  Lock as LockIcon,
  CircleCheck,
  Users,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Field, FormError } from '../components/ui';

function usePageTitle(title) {
  useEffect(() => {
    document.title = `${title} | Openspace`;
  }, [title]);
}

function PasswordInput({
  id,
  name,
  value,
  onChange,
  autoComplete,
  enterKeyHint,
  minLength,
  placeholder,
  invalid,
  describedBy,
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="input-icon input-pw">
      <Lock size={15} aria-hidden="true" />
      <input
        id={id}
        name={name}
        className="input"
        type={shown ? 'text' : 'password'}
        autoComplete={autoComplete}
        enterKeyHint={enterKeyHint}
        minLength={minLength}
        required
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy || undefined}
      />
      <button
        type="button"
        className="icon-btn pw-toggle"
        aria-pressed={shown}
        aria-label={shown ? 'Sembunyikan password' : 'Tampilkan password'}
        onClick={() => setShown((s) => !s)}
      >
        {shown ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
      </button>
    </div>
  );
}

function AuthShell({ children }) {
  return (
    <main className="auth" id="main-content">
      <section className="auth-hero" aria-label="Openspace overview">
        <div className="auth-logo">
          <img src="/logo.png" width="39" height="44" fetchPriority="high" alt="Logo Openspace" />
        </div>
        <div className="auth-brand">Openspace</div>
        <p className="auth-tagline">Tasks, meetings and milestones for your team, connected in one place.</p>
        <div className="card auth-preview card-pad" aria-hidden="true">
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
    </main>
  );
}

export function SignIn() {
  usePageTitle('Sign in');
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
    if (Object.keys(errs).length) {
      document.getElementById(errs.email ? 'email' : 'password')?.focus();
      return;
    }
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
      <form className="auth-form" onSubmit={submit} noValidate aria-labelledby="signin-heading">
        <div>
          <h1 id="signin-heading">Welcome to Openspace</h1>
          <p className="muted sm" style={{ marginTop: 4 }}>
            Continue to your workspace.
          </p>
        </div>
        <Field label="Email" error={errors.email} htmlFor="email" errorId="email-error">
          <div className="input-icon">
            <Mail size={15} aria-hidden="true" />
            <input
              id="email"
              name="email"
              className="input"
              type="email"
              autoComplete="username"
              spellCheck={false}
              enterKeyHint="next"
              required
              value={form.email}
              onChange={(e) => {
                setForm({ ...form, email: e.target.value });
                if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
              }}
              placeholder="name@example.com"
              aria-invalid={!!errors.email || undefined}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
          </div>
        </Field>
        <Field label="Password" error={errors.password} htmlFor="password" errorId="password-error">
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            enterKeyHint="done"
            value={form.password}
            onChange={(e) => {
              setForm({ ...form, password: e.target.value });
              if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
            }}
            placeholder="••••••••"
            invalid={!!errors.password}
            describedBy={errors.password ? 'password-error' : undefined}
          />
        </Field>
        <div style={{ textAlign: 'right', marginTop: -8 }}>
          <Link to="/forgot-password" className="link sm">
            Forgot password?
          </Link>
        </div>
        <FormError message={error} />
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="sm muted" style={{ textAlign: 'center' }}>
          New to Openspace?{' '}
          <Link to="/signup" className="link">
            Create an account
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function SignUp() {
  usePageTitle('Create account');
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', workspaceName: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => {
    setForm({ ...form, [k]: e.target.value });
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: '' }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (form.name.trim().length < 2) errs.name = 'Nama minimal 2 karakter.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Format email tidak valid.';
    if (form.password.length < 8) errs.password = 'Password minimal 8 karakter.';
    if (form.workspaceName.trim().length < 2) errs.workspaceName = 'Nama workspace minimal 2 karakter.';
    setErrors(errs);
    if (Object.keys(errs).length) {
      const firstId = errs.name ? 'name' : errs.email ? 'email' : errs.password ? 'pw' : 'ws';
      document.getElementById(firstId)?.focus();
      return;
    }
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
      <form className="auth-form" onSubmit={submit} noValidate aria-labelledby="signup-heading">
        <div>
          <h1 id="signup-heading">Create your account</h1>
          <p className="muted sm" style={{ marginTop: 4 }}>
            You will also create a workspace for your team.
          </p>
        </div>
        <Field label="Full name" error={errors.name} htmlFor="name" errorId="name-error">
          <div className="input-icon">
            <User size={15} aria-hidden="true" />
            <input
              id="name"
              name="name"
              className="input"
              autoComplete="name"
              enterKeyHint="next"
              required
              value={form.name}
              onChange={set('name')}
              aria-invalid={!!errors.name || undefined}
              aria-describedby={errors.name ? 'name-error' : undefined}
            />
          </div>
        </Field>
        <Field label="Email" error={errors.email} htmlFor="email" errorId="signup-email-error">
          <div className="input-icon">
            <Mail size={15} aria-hidden="true" />
            <input
              id="email"
              name="email"
              type="email"
              className="input"
              autoComplete="username"
              spellCheck={false}
              enterKeyHint="next"
              required
              value={form.email}
              onChange={set('email')}
              aria-invalid={!!errors.email || undefined}
              aria-describedby={errors.email ? 'signup-email-error' : undefined}
            />
          </div>
        </Field>
        <Field
          label="Password"
          error={errors.password}
          hint="At least 8 characters."
          htmlFor="pw"
          hintId="pw-hint"
          errorId="pw-error"
        >
          <PasswordInput
            id="pw"
            name="password"
            autoComplete="new-password"
            enterKeyHint="next"
            minLength={8}
            value={form.password}
            onChange={set('password')}
            invalid={!!errors.password}
            describedBy={errors.password ? 'pw-error' : 'pw-hint'}
          />
        </Field>
        <Field label="Workspace name" error={errors.workspaceName} htmlFor="ws" errorId="ws-error">
          <div className="input-icon">
            <Building2 size={15} aria-hidden="true" />
            <input
              id="ws"
              name="organization"
              className="input"
              autoComplete="organization"
              enterKeyHint="done"
              required
              value={form.workspaceName}
              onChange={set('workspaceName')}
              placeholder="e.g. Kelompok 3"
              aria-invalid={!!errors.workspaceName || undefined}
              aria-describedby={errors.workspaceName ? 'ws-error' : undefined}
            />
          </div>
        </Field>
        <FormError message={error} />
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
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
  usePageTitle('Forgot password');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Format email tidak valid.');
      document.getElementById('email')?.focus();
      return;
    }
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
        <form className="auth-form" onSubmit={submit} noValidate aria-labelledby="forgot-heading">
          <div>
            <h1 id="forgot-heading">Forgot password?</h1>
            <p className="muted sm" style={{ marginTop: 4 }}>
              Enter your email and we will send a reset link.
            </p>
          </div>
          <Field label="Email" htmlFor="email">
            <div className="input-icon">
              <Mail size={15} aria-hidden="true" />
              <input
                id="email"
                name="email"
                type="email"
                className="input"
                autoComplete="username"
                spellCheck={false}
                enterKeyHint="done"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                aria-invalid={!!error || undefined}
              />
            </div>
          </Field>
          <FormError message={error} />
          <button type="submit" className="btn btn-primary btn-block">
            Send reset link
          </button>
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
  usePageTitle('Reset password');
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password minimal 8 karakter.');
      document.getElementById('np')?.focus();
      return;
    }
    if (password !== confirm) {
      setError('Konfirmasi password tidak sama.');
      document.getElementById('cp')?.focus();
      return;
    }
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
      <form className="auth-form" onSubmit={submit} noValidate aria-labelledby="reset-heading">
        <h1 id="reset-heading">Set a new password</h1>
        <Field label="New password" htmlFor="np" hint="At least 8 characters." hintId="np-hint">
          <PasswordInput
            id="np"
            name="new-password"
            autoComplete="new-password"
            enterKeyHint="next"
            minLength={8}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError('');
            }}
            describedBy="np-hint"
          />
        </Field>
        <Field label="Confirm password" htmlFor="cp">
          <PasswordInput
            id="cp"
            name="confirm-password"
            autoComplete="new-password"
            enterKeyHint="done"
            minLength={8}
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              if (error) setError('');
            }}
          />
        </Field>
        <FormError message={error} />
        {done && (
          <p className="sm st-DONE" role="status">
            Password diperbarui. Mengarahkan ke halaman login…
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={done}>
          Update password
        </button>
      </form>
    </AuthShell>
  );
}

// Penerimaan undangan proyek dari tautan email.
export function AcceptInvite() {
  usePageTitle('Project invitation');
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
              <button type="button" className="btn btn-primary btn-block" onClick={accept}>
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
