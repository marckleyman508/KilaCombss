/**
 * Admin-only endpoints.
 *
 * breachInvestigation — Queries audit_logs for suspicious PHI access patterns.
 *   Intended for use during HIPAA § 164.308(a)(6) incident response.
 *   Output matches the breach_investigation.sql Athena pattern from the spec.
 *
 * activeSessions — Lists all non-revoked sessions for security review.
 * revokeUserSessions — Force-revokes all sessions for a user (containment step).
 */

const { query } = require('../config/database');
const { audit } = require('../utils/audit');
const { hashPatientId } = require('../utils/hipaaCompliance');

// ── BREACH INVESTIGATION ─────────────────────────────────────────────────────
async function breachInvestigation(req, res, next) {
  try {
    const { patientMrn, userId, hours = 72 } = req.query;
    const windowHours = Math.min(Math.max(parseInt(hours) || 72, 1), 720); // 1 hour → 30 days

    const conditions = [
      `al.created_at >= NOW() - ($1 || ' hours')::INTERVAL`,
    ];
    const params = [windowHours];
    let i = 2;

    // Filter by hashed patient ID if MRN provided
    if (patientMrn) {
      conditions.push(`al.patient_id_hash = $${i++}`);
      params.push(hashPatientId(patientMrn));
    }

    if (userId) {
      conditions.push(`al.user_id = $${i++}`);
      params.push(userId);
    }

    const where = conditions.join(' AND ');

    const result = await query(`
      SELECT
        al.id,
        al.created_at           AS timestamp,
        al.user_id,
        al.details->>'actorRole' AS user_role,
        al.action,
        al.entity_type          AS resource_type,
        al.entity_id            AS resource_id,
        al.patient_id_hash,
        al.ip_address           AS source_ip,
        al.session_id,
        al.details->>'outcome'  AS status,
        al.details,
        CASE
          WHEN al.details->>'actorRole' = 'admin'
               AND al.entity_type IN ('patient','progress_log','medication','surgery','patient_progress')
            THEN 'CRITICAL_ADMIN_PHI_ACCESS'
          WHEN al.action = 'DELETE'
               AND al.details->>'actorRole' NOT IN ('admin')
            THEN 'UNAUTHORIZED_DELETE'
          WHEN al.action IN ('VIEW','SEARCH')
               AND al.details->>'actorRole' = 'billing'
               AND al.entity_type IN ('progress_log','patient_progress','patient_timeline')
            THEN 'ROLE_VIOLATION_BILLING'
          WHEN al.action = 'DENY'
            THEN 'ACCESS_DENIED'
          WHEN al.action = 'LOGIN_FAILED'
            THEN 'AUTH_FAILURE'
          ELSE 'REVIEW'
        END AS risk_level
      FROM audit_logs al
      WHERE ${where}
        AND (
          al.action IN ('DENY','LOGIN_FAILED','MFA_VERIFY_FAILED','DELETE','SESSION_TIMEOUT')
          OR (al.details->>'actorRole' = 'admin' AND al.entity_type IN
                ('patient','progress_log','medication','surgery','patient_progress','patient_timeline'))
          OR (al.action IN ('VIEW','SEARCH') AND al.details->>'actorRole' = 'billing'
              AND al.entity_type IN ('progress_log','patient_progress'))
        )
      ORDER BY al.created_at DESC
      LIMIT 500
    `, params);

    await audit(req, {
      action: 'VIEW',
      entityType: 'breach_investigation',
      details: {
        windowHours,
        resultCount: result.rows.length,
        filteredByPatient: Boolean(patientMrn),
        filteredByUser: Boolean(userId),
      },
    });

    // Group by risk level for executive summary
    const summary = result.rows.reduce((acc, row) => {
      acc[row.risk_level] = (acc[row.risk_level] || 0) + 1;
      return acc;
    }, {});

    res.json({
      summary,
      events:      result.rows,
      windowHours,
      generatedAt: new Date().toISOString(),
      note: 'Results are limited to 500 events. Export audit_logs table for full forensic analysis.',
    });
  } catch (err) { next(err); }
}

// ── ACTIVE SESSIONS OVERVIEW ─────────────────────────────────────────────────
async function activeSessions(req, res, next) {
  try {
    const result = await query(`
      SELECT
        s.id, s.user_id, u.email, u.role,
        s.ip_address, s.user_agent,
        s.created_at, s.refreshed_at, s.last_active_at,
        s.mfa_verified_at, s.expires_at,
        s.device_fingerprint
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.revoked_at IS NULL
        AND s.expires_at > NOW()
      ORDER BY s.last_active_at DESC NULLS LAST
    `);

    await audit(req, {
      action: 'VIEW',
      entityType: 'admin_active_sessions',
      details: { count: result.rows.length },
    });

    res.json({ sessions: result.rows, count: result.rows.length });
  } catch (err) { next(err); }
}

// ── FORCE REVOKE USER SESSIONS (containment step for breach response) ─────────
async function revokeUserSessions(req, res, next) {
  try {
    const { userId } = req.params;
    const { reason = 'admin_revoke' } = req.body;

    const result = await query(
      `UPDATE user_sessions
          SET revoked_at    = COALESCE(revoked_at, NOW()),
              revoke_reason = COALESCE(revoke_reason, $2)
        WHERE user_id    = $1
          AND revoked_at IS NULL
       RETURNING id`,
      [userId, reason]
    );

    await audit(req, {
      action: 'ADMIN_REVOKE_SESSIONS',
      entityType: 'session',
      details: {
        targetUserId: userId,
        revokedCount: result.rows.length,
        reason,
      },
    });

    res.json({
      revokedCount: result.rows.length,
      message: `${result.rows.length} session(s) revoked for user ${userId}`,
    });
  } catch (err) { next(err); }
}

module.exports = { breachInvestigation, activeSessions, revokeUserSessions };
