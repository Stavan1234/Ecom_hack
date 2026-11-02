import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../store.jsx';

function useNext() {
  const [params] = useSearchParams();
  const next = params.get('next') || '/account';
  return next.startsWith('/') ? next : '/account';
}

export function Login() {
  const { refreshAuth, publicDemo, notify } = useApp();
  const navigate = useNavigate();
  const next = useNext();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/api/auth/login', { method: 'POST', body: form });
      await refreshAuth();
      notify('Welcome back.');
      navigate(next);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="auth-card">
        <h1>Sign in</h1>
        <p className="auth-sub">Welcome back to Halden &amp; Voss.</p>
        <div className="inline-note">
          Demo accounts: <code>student@lab.local</code> / <code>LabStudent123!</code>
          {!publicDemo && <> · <code>admin@lab.local</code> / <code>LabAdmin123!</code></>}
        </div>
        {error && <div className="inline-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="field"><label htmlFor="email">Email</label><input id="email" type="text" autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <button className="btn block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p className="auth-alt">New here? <Link to={`/register?next=${encodeURIComponent(next)}`}>Create an account</Link></p>
      </div>
    </div>
  );
}

export function Register() {
  const { refreshAuth, publicDemo, notify } = useApp();
  const navigate = useNavigate();
  const next = useNext();
  const [form, setForm] = useState({ displayName: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (publicDemo) {
    return (
      <div className="page">
        <div className="auth-card">
          <h1>Create account</h1>
          <p className="auth-sub">Registration is disabled in this public preview. Please sign in with the demo account instead.</p>
          <Link className="btn block" to="/login">Go to sign in</Link>
        </div>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/api/auth/register', { method: 'POST', body: form });
      await refreshAuth();
      notify('Your account has been created.');
      navigate(next);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="auth-card">
        <h1>Create account</h1>
        <p className="auth-sub">Join the Maison in a few seconds.</p>
        {error && <div className="inline-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="field"><label htmlFor="name">Display name</label><input id="name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></div>
          <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <button className="btn block" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        </form>
        <p className="auth-alt">Already have an account? <Link to={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></p>
      </div>
    </div>
  );
}
