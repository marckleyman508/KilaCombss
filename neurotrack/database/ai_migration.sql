-- AI insights cache table
-- Stores pre-computed summaries for performance; treated as non-authoritative
-- (source of truth is always the live computation against progress_logs)

CREATE TABLE IF NOT EXISTS ai_insight_cache (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  insight_type   VARCHAR(50) NOT NULL CHECK (insight_type IN (
                   'trends', 'anomalies', 'weekly_summary',
                   'rehab_effectiveness', 'research_match')),
  payload        JSONB       NOT NULL,
  generated_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
  generated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ NOT NULL,
  invalidated_at TIMESTAMPTZ,
  UNIQUE (patient_id, insight_type)
);

CREATE INDEX idx_ai_insight_cache_patient ON ai_insight_cache(patient_id);
CREATE INDEX idx_ai_insight_cache_expires ON ai_insight_cache(expires_at) WHERE invalidated_at IS NULL;

-- Auto-invalidate cache when a new progress log is added
CREATE OR REPLACE FUNCTION invalidate_ai_cache_on_progress()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ai_insight_cache
     SET invalidated_at = NOW()
   WHERE patient_id    = NEW.patient_id
     AND invalidated_at IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invalidate_ai_cache
  AFTER INSERT ON progress_logs
  FOR EACH ROW EXECUTE FUNCTION invalidate_ai_cache_on_progress();
