-- HIPAA Compliance Migration
-- Run AFTER schema.sql
-- Adds: MFA credentials, session idle tracking, HIPAA-enhanced audit fields,
--       patient ID hashing column, WORM-style retention marker

-- ─────────────────────────────────────────
-- 1. SESSION: idle timeout tracking + MFA
-- ─────────────────────────────────────────
ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mfa_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_sessions_last_active
  ON user_sessions(last_active_at) WHERE revoked_at IS NULL;

-- ─────────────────────────────────────────
-- 2. MFA CREDENTIALS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mfa_credentials (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method           VARCHAR(20) NOT NULL CHECK (method IN ('totp', 'webauthn')),
  -- Stored as AES-256-GCM encrypted ciphertext (iv:tag:data, all base64)
  credential_hash  TEXT        NOT NULL,
  is_active        BOOLEAN     NOT NULL DEFAULT false,
  enrolled_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at     TIMESTAMPTZ,
  UNIQUE (user_id, method)
);

CREATE INDEX IF NOT EXISTS idx_mfa_credentials_user ON mfa_credentials(user_id) WHERE is_active = true;

-- ─────────────────────────────────────────
-- 3. AUDIT LOGS: HIPAA-required fields
-- ─────────────────────────────────────────
-- patient_id_hash: HMAC-SHA256(mrn, AUDIT_PEPPER) — enables per-patient search
--                  without exposing MRN in logs
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS patient_id_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS session_id       UUID;

CREATE INDEX IF NOT EXISTS idx_audit_logs_patient_id_hash
  ON audit_logs(patient_id_hash, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id
  ON audit_logs(session_id);

-- ─────────────────────────────────────────
-- 4. AUDIT RETENTION MARKER (HIPAA § 164.530(j): 6 years)
-- ─────────────────────────────────────────
-- This table records when each audit_log row may be purged.
-- Actual WORM enforcement is done at storage layer (S3 Object Lock / pg_audit export).
CREATE TABLE IF NOT EXISTS audit_retention_policy (
  entity_type     VARCHAR(50) PRIMARY KEY,
  retain_years    SMALLINT    NOT NULL DEFAULT 6,
  legal_hold      BOOLEAN     NOT NULL DEFAULT false,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO audit_retention_policy (entity_type, retain_years) VALUES
  ('patient',                 6),
  ('progress_log',            6),
  ('medication',              6),
  ('surgery',                 6),
  ('auth',                    6),
  ('session',                 6),
  ('mfa',                     6),
  ('research_paper',          6),
  ('treatment_research_link', 6),
  ('global_search',           6)
ON CONFLICT (entity_type) DO NOTHING;

-- ─────────────────────────────────────────
-- 5. BREAK-GLASS ACCESS LOG
-- For admin viewing PHI (admin role normally should not see clinical notes)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS break_glass_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  patient_id   UUID        REFERENCES patients(id) ON DELETE SET NULL,
  reason       TEXT        NOT NULL,
  authorized_by UUID       REFERENCES users(id) ON DELETE SET NULL,
  accessed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_break_glass_user    ON break_glass_log(user_id, accessed_at);
CREATE INDEX IF NOT EXISTS idx_break_glass_patient ON break_glass_log(patient_id, accessed_at);

-- break-glass log is also immutable
CREATE OR REPLACE FUNCTION prevent_break_glass_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'break_glass_log entries cannot be modified after revocation';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'break_glass_log is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_break_glass_no_mutation ON break_glass_log;
CREATE TRIGGER trg_break_glass_no_mutation
  BEFORE UPDATE OR DELETE ON break_glass_log
  FOR EACH ROW EXECUTE FUNCTION prevent_break_glass_mutation();
