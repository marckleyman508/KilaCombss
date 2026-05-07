const { query } = require('../config/database');
const { hashPatientId } = require('./hipaaCompliance');

function clientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || null;
}

/**
 * HIPAA § 164.308(a)(1) — every PHI access must be logged with:
 * user_id, role, action, resource, patient identifier (hashed), IP, session, timestamp.
 *
 * @param {object} req - Express request (req.user must be set for authenticated calls)
 * @param {object} options
 * @param {string} options.action       - e.g. VIEW, CREATE, UPDATE, DELETE, EXPORT, LOGIN_FAILED
 * @param {string} options.entityType   - e.g. patient, progress_log, auth
 * @param {string} [options.entityId]   - UUID of the affected record
 * @param {string} [options.outcome]    - 'success' | 'denied' | 'error'
 * @param {string} [options.patientMrn] - Raw MRN; will be hashed before storage
 * @param {object} [options.details]    - Additional structured metadata (no raw PHI)
 */
async function audit(req, {
  action,
  entityType,
  entityId    = null,
  outcome     = 'success',
  patientMrn  = null,
  details     = {},
}) {
  try {
    await query(
      `INSERT INTO audit_logs
         (user_id, action, entity_type, entity_id,
          ip_address, user_agent, session_id, patient_id_hash, details)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        req.user?.id   || null,
        action,
        entityType,
        entityId,
        clientIp(req),
        req.get('user-agent') || null,
        req.user?.sid  || null,
        hashPatientId(patientMrn),
        {
          outcome,
          actorRole:  req.user?.role  || null,
          requestId:  req.requestId   || null,
          route:      req.originalUrl,
          method:     req.method,
          ...details,
        },
      ]
    );
  } catch (err) {
    // Audit failures must not silently vanish — log with full context
    console.error('AUDIT_WRITE_FAILED', {
      requestId: req.requestId,
      action,
      entityType,
      error: err.message,
    });
  }
}

module.exports = { audit };
