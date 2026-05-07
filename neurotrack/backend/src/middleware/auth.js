const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { audit } = require('../utils/audit');
const { revokeSession } = require('../utils/security');

// HIPAA RBAC: per-role idle timeout (§ 164.312(a)(2)(iii) — automatic logoff)
const IDLE_TIMEOUT_MS = {
  admin:     5  * 60 * 1000,  // 5 min
  doctor:    8  * 60 * 1000,  // 8 min
  billing:   10 * 60 * 1000,  // 10 min
  caregiver: 10 * 60 * 1000,  // 10 min
  patient:   15 * 60 * 1000,  // 15 min
};

// Only update last_active_at DB column at most once per minute to limit writes
const ACTIVE_UPDATE_THRESHOLD_MS = 60 * 1000;

// Roles that MUST complete MFA before accessing PHI endpoints
const MFA_REQUIRED_ROLES = new Set(['admin', 'doctor']);

// URL prefixes exempt from MFA check (auth flows and MFA setup itself)
const MFA_EXEMPT_PREFIXES = ['/api/auth/', '/api/mfa/'];

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload.sid || !payload.jti) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const result = await query(
      `SELECT s.id AS session_id, s.revoked_at, s.expires_at, s.access_token_jti,
              s.last_active_at, s.mfa_verified_at,
              u.id, u.email, u.role, u.is_active
         FROM user_sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = $1`,
      [payload.sid]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const session = result.rows[0];

    if (
      session.revoked_at ||
      !session.is_active ||
      new Date(session.expires_at) <= new Date() ||
      session.access_token_jti !== payload.jti
    ) {
      await audit(req, {
        action: 'DENY',
        entityType: 'session',
        entityId: session.session_id,
        outcome: 'denied',
        details: { reason: 'inactive_or_revoked_session' },
      });
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // ── Idle timeout check (HIPAA § 164.312(a)(2)(iii)) ──────────────────────
    const idleLimit = IDLE_TIMEOUT_MS[session.role] ?? IDLE_TIMEOUT_MS.patient;
    const now = Date.now();
    const lastActive = session.last_active_at ? new Date(session.last_active_at).getTime() : null;

    if (lastActive && (now - lastActive) > idleLimit) {
      await revokeSession(session.session_id, 'idle_timeout');
      await audit(req, {
        action: 'SESSION_TIMEOUT',
        entityType: 'session',
        entityId: session.session_id,
        outcome: 'denied',
        details: { role: session.role, idleMs: now - lastActive },
      });
      return res.status(401).json({
        error: 'Session expired due to inactivity',
        code:  'IDLE_TIMEOUT',
      });
    }

    // Update last_active_at at most every 60 seconds (fire-and-forget)
    if (!lastActive || (now - lastActive) > ACTIVE_UPDATE_THRESHOLD_MS) {
      query(
        'UPDATE user_sessions SET last_active_at = NOW() WHERE id = $1',
        [session.session_id]
      ).catch(() => {});
    }

    req.user = {
      id:            session.id,
      email:         session.email,
      role:          session.role,
      sid:           session.session_id,
      jti:           payload.jti,
      mfaVerifiedAt: session.mfa_verified_at,
    };

    // ── MFA enforcement (HIPAA § 164.312(d) — person authentication) ─────────
    const isMfaExempt = MFA_EXEMPT_PREFIXES.some(p => req.originalUrl.startsWith(p));
    if (!isMfaExempt && MFA_REQUIRED_ROLES.has(session.role) && !session.mfa_verified_at) {
      const enrolled = await query(
        'SELECT 1 FROM mfa_credentials WHERE user_id = $1 AND is_active = true LIMIT 1',
        [session.id]
      );
      const code = enrolled.rows.length ? 'MFA_REQUIRED' : 'MFA_ENROLLMENT_REQUIRED';
      return res.status(403).json({
        error: 'Multi-factor authentication required',
        code,
      });
    }

    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Doctors can only access patients assigned to them unless they are admin
async function requirePatientAccess(req, res, next) {
  if (req.user.role === 'admin') return next();

  const patientId = req.params.id || req.params.patientId;

  try {
    const result = await query(
      `SELECT primary_doctor_id,
              EXISTS (
                SELECT 1 FROM user_patient_access upa
                WHERE upa.patient_id = patients.id
                  AND upa.user_id = $2
                  AND upa.revoked_at IS NULL
              ) AS has_explicit_access
         FROM patients WHERE id = $1`,
      [patientId, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Patient not found' });

    if (result.rows[0].primary_doctor_id !== req.user.id && !result.rows[0].has_explicit_access) {
      await audit(req, {
        action: 'DENY',
        entityType: 'patient',
        entityId: patientId,
        outcome: 'denied',
        details: { reason: 'patient_scope' },
      });
      return res.status(403).json({ error: 'Access denied to this patient record' });
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticate, requireRole, requirePatientAccess };
