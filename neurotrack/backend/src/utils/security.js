const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_TOKEN_DAYS = Number(process.env.REFRESH_TOKEN_DAYS || 7);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function newRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  };
}

function clearCookieOptions() {
  const { maxAge, ...options } = cookieOptions();
  return options;
}

function signAccessToken(user, sessionId, jti) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, sid: sessionId, jti },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

async function createSession(user, req) {
  const refreshToken = newRefreshToken();
  const accessTokenJti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  const result = await query(
    `INSERT INTO user_sessions
       (user_id, refresh_token_hash, access_token_jti, ip_address, user_agent, device_fingerprint, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id`,
    [
      user.id,
      sha256(refreshToken),
      accessTokenJti,
      req.ip,
      req.get('user-agent') || null,
      req.get('x-device-fingerprint') || null,
      expiresAt,
    ]
  );
  const sessionId = result.rows[0].id;
  return {
    accessToken: signAccessToken(user, sessionId, accessTokenJti),
    refreshToken,
    sessionId,
  };
}

async function rotateSession(refreshToken, req) {
  const tokenHash = sha256(refreshToken || '');
  const sessionRes = await query(
    `SELECT s.id, s.user_id, s.expires_at, s.revoked_at,
            u.email, u.first_name, u.last_name, u.role, u.specialty, u.is_active
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.refresh_token_hash = $1`,
    [tokenHash]
  );

  if (!sessionRes.rows.length) return null;
  const session = sessionRes.rows[0];
  if (session.revoked_at || !session.is_active || new Date(session.expires_at) <= new Date()) {
    return null;
  }

  const nextRefreshToken = newRefreshToken();
  const accessTokenJti = crypto.randomUUID();
  await query(
    `UPDATE user_sessions
        SET refresh_token_hash = $1,
            access_token_jti = $2,
            refreshed_at = NOW(),
            ip_address = $3,
            user_agent = $4,
            device_fingerprint = $5
      WHERE id = $6`,
    [
      sha256(nextRefreshToken),
      accessTokenJti,
      req.ip,
      req.get('user-agent') || null,
      req.get('x-device-fingerprint') || null,
      session.id,
    ]
  );

  const user = {
    id: session.user_id,
    email: session.email,
    firstName: session.first_name,
    lastName: session.last_name,
    role: session.role,
    specialty: session.specialty,
  };

  return {
    accessToken: signAccessToken({ ...user, first_name: session.first_name, last_name: session.last_name }, session.id, accessTokenJti),
    refreshToken: nextRefreshToken,
    user,
  };
}

async function revokeSession(sessionId, reason = 'logout') {
  if (!sessionId) return;
  await query(
    `UPDATE user_sessions
        SET revoked_at = COALESCE(revoked_at, NOW()),
            revoke_reason = COALESCE(revoke_reason, $2)
      WHERE id = $1`,
    [sessionId, reason]
  );
}

module.exports = {
  cookieOptions,
  clearCookieOptions,
  createSession,
  rotateSession,
  revokeSession,
  sha256,
};
