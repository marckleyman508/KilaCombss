/**
 * HIPAA compliance utilities.
 *
 * hashPatientId  — HMAC-SHA256(mrn, AUDIT_PEPPER) for audit log correlation
 *                  without storing the raw MRN in logs.
 *
 * encryptField   — AES-256-GCM encryption for PHI fields stored at application
 *                  layer. Format: base64(iv):base64(tag):base64(ciphertext)
 *
 * decryptField   — Inverse of encryptField.
 *
 * sanitizeForLog — Redacts PHI patterns before writing to application logs.
 *                  Applied to Morgan and console output in production.
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

// ── Patient ID hashing ───────────────────────────────────────────────────────

function hashPatientId(mrn) {
  if (!mrn) return null;
  const pepper = process.env.AUDIT_PEPPER;
  if (!pepper) {
    if (process.env.NODE_ENV === 'production') throw new Error('AUDIT_PEPPER must be set in production');
    return crypto.createHash('sha256').update(`dev:${mrn}`).digest('hex');
  }
  return crypto.createHmac('sha256', pepper).update(String(mrn)).digest('hex');
}

// ── Field-level AES-256-GCM encryption ──────────────────────────────────────

function getFieldKey() {
  const keyHex = process.env.FIELD_ENCRYPTION_KEY;
  if (!keyHex) {
    if (process.env.NODE_ENV === 'production') throw new Error('FIELD_ENCRYPTION_KEY must be set in production');
    // Dev-only deterministic fallback (NOT secure — never use in production)
    return Buffer.alloc(32, 0xDE);
  }
  if (keyHex.length !== 64) throw new Error('FIELD_ENCRYPTION_KEY must be exactly 64 hex chars (256-bit key)');
  return Buffer.from(keyHex, 'hex');
}

function encryptField(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;
  const iv  = crypto.randomBytes(12);
  const key = getFieldKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc  = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag  = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

function decryptField(ciphertext) {
  if (!ciphertext) return null;
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted field format');
  const [ivB64, tagB64, encB64] = parts;
  const iv  = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const enc = Buffer.from(encB64, 'base64');
  const key = getFieldKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc) + decipher.final('utf8');
}

// ── Log sanitization ─────────────────────────────────────────────────────────
// Removes PHI patterns from log strings before they reach stdout.
// Applied in Morgan token and to any console.error calls via wrapConsole().

const PHI_PATTERNS = [
  // SSN
  { re: /\b\d{3}-\d{2}-\d{4}\b/g,            sub: '[SSN]'       },
  // US phone numbers
  { re: /\b(?:\+1[\s.-])?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g, sub: '[PHONE]' },
  // ISO dates that might be DOB (YYYY-MM-DD)
  { re: /\b(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/g, sub: '[DATE]' },
  // JSON PHI field values
  { re: /"(first_name|last_name|email|phone|address|mrn|date_of_birth|clinician_notes|cognitive_notes|motor_notes)"\s*:\s*"[^"]{1,300}"/gi,
    sub: '"$1":"[REDACTED]"' },
  // URL-encoded email in query strings
  { re: /email=[^&\s]{3,255}/gi, sub: 'email=[REDACTED]' },
];

function sanitizeForLog(text) {
  if (typeof text !== 'string') return text;
  let out = text;
  for (const { re, sub } of PHI_PATTERNS) {
    out = out.replace(re, sub);
  }
  return out;
}

/**
 * Wraps console.error so PHI is stripped from all server-side error logs.
 * Call once at startup in server.js.
 */
function installLogSanitizer() {
  if (process.env.NODE_ENV !== 'production') return;
  const orig = console.error.bind(console);
  console.error = (...args) => orig(...args.map(a =>
    typeof a === 'string' ? sanitizeForLog(a) :
    typeof a === 'object' ? JSON.parse(sanitizeForLog(JSON.stringify(a))) :
    a
  ));
}

// ── Password quality checks (NIST SP 800-63B) ───────────────────────────────

const COMMON_PATTERNS = [
  /^password/i, /^123456/, /^qwerty/i, /^letmein/i,
  /^welcome/i, /^admin/i, /^neurotrack/i,
  /^(.)\1{5,}/, // 6+ repeating chars
];

function checkCommonPatterns(password) {
  return COMMON_PATTERNS.some(re => re.test(password));
}

/**
 * HIBP k-anonymity check. Returns true if password was found in a breach.
 * Uses SHA-1 prefix (first 5 chars) — the plaintext password never leaves the process.
 * Caller should handle network failures gracefully (log and continue).
 */
async function checkBreachedPassword(password) {
  const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      signal: controller.signal,
      headers: { 'Add-Padding': 'true' },
    });
    clearTimeout(timer);
    if (!res.ok) return false; // HIBP unavailable — fail open
    const text = await res.text();
    return text.split('\r\n').some(line => line.split(':')[0] === suffix);
  } catch {
    clearTimeout(timer);
    return false; // Network error — fail open, log separately
  }
}

module.exports = {
  hashPatientId,
  encryptField,
  decryptField,
  sanitizeForLog,
  installLogSanitizer,
  checkCommonPatterns,
  checkBreachedPassword,
};
