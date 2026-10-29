import React, { useState } from 'react';
import { loginApi, forgotPasswordApi, switchDemoUserApi } from '../api/crm';

const DEMO_PRESETS = [
  { name: 'Dolly', role: 'Super Administrator', email: 'admin@startizlabs.com', badge: 'super_admin' },
  { name: 'Priya Verma', role: 'Head of Quality Assurance (Admin)', email: 'priya.verma@example.com', badge: 'admin' },
  { name: 'Rajesh Kumar', role: 'Principal Product Manager (Manager)', email: 'rajesh.kumar@example.com', badge: 'manager' },
  { name: 'Sneha Gupta', role: 'DevOps & Cloud Architecture Lead (Manager)', email: 'sneha.gupta@example.com', badge: 'manager' },
  { name: 'Rahul Kumar', role: 'Senior Full Stack Developer (Employee)', email: 'rahul.kumar@example.com', badge: 'employee' },
];

export default function AuthModal({
  isOpen,
  onClose,
  onLoginSuccess,
  demoUsers = [],
}) {
  const [mode, setMode] = useState('demo'); // 'demo' | 'login' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('TaskFlowDemo@2026!');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const data = await loginApi(email.trim(), password);
      onLoginSuccess(data.user);
      onClose();
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoSelect = async (demoUser) => {
    setError('');
    setLoading(true);
    try {
      const found = demoUsers.find((u) => u.email.toLowerCase() === demoUser.email.toLowerCase());
      if (found) {
        const data = await switchDemoUserApi(found.id);
        onLoginSuccess(data.user);
        onClose();
      } else {
        // Fallback to standard login
        setEmail(demoUser.email);
        setPassword('TaskFlowDemo@2026!');
        const data = await loginApi(demoUser.email, 'TaskFlowDemo@2026!');
        onLoginSuccess(data.user);
        onClose();
      }
    } catch (err) {
      setError('Could not switch demo user: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your work email.');
      return;
    }
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const data = await forgotPasswordApi(email.trim());
      setSuccessMsg(data.message || 'Password reset link sent to your work email.');
    } catch (err) {
      setError(err.message || 'Failed to request password reset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog auth-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header auth-modal-header">
          <div className="auth-brand">
            <span className="brand-mark"><i /><i /><i /><i /></span>
            <div>
              <h3>Startiz Labs</h3>
              <p>Employee Management & Task Tracking</p>
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`tab-btn${mode === 'demo' ? ' is-active' : ''}`}
            onClick={() => setMode('demo')}
          >
            ⚡ Demo Personas
          </button>
          <button
            type="button"
            className={`tab-btn${mode === 'login' ? ' is-active' : ''}`}
            onClick={() => setMode('login')}
          >
            🔒 Account Login
          </button>
          <button
            type="button"
            className={`tab-btn${mode === 'forgot' ? ' is-active' : ''}`}
            onClick={() => setMode('forgot')}
          >
            Reset Password
          </button>
        </div>

        <div className="modal-body auth-body">
          {error && <div className="form-error-banner">{error}</div>}
          {successMsg && <div className="form-success-banner">{successMsg}</div>}

          {mode === 'demo' ? (
            <div className="demo-personas-grid">
              <p className="auth-helper-text">
                Select a team member below to experience the platform with their role permissions, department scope, and assigned tasks:
              </p>
              <div className="presets-list">
                {DEMO_PRESETS.map((preset) => (
                  <button
                    key={preset.email}
                    type="button"
                    className="demo-persona-card"
                    onClick={() => handleQuickDemoSelect(preset)}
                    disabled={loading}
                  >
                    <div className="persona-avatar">
                      {preset.name.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <div className="persona-copy">
                      <strong>{preset.name}</strong>
                      <span>{preset.role}</span>
                      <small>{preset.email}</small>
                    </div>
                    <span className={`role-badge role-badge--${preset.badge}`}>
                      {preset.badge.replace('_', ' ')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : mode === 'login' ? (
            <form onSubmit={handleLogin} className="auth-form">
              <div className="form-group">
                <label htmlFor="login-email">Email Address</label>
                <input
                  id="login-email"
                  type="email"
                  className="form-input"
                  placeholder="e.g. admin@startizlabs.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  type="password"
                  className="form-input"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="auth-meta-row">
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setMode('forgot')}
                >
                  Forgot password?
                </button>
              </div>

              <button type="submit" className="button button--primary button--full" disabled={loading}>
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleForgotPassword} className="auth-form">
              <p className="auth-helper-text">
                Enter your registered email to receive password reset instructions:
              </p>
              <div className="form-group">
                <label htmlFor="reset-email">Email Address</label>
                <input
                  id="reset-email"
                  type="email"
                  className="form-input"
                  placeholder="e.g. priya.verma@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="button button--primary button--full" disabled={loading}>
                {loading ? 'Submitting...' : 'Send Reset Instructions'}
              </button>
            </form>
          )}
        </div>

        <div className="modal-footer auth-footer">
          <small className="security-notice">
            🔒 Protected with memory-hard Scrypt hashing, HttpOnly session cookies, and multi-tenant isolation.
          </small>
        </div>
      </div>
    </div>
  );
}
