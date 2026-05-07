ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'doctor', 'caregiver', 'patient'));

CREATE TABLE IF NOT EXISTS roles (
  name        VARCHAR(20) PRIMARY KEY CHECK (name IN ('admin', 'doctor', 'caregiver', 'patient')),
  description TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO roles (name, description) VALUES
  ('admin', 'Platform administrator with break-glass oversight privileges'),
  ('doctor', 'Clinician with access to assigned patient records'),
  ('caregiver', 'Approved caregiver with explicitly granted patient access'),
  ('patient', 'Patient with access only to their own record')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_roles (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_name  VARCHAR(20) NOT NULL REFERENCES roles(name) ON DELETE RESTRICT,
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role_name)
);

INSERT INTO user_roles (user_id, role_name, granted_by)
SELECT id, role, 'a1000000-0000-0000-0000-000000000001'::uuid
FROM users
ON CONFLICT (user_id, role_name) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_patient_access (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_id  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  access_role VARCHAR(20) NOT NULL CHECK (access_role IN ('doctor', 'caregiver', 'patient')),
  granted_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at  TIMESTAMPTZ,
  PRIMARY KEY (user_id, patient_id, access_role)
);

CREATE INDEX IF NOT EXISTS idx_user_patient_access_user_id ON user_patient_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_patient_access_patient_id ON user_patient_access(patient_id);

CREATE TABLE IF NOT EXISTS user_sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash VARCHAR(128) NOT NULL,
  access_token_jti   UUID NOT NULL,
  ip_address         VARCHAR(45),
  user_agent         VARCHAR(500),
  device_fingerprint VARCHAR(255),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  refreshed_at       TIMESTAMPTZ,
  expires_at         TIMESTAMPTZ NOT NULL,
  revoked_at         TIMESTAMPTZ,
  revoke_reason      VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_token_hash ON user_sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, expires_at) WHERE revoked_at IS NULL;

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_no_update ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS trg_audit_logs_no_delete ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
