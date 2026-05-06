-- NeuroTrack PostgreSQL Schema
-- Run: psql -U postgres -d neurotrack -f schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────
-- USERS (doctors / admins)
-- ─────────────────────────────────────────
CREATE TABLE users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  role          VARCHAR(20)  NOT NULL CHECK (role IN ('admin', 'doctor')),
  specialty     VARCHAR(100),
  license_number VARCHAR(100),
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- PATIENTS
-- ─────────────────────────────────────────
CREATE TABLE patients (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  mrn                     VARCHAR(50) UNIQUE NOT NULL,  -- Medical Record Number
  first_name              VARCHAR(100) NOT NULL,
  last_name               VARCHAR(100) NOT NULL,
  date_of_birth           DATE         NOT NULL,
  gender                  VARCHAR(20),
  email                   VARCHAR(255),
  phone                   VARCHAR(50),
  address                 TEXT,
  emergency_contact_name  VARCHAR(200),
  emergency_contact_phone VARCHAR(50),
  primary_doctor_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
  diagnosis_type          VARCHAR(20)  NOT NULL CHECK (diagnosis_type IN ('alzheimers', 'parkinsons', 'other')),
  diagnosis_date          DATE,
  disease_stage           VARCHAR(50),  -- 'early', 'moderate', 'advanced'
  is_active               BOOLEAN      NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patients_diagnosis_type    ON patients(diagnosis_type);
CREATE INDEX idx_patients_primary_doctor_id ON patients(primary_doctor_id);
CREATE INDEX idx_patients_mrn               ON patients(mrn);

-- ─────────────────────────────────────────
-- MEDICAL HISTORY
-- ─────────────────────────────────────────
CREATE TABLE medical_history (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  condition_name VARCHAR(255) NOT NULL,
  onset_date     DATE,
  resolution_date DATE,
  is_ongoing     BOOLEAN      NOT NULL DEFAULT true,
  notes          TEXT,
  recorded_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_medical_history_patient_id ON medical_history(patient_id);

-- ─────────────────────────────────────────
-- SURGERIES AND PROCEDURES
-- ─────────────────────────────────────────
CREATE TABLE surgeries (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id         UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  procedure_name     VARCHAR(255) NOT NULL,
  procedure_date     DATE         NOT NULL,
  performing_surgeon VARCHAR(200),
  facility           VARCHAR(200),
  outcome            VARCHAR(100),  -- 'successful', 'complicated', 'ongoing_recovery'
  notes              TEXT,
  recorded_by        UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_surgeries_patient_id ON surgeries(patient_id);

-- ─────────────────────────────────────────
-- MEDICATIONS
-- ─────────────────────────────────────────
CREATE TABLE medications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  medication_name VARCHAR(255) NOT NULL,
  dosage          VARCHAR(100),
  frequency       VARCHAR(100),
  start_date      DATE,
  end_date        DATE,
  is_current      BOOLEAN      NOT NULL DEFAULT true,
  prescribed_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_medications_patient_id ON medications(patient_id);
CREATE INDEX idx_medications_is_current  ON medications(is_current);

-- ─────────────────────────────────────────
-- TREATMENTS (catalog)
-- ─────────────────────────────────────────
CREATE TABLE treatments (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(255) NOT NULL,
  description    TEXT,
  treatment_type VARCHAR(50)  NOT NULL CHECK (treatment_type IN (
                   'pharmacological', 'physical_therapy',
                   'cognitive_therapy', 'occupational_therapy',
                   'speech_therapy', 'surgical', 'other')),
  diagnosis_type VARCHAR(20)  CHECK (diagnosis_type IN ('alzheimers', 'parkinsons', 'both', 'other')),
  is_active      BOOLEAN      NOT NULL DEFAULT true,
  created_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- PATIENT ↔ TREATMENT (junction)
-- ─────────────────────────────────────────
CREATE TABLE patient_treatments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  treatment_id  UUID        NOT NULL REFERENCES treatments(id) ON DELETE CASCADE,
  start_date    DATE,
  end_date      DATE,
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  prescribed_by UUID        REFERENCES users(id) ON DELETE SET NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (patient_id, treatment_id, start_date)
);

CREATE INDEX idx_patient_treatments_patient_id   ON patient_treatments(patient_id);
CREATE INDEX idx_patient_treatments_treatment_id ON patient_treatments(treatment_id);

-- ─────────────────────────────────────────
-- PROGRESS LOGS (clinical assessments)
-- ─────────────────────────────────────────
CREATE TABLE progress_logs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id        UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  recorded_by       UUID        REFERENCES users(id) ON DELETE SET NULL,
  log_date          DATE         NOT NULL DEFAULT CURRENT_DATE,

  -- Cognitive metrics (both diagnoses)
  mmse_score        SMALLINT    CHECK (mmse_score BETWEEN 0 AND 30),   -- Mini-Mental State Exam
  moca_score        SMALLINT    CHECK (moca_score BETWEEN 0 AND 30),   -- Montreal Cognitive Assessment
  cognitive_notes   TEXT,

  -- Motor metrics (Parkinson's primary)
  tremor_severity   SMALLINT    CHECK (tremor_severity BETWEEN 0 AND 4),
  mobility_score    SMALLINT    CHECK (mobility_score BETWEEN 0 AND 100),
  rigidity_score    SMALLINT    CHECK (rigidity_score BETWEEN 0 AND 4),
  bradykinesia_score SMALLINT   CHECK (bradykinesia_score BETWEEN 0 AND 4),
  motor_notes       TEXT,

  -- Overall
  overall_condition VARCHAR(20)  CHECK (overall_condition IN ('improved', 'stable', 'declined', 'unknown')),
  clinician_notes   TEXT,

  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_progress_logs_patient_id ON progress_logs(patient_id);
CREATE INDEX idx_progress_logs_log_date   ON progress_logs(log_date);

-- ─────────────────────────────────────────
-- RESEARCH PAPERS
-- ─────────────────────────────────────────
CREATE TABLE research_papers (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title               VARCHAR(500) NOT NULL,
  authors             TEXT[]       NOT NULL DEFAULT '{}',
  publication_year    SMALLINT,
  journal             VARCHAR(255),
  doi                 VARCHAR(255) UNIQUE,
  abstract            TEXT,
  tags                TEXT[]       NOT NULL DEFAULT '{}',
  diagnosis_relevance VARCHAR(20)[] NOT NULL DEFAULT '{}',  -- ['alzheimers','parkinsons']
  external_url        VARCHAR(500),
  summary             TEXT,         -- Clinician-written plain-language summary
  added_by            UUID         REFERENCES users(id) ON DELETE SET NULL,
  -- Placeholder fields for future API ingestion (PubMed, etc.)
  external_source     VARCHAR(50),  -- 'pubmed', 'crossref', 'manual'
  external_id         VARCHAR(100), -- PubMed ID, etc.
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_research_papers_tags                ON research_papers USING GIN(tags);
CREATE INDEX idx_research_papers_diagnosis_relevance ON research_papers USING GIN(diagnosis_relevance);

-- ─────────────────────────────────────────
-- TREATMENT ↔ RESEARCH PAPER (junction)
-- ─────────────────────────────────────────
CREATE TABLE treatment_research_links (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_id      UUID        NOT NULL REFERENCES treatments(id) ON DELETE CASCADE,
  research_paper_id UUID        NOT NULL REFERENCES research_papers(id) ON DELETE CASCADE,
  relevance_notes   TEXT,
  linked_by         UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (treatment_id, research_paper_id)
);

-- ─────────────────────────────────────────
-- PATIENT EVENTS (timeline)
-- ─────────────────────────────────────────
CREATE TABLE patient_events (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id           UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  event_type           VARCHAR(30)  NOT NULL CHECK (event_type IN (
                          'diagnosis', 'surgery', 'medication_start',
                          'medication_stop', 'progress_log', 'hospital_visit',
                          'treatment_start', 'treatment_stop', 'note')),
  event_date           DATE         NOT NULL,
  title                VARCHAR(255) NOT NULL,
  description          TEXT,
  related_entity_type  VARCHAR(30),   -- 'surgery', 'medication', 'progress_log', etc.
  related_entity_id    UUID,
  recorded_by          UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patient_events_patient_id  ON patient_events(patient_id);
CREATE INDEX idx_patient_events_event_date  ON patient_events(event_date);

-- ─────────────────────────────────────────
-- AUDIT LOGS
-- ─────────────────────────────────────────
CREATE TABLE audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(50)  NOT NULL,  -- 'CREATE', 'UPDATE', 'DELETE', 'VIEW'
  entity_type VARCHAR(50)  NOT NULL,
  entity_id   UUID,
  ip_address  VARCHAR(45),
  user_agent  VARCHAR(500),
  details     JSONB,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id     ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_created_at  ON audit_logs(created_at);

-- ─────────────────────────────────────────
-- UPDATED_AT trigger function
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at            BEFORE UPDATE ON users            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_patients_updated_at         BEFORE UPDATE ON patients         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_medications_updated_at      BEFORE UPDATE ON medications      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_treatments_updated_at       BEFORE UPDATE ON treatments       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_progress_logs_updated_at    BEFORE UPDATE ON progress_logs    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_research_papers_updated_at  BEFORE UPDATE ON research_papers  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
