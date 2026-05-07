/**
 * MFA Controller — TOTP (RFC 6238) implementation.
 *
 * Enrollment flow:
 *   1. GET  /api/mfa/status          → check current enrollment
 *   2. POST /api/mfa/setup/totp      → generate secret + QR code URI
 *   3. POST /api/mfa/verify          → confirm first code (activates credential)
 *
 * Session flow (after login):
 *   POST /api/mfa/verify             → verify code, mark session as mfa_verified
 *
 * Disable:
 *   DELETE /api/mfa/totp             → requires MFA-verified session + password confirm
 */

const { authenticator } = require('otplib');
const { query } = require('../config/database');
const { audit } = require('../utils/audit');
const { encryptField, decryptField } = require('../utils/hipaaCompliance');
const bcrypt = require('bcrypt');

// otplib window: accept 1 step before/after current time (30-second periods)
authenticator.options = { window: 1 };

// ── STATUS ───────────────────────────────────────────────────────────────────
async function mfaStatus(req, res, next) {
  try {
    const result = await query(
      `SELECT method, is_active, enrolled_at, last_used_at
       FROM mfa_credentials WHERE user_id = $1`,
      [req.user.id]
    );
    const enrolled = result.rows.filter(r => r.is_active);
    const isMfaVerified = Boolean(req.user.mfaVerifiedAt);

    res.json({
      enrolled:       enrolled.map(r => ({ method: r.method, enrolledAt: r.enrolled_at, lastUsedAt: r.last_used_at })),
      sessionVerified: isMfaVerified,
    });
  } catch (err) { next(err); }
}

// ── SETUP TOTP ────────────────────────────────────────────────────────────────
async function setupTotp(req, res, next) {
  try {
    const { id: userId, email } = req.user;

    // If already enrolled, require explicit disable first
    const existing = await query(
      'SELECT id FROM mfa_credentials WHERE user_id = $1 AND method = $2 AND is_active = true',
      [userId, 'totp']
    );
    if (existing.rows.length) {
      return res.status(409).json({ error: 'TOTP already enrolled. Disable it before re-enrolling.' });
    }

    const secret = authenticator.generateSecret(20); // 160-bit secret per RFC 4226
    const otpauthUrl = authenticator.keyuri(email, 'NeuroTrack', secret);

    // Store encrypted but inactive (activated only after first successful verify)
    await query(
      `INSERT INTO mfa_credentials (user_id, method, credential_hash, is_active)
       VALUES ($1, 'totp', $2, false)
       ON CONFLICT (user_id, method) DO UPDATE
         SET credential_hash = $2, is_active = false, enrolled_at = NOW()`,
      [userId, encryptField(secret)]
    );

    await audit(req, {
      action: 'MFA_SETUP_INITIATED',
      entityType: 'mfa',
      entityId: userId,
    });

    res.json({
      otpauthUrl,
      secret,  // Shown once for manual entry fallback; client should not persist
      message: 'Scan the URL with your authenticator app, then POST a code to /api/mfa/verify to activate.',
    });
  } catch (err) { next(err); }
}

// ── VERIFY (enrollment activation OR session MFA step) ───────────────────────
async function verifyMfa(req, res, next) {
  try {
    const { id: userId, sid } = req.user;
    const { code } = req.body;

    if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
      return res.status(400).json({ error: 'code must be a 6-digit string' });
    }

    const result = await query(
      'SELECT credential_hash, is_active FROM mfa_credentials WHERE user_id = $1 AND method = $2',
      [userId, 'totp']
    );

    if (!result.rows.length) {
      return res.status(400).json({ error: 'No TOTP credential found. Complete /api/mfa/setup/totp first.' });
    }

    let secret;
    try {
      secret = decryptField(result.rows[0].credential_hash);
    } catch {
      return res.status(500).json({ error: 'Credential decryption failed. Re-enroll TOTP.' });
    }

    const valid = authenticator.check(code.trim(), secret);
    if (!valid) {
      await audit(req, {
        action: 'MFA_VERIFY_FAILED',
        entityType: 'mfa',
        entityId: userId,
        outcome: 'denied',
        details: { method: 'totp' },
      });
      return res.status(400).json({ error: 'Invalid or expired TOTP code' });
    }

    // Activate the credential if this is the enrollment verification
    const wasInactive = !result.rows[0].is_active;

    await Promise.all([
      wasInactive
        ? query('UPDATE mfa_credentials SET is_active = true WHERE user_id = $1 AND method = $2', [userId, 'totp'])
        : query('UPDATE mfa_credentials SET last_used_at = NOW() WHERE user_id = $1 AND method = $2', [userId, 'totp']),
      // Mark session as MFA-verified
      query('UPDATE user_sessions SET mfa_verified_at = NOW() WHERE id = $1', [sid]),
    ]);

    await audit(req, {
      action: wasInactive ? 'MFA_ENROLLED' : 'MFA_VERIFIED',
      entityType: 'mfa',
      entityId: userId,
      details: { method: 'totp', sessionId: sid },
    });

    res.json({
      verified: true,
      enrolled: true,
      message:  wasInactive ? 'TOTP enrolled and verified successfully.' : 'MFA verified. Session is now fully authenticated.',
    });
  } catch (err) { next(err); }
}

// ── DISABLE TOTP ──────────────────────────────────────────────────────────────
async function disableTotp(req, res, next) {
  try {
    const { id: userId } = req.user;
    const { password } = req.body;

    if (!password) return res.status(400).json({ error: 'Password required to disable MFA' });

    // Verify password before disabling MFA (credential confirmation)
    const userRes = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (!userRes.rows.length) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(password, userRes.rows[0].password_hash);
    if (!valid) {
      await audit(req, {
        action: 'MFA_DISABLE_FAILED',
        entityType: 'mfa',
        entityId: userId,
        outcome: 'denied',
        details: { reason: 'invalid_password' },
      });
      return res.status(403).json({ error: 'Incorrect password' });
    }

    const result = await query(
      'UPDATE mfa_credentials SET is_active = false WHERE user_id = $1 AND method = $2 RETURNING id',
      [userId, 'totp']
    );

    if (!result.rows.length) return res.status(404).json({ error: 'TOTP credential not found' });

    await audit(req, {
      action: 'MFA_DISABLED',
      entityType: 'mfa',
      entityId: userId,
      details: { method: 'totp' },
    });

    res.json({ disabled: true, message: 'TOTP disabled. Re-enroll before next login.' });
  } catch (err) { next(err); }
}

module.exports = { mfaStatus, setupTotp, verifyMfa, disableTotp };
