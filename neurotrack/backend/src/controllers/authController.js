const bcrypt = require('bcrypt');
const { query } = require('../config/database');
const { audit } = require('../utils/audit');
const { clearCookieOptions, cookieOptions, createSession, rotateSession, revokeSession } = require('../utils/security');

function parseCookies(req) {
  return (req.headers.cookie || '').split(';').reduce((acc, part) => {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rawValue.join('='));
    return acc;
  }, {});
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name || user.firstName,
    lastName: user.last_name || user.lastName,
    role: user.role,
    specialty: user.specialty,
  };
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const result = await query(
      'SELECT id, email, password_hash, first_name, last_name, role, specialty FROM users WHERE email = $1 AND is_active = true',
      [email.toLowerCase().trim()]
    );

    if (!result.rows.length) {
      await audit(req, { action: 'LOGIN_FAILED', entityType: 'auth', outcome: 'denied', details: { email } });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await audit(req, { action: 'LOGIN_FAILED', entityType: 'auth', entityId: user.id, outcome: 'denied' });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const session = await createSession(user, req);
    res.cookie('nt_refresh', session.refreshToken, cookieOptions());
    req.user = { id: user.id, role: user.role, sid: session.sessionId };
    await audit(req, { action: 'LOGIN_SUCCESS', entityType: 'auth', entityId: user.id });

    res.json({
      accessToken: session.accessToken,
      user: publicUser(user),
    });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const refreshToken = parseCookies(req).nt_refresh;
    const rotated = await rotateSession(refreshToken, req);
    if (!rotated) return res.status(401).json({ error: 'Invalid or expired session' });

    res.cookie('nt_refresh', rotated.refreshToken, cookieOptions());
    req.user = { id: rotated.user.id, role: rotated.user.role };
    await audit(req, { action: 'TOKEN_REFRESH', entityType: 'auth', entityId: rotated.user.id });
    res.json({ accessToken: rotated.accessToken, user: rotated.user });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    await revokeSession(req.user?.sid, 'logout');
    await audit(req, { action: 'LOGOUT', entityType: 'auth', entityId: req.user?.id || null });
    res.clearCookie('nt_refresh', clearCookieOptions());
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const result = await query(
      'SELECT id, email, first_name, last_name, role, specialty, license_number, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    res.json({
      id: u.id,
      email: u.email,
      firstName: u.first_name,
      lastName: u.last_name,
      role: u.role,
      specialty: u.specialty,
      licenseNumber: u.license_number,
      createdAt: u.created_at,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, logout, me, refresh };
