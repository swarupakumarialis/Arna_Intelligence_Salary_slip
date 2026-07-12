import React, { useState } from 'react';
import { Building2, User, Lock, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';

interface Props {
  onLogin: (username: string, password: string) => boolean;
  appName?: string;
  logoDataUri?: string | null;
}

/**
 * Full-screen login gate rendered by ProtectedRoute whenever there's
 * no active session. Purely a UI shell around useAuth().login() — it
 * has no idea whether that call checks a static config (today) or
 * hits a real API (after a JWT/MongoDB migration); it only cares about
 * the boolean result.
 */
export function LoginPage({ onLogin, appName = 'Arna Intelligence IntelliPayRoll', logoDataUri }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Enter both username and password.');
      return;
    }
    setError('');
    setSubmitting(true);
    /* Small deliberate delay — keeps the transition from feeling
       instantaneous/jarring, and is the natural seam where a real
       network request would sit once auth talks to a backend. */
    window.setTimeout(() => {
      const ok = onLogin(username, password);
      if (!ok) {
        setError('Invalid username or password.');
        setSubmitting(false);
      }
      /* On success, the parent re-renders past ProtectedRoute and this
         component unmounts — no further state update needed here. */
    }, 350);
  };

  return (
    <div className="login-screen">
      <div className="login-card animate-fade-in-up">
        <div className="login-brand">
          <div className="login-brand-logo">
            {logoDataUri ? <img src={logoDataUri} alt={appName} /> : <Building2 size={34} />}
          </div>
          <div className="login-brand-title">{appName}</div>
          <div className="login-brand-subtitle">Payroll Management</div>
        </div>

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <div>
            <label className="field-label" htmlFor="login-username">Username</label>
            <div className="login-input-wrap">
              <User size={15} className="login-input-icon" />
              <input
                id="login-username"
                className="field"
                style={{ paddingLeft: 34 }}
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username"
                autoFocus
                autoComplete="username"
                disabled={submitting}
              />
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="login-password">Password</label>
            <div className="login-input-wrap">
              <Lock size={15} className="login-input-icon" />
              <input
                id="login-password"
                className="field"
                style={{ paddingLeft: 34, paddingRight: 38 }}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={submitting}
              />
              <button
                type="button"
                className="login-toggle-visibility"
                onClick={() => setShowPassword(v => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn btn-dark login-submit" disabled={submitting}>
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="login-footer-note">
          <ShieldCheck size={12} /> Secured payroll access · Authorised personnel only
        </p>
      </div>
    </div>
  );
}
