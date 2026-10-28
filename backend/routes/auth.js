const express = require('express');
const { getPool } = require('../db/pool');
const { hashPassword, verifyPassword, generateSessionToken, hashToken } = require('../utils/auth');
const { requireAuth } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { createRateLimiter } = require('../middleware/rateLimiter');

function createAuthRoutes({ poolProvider = getPool } = {}) {
  const router = express.Router();
  const loginLimiter = createRateLimiter({
    windowMs: 5 * 60 * 1000,
    max: 15,
    message: 'Too many login attempts. Please wait 5 minutes and try again.',
  });

  router.post('/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Valid email and password are required.' });
    }

    try {
      const pool = poolProvider();
      const normalizedEmail = email.trim().toLowerCase();
      const userQuery = `
        SELECT 
          u.id,
          u.organization_id,
          u.full_name,
          u.email,
          u.password_hash,
          u.crm_role,
          u.role,
          u.employee_id,
          u.designation,
          u.department_id,
          u.avatar,
          u.is_active,
          d.name AS department_name,
          o.name AS organization_name,
          o.slug AS organization_slug
        FROM users u
        JOIN organizations o ON u.organization_id = o.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.email = $1
      `;
      const { rows } = await pool.query(userQuery, [normalizedEmail]);
      if (rows.length === 0) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const user = rows[0];
      if (!user.is_active) {
        return res.status(403).json({ error: 'This employee account is deactivated. Contact an administrator.' });
      }

      const passwordValid = await verifyPassword(password, user.password_hash);
      if (!passwordValid) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      // Generate session
      const sessionToken = generateSessionToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await pool.query(
        `INSERT INTO user_sessions (session_token, user_id, organization_id, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [sessionToken, user.id, user.organization_id, expiresAt]
      );

      // Audit log
      await logAudit(pool, {
        organizationId: user.organization_id,
        userId: user.id,
        actorName: user.full_name,
        action: 'LOGIN',
        entityType: 'auth',
        entityId: user.id,
        details: { email: user.email },
        ipAddress: req.ip,
      });

      // Set cookie
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('taskflow_session', sessionToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });

      const userProfile = {
        id: user.id,
        organization_id: user.organization_id,
        full_name: user.full_name,
        email: user.email,
        crm_role: user.crm_role || 'employee',
        role: user.role,
        employee_id: user.employee_id,
        designation: user.designation,
        department_id: user.department_id,
        department_name: user.department_name,
        avatar: user.avatar,
        organization_name: user.organization_name,
        organization_slug: user.organization_slug,
      };

      return res.json({
        message: 'Login successful.',
        token: sessionToken,
        user: userProfile,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (err) {
      console.error('Login error:', err.message);
      return res.status(500).json({ error: 'An unexpected error occurred during login.' });
    }
  });

  router.post('/logout', async (req, res) => {
    try {
      if (req.sessionId) {
        const pool = poolProvider();
        await pool.query('DELETE FROM user_sessions WHERE id = $1', [req.sessionId]);
      }
    } catch (err) {
      console.error('Logout error:', err.message);
    }
    res.clearCookie('taskflow_session', { path: '/' });
    return res.json({ message: 'Logged out successfully.' });
  });

  router.get('/me', requireAuth, (req, res) => {
    return res.json({ user: req.user });
  });

  router.post('/forgot-password', loginLimiter, async (req, res) => {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Valid email is required.' });
    }

    try {
      const pool = poolProvider();
      const normalizedEmail = email.trim().toLowerCase();
      const { rows } = await pool.query('SELECT id, full_name, email FROM users WHERE email = $1', [normalizedEmail]);

      if (rows.length > 0) {
        const user = rows[0];
        const rawToken = generateSessionToken();
        const hashed = hashToken(rawToken);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await pool.query(
          'UPDATE users SET reset_token_hash = $1, reset_token_expires_at = $2 WHERE id = $3',
          [hashed, expiresAt, user.id]
        );

        // In development / demo when SMTP is not configured, we return reset token simulation safely
        const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
        return res.json({
          message: 'If an account exists with that email, instructions have been generated.',
          simulationToken: smtpConfigured ? undefined : rawToken,
        });
      }

      return res.json({
        message: 'If an account exists with that email, instructions have been generated.',
      });
    } catch (err) {
      console.error('Forgot password error:', err.message);
      return res.status(500).json({ error: 'Could not process password reset request.' });
    }
  });

  router.post('/reset-password', loginLimiter, async (req, res) => {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ error: 'Valid token and password of at least 8 characters are required.' });
    }

    try {
      const pool = poolProvider();
      const hashed = hashToken(token);
      const { rows } = await pool.query(
        'SELECT id, organization_id, full_name FROM users WHERE reset_token_hash = $1 AND reset_token_expires_at > now()',
        [hashed]
      );

      if (rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired password reset token.' });
      }

      const user = rows[0];
      const newHash = await hashPassword(newPassword);

      await pool.query(
        'UPDATE users SET password_hash = $1, reset_token_hash = NULL, reset_token_expires_at = NULL WHERE id = $2',
        [newHash, user.id]
      );

      // Invalidate existing sessions
      await pool.query('DELETE FROM user_sessions WHERE user_id = $1', [user.id]);

      await logAudit(pool, {
        organizationId: user.organization_id,
        userId: user.id,
        actorName: user.full_name,
        action: 'PASSWORD_RESET',
        entityType: 'auth',
        entityId: user.id,
        ipAddress: req.ip,
      });

      return res.json({ message: 'Password updated successfully. Please log in with your new password.' });
    } catch (err) {
      console.error('Reset password error:', err.message);
      return res.status(500).json({ error: 'Could not reset password.' });
    }
  });

  // Fast demo user switcher for testing & evaluation
  router.get('/demo-users', async (req, res) => {
    try {
      const pool = poolProvider();
      const query = `
        SELECT 
          u.id,
          u.full_name,
          u.email,
          u.crm_role,
          u.designation,
          u.avatar,
          d.name AS department_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.is_active = true
        ORDER BY 
          CASE u.crm_role 
            WHEN 'super_admin' THEN 1 
            WHEN 'admin' THEN 2 
            WHEN 'manager' THEN 3 
            ELSE 4 
          END ASC,
          u.full_name ASC
        LIMIT 20
      `;
      const { rows } = await pool.query(query);
      return res.json({ users: rows });
    } catch (err) {
      return res.status(500).json({ error: 'Could not fetch demo users.', details: err.message });
    }
  });

  router.post('/switch-demo-user', async (req, res) => {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'User ID required.' });

    try {
      const pool = poolProvider();
      const userQuery = `
        SELECT 
          u.id,
          u.organization_id,
          u.full_name,
          u.email,
          u.crm_role,
          u.role,
          u.employee_id,
          u.designation,
          u.department_id,
          u.avatar,
          d.name AS department_name,
          o.name AS organization_name,
          o.slug AS organization_slug
        FROM users u
        JOIN organizations o ON u.organization_id = o.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.id = $1 AND u.is_active = true
      `;
      const { rows } = await pool.query(userQuery, [userId]);
      if (rows.length === 0) return res.status(404).json({ error: 'Demo user not found.' });

      const user = rows[0];
      const sessionToken = generateSessionToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await pool.query(
        `INSERT INTO user_sessions (session_token, user_id, organization_id, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [sessionToken, user.id, user.organization_id, expiresAt]
      );

      res.cookie('taskflow_session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });

      return res.json({
        message: `Switched to ${user.full_name} (${user.crm_role}).`,
        token: sessionToken,
        user,
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to switch demo user.' });
    }
  });

  return router;
}

module.exports = { createAuthRoutes };
