const { getPool } = require('../db/pool');

function parseCookies(req) {
  const cookieHeader = req.headers.cookie;
  const cookies = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach((cookie) => {
      const parts = cookie.split('=');
      const name = parts[0].trim();
      const value = parts.slice(1).join('=').trim();
      if (name) cookies[name] = decodeURIComponent(value);
    });
  }
  return cookies;
}

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req);
  return cookies.taskflow_session || null;
}

function createAuthMiddleware({ poolProvider = getPool } = {}) {
  return async function authenticate(req, res, next) {
    req.user = null;
    req.sessionId = null;

    const token = extractToken(req);
    if (!token) return next();

    try {
      const pool = poolProvider();
      const query = `
        SELECT 
          s.id AS session_id,
          s.expires_at,
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
          u.is_active,
          d.name AS department_name,
          o.name AS organization_name,
          o.slug AS organization_slug
        FROM user_sessions s
        JOIN users u ON s.user_id = u.id
        JOIN organizations o ON u.organization_id = o.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE s.session_token = $1 AND s.expires_at > now()
      `;
      const { rows } = await pool.query(query, [token]);
      if (rows.length > 0 && rows[0].is_active) {
        req.user = {
          id: rows[0].id,
          organization_id: rows[0].organization_id,
          full_name: rows[0].full_name,
          email: rows[0].email,
          crm_role: rows[0].crm_role || 'employee',
          role: rows[0].role,
          employee_id: rows[0].employee_id,
          designation: rows[0].designation,
          department_id: rows[0].department_id,
          department_name: rows[0].department_name,
          avatar: rows[0].avatar,
          organization_name: rows[0].organization_name,
          organization_slug: rows[0].organization_slug,
        };
        req.sessionId = rows[0].session_id;

        // Async touch session last_active_at
        pool.query('UPDATE user_sessions SET last_active_at = now() WHERE id = $1', [rows[0].session_id])
          .catch(() => {});
      }
    } catch {
      // Database not available or query error - leave req.user = null
    }

    next();
  };
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  next();
}

function requireRole(allowedRoles) {
  const allowedSet = new Set(Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]);
  return function roleCheck(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const userRole = req.user.crm_role || 'employee';
    // Super admin has permission for all role checks
    if (userRole === 'super_admin' || allowedSet.has(userRole)) {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden: Insufficient role permissions.' });
  };
}

function csrfProtection(allowedOrigins = []) {
  const allowedSet = new Set(allowedOrigins);
  return function csrf(req, res, next) {
    const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!mutatingMethods.includes(req.method)) return next();

    // Requests bearing an Authorization header cannot be executed via CSRF
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) return next();

    const origin = req.headers.origin;
    if (origin) {
      if (!allowedSet.has(origin)) {
        return res.status(403).json({ error: 'CSRF protection: Unauthorized request origin.' });
      }
      return next();
    }

    const referer = req.headers.referer;
    if (referer) {
      try {
        const refOrigin = new URL(referer).origin;
        if (!allowedSet.has(refOrigin)) {
          return res.status(403).json({ error: 'CSRF protection: Unauthorized referer origin.' });
        }
        return next();
      } catch {
        return res.status(403).json({ error: 'CSRF protection: Malformed referer header.' });
      }
    }

    // In production, mutating requests relying strictly on cookies must present an Origin or Referer
    if (process.env.NODE_ENV === 'production' && req.headers.cookie?.includes('taskflow_session=')) {
      return res.status(403).json({ error: 'CSRF protection: Origin or Referer header required for cookie session mutations.' });
    }

    next();
  };
}

module.exports = {
  createAuthMiddleware,
  requireAuth,
  requireRole,
  parseCookies,
  extractToken,
  csrfProtection,
};
