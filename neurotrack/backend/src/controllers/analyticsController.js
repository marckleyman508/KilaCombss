const { query } = require('../config/database');

// ── OVERVIEW KPIs ─────────────────────────────────────────────────────────────
async function overview(req, res, next) {
  try {
    const [totals, stageBreakdown, recentLogs] = await Promise.all([
      query(`
        SELECT
          COUNT(*) FILTER (WHERE is_active = true)               AS total_patients,
          COUNT(*) FILTER (WHERE diagnosis_type = 'alzheimers')  AS alzheimers_count,
          COUNT(*) FILTER (WHERE diagnosis_type = 'parkinsons')  AS parkinsons_count,
          COUNT(*) FILTER (WHERE disease_stage = 'early')        AS stage_early,
          COUNT(*) FILTER (WHERE disease_stage = 'moderate')     AS stage_moderate,
          COUNT(*) FILTER (WHERE disease_stage = 'advanced')     AS stage_advanced
        FROM patients WHERE is_active = true
      `),
      query(`
        SELECT disease_stage, diagnosis_type, COUNT(*) AS count
        FROM patients WHERE is_active = true
        GROUP BY disease_stage, diagnosis_type
        ORDER BY diagnosis_type, disease_stage
      `),
      query(`
        SELECT COUNT(*) AS logs_this_month
        FROM progress_logs
        WHERE log_date >= date_trunc('month', CURRENT_DATE)
      `),
    ]);

    res.json({
      kpis: totals.rows[0],
      stageBreakdown: stageBreakdown.rows,
      logsThisMonth: parseInt(recentLogs.rows[0].logs_this_month),
    });
  } catch (err) { next(err); }
}

// ── COHORT COMPARISON ─────────────────────────────────────────────────────────
async function cohortComparison(req, res, next) {
  try {
    const result = await query(`
      SELECT
        p.diagnosis_type,
        DATE_TRUNC('month', pl.log_date) AS month,
        ROUND(AVG(pl.mmse_score), 1)      AS avg_mmse,
        ROUND(AVG(pl.moca_score), 1)      AS avg_moca,
        ROUND(AVG(pl.mobility_score), 1)  AS avg_mobility,
        ROUND(AVG(pl.tremor_severity), 2) AS avg_tremor,
        COUNT(DISTINCT pl.patient_id)     AS patient_count
      FROM progress_logs pl
      JOIN patients p ON pl.patient_id = p.id
      WHERE pl.log_date >= NOW() - INTERVAL '12 months'
      GROUP BY p.diagnosis_type, DATE_TRUNC('month', pl.log_date)
      ORDER BY month, p.diagnosis_type
    `);
    res.json(result.rows);
  } catch (err) { next(err); }
}

// ── TREATMENT EFFECTIVENESS ───────────────────────────────────────────────────
async function treatmentEffectiveness(req, res, next) {
  try {
    const result = await query(`
      SELECT
        t.name AS treatment_name,
        t.treatment_type,
        t.diagnosis_type,
        COUNT(DISTINCT pt.patient_id) AS patient_count,
        ROUND(AVG(CASE WHEN pl.overall_condition = 'improved' THEN 1
                       WHEN pl.overall_condition = 'stable'   THEN 0
                       WHEN pl.overall_condition = 'declined' THEN -1
                       ELSE NULL END), 2) AS avg_outcome_score
      FROM treatments t
      JOIN patient_treatments pt ON pt.treatment_id = t.id
      JOIN progress_logs pl ON pl.patient_id = pt.patient_id
        AND pl.log_date BETWEEN COALESCE(pt.start_date, '2000-01-01') AND COALESCE(pt.end_date, CURRENT_DATE)
      WHERE t.is_active = true
      GROUP BY t.id, t.name, t.treatment_type, t.diagnosis_type
      HAVING COUNT(DISTINCT pt.patient_id) > 0
      ORDER BY avg_outcome_score DESC NULLS LAST
    `);
    res.json(result.rows);
  } catch (err) { next(err); }
}

// ── RISK FLAGS ────────────────────────────────────────────────────────────────
// Rule-based: flags patients with clinically notable patterns
async function riskFlags(req, res, next) {
  try {
    const result = await query(`
      WITH latest_logs AS (
        SELECT DISTINCT ON (patient_id)
          patient_id, log_date, mmse_score, moca_score,
          tremor_severity, mobility_score, overall_condition
        FROM progress_logs
        ORDER BY patient_id, log_date DESC
      ),
      prev_logs AS (
        SELECT DISTINCT ON (patient_id)
          patient_id, log_date AS prev_date,
          mmse_score AS prev_mmse, mobility_score AS prev_mobility
        FROM progress_logs
        WHERE log_date < (SELECT MAX(log_date) - INTERVAL '30 days' FROM progress_logs)
        ORDER BY patient_id, log_date DESC
      )
      SELECT
        p.id, p.mrn, p.first_name, p.last_name, p.diagnosis_type, p.disease_stage,
        ll.log_date, ll.mmse_score, ll.moca_score, ll.tremor_severity, ll.mobility_score,
        ll.overall_condition,
        -- Flag: rapid MMSE decline (>3 points in 30 days)
        CASE WHEN (ll.mmse_score IS NOT NULL AND pl2.prev_mmse IS NOT NULL
                   AND (pl2.prev_mmse - ll.mmse_score) >= 3) THEN true ELSE false END AS flag_rapid_cognitive_decline,
        -- Flag: low MMSE (<10)
        CASE WHEN ll.mmse_score IS NOT NULL AND ll.mmse_score < 10 THEN true ELSE false END AS flag_severe_cognitive_impairment,
        -- Flag: high tremor severity
        CASE WHEN ll.tremor_severity IS NOT NULL AND ll.tremor_severity >= 4 THEN true ELSE false END AS flag_severe_tremor,
        -- Flag: poor mobility
        CASE WHEN ll.mobility_score IS NOT NULL AND ll.mobility_score < 40 THEN true ELSE false END AS flag_poor_mobility,
        -- Flag: no recent assessment (>60 days)
        CASE WHEN ll.log_date < CURRENT_DATE - INTERVAL '60 days' OR ll.log_date IS NULL THEN true ELSE false END AS flag_overdue_assessment,
        -- Flag: consecutive declines
        CASE WHEN ll.overall_condition = 'declined' THEN true ELSE false END AS flag_declined_last_visit
      FROM patients p
      LEFT JOIN latest_logs ll ON ll.patient_id = p.id
      LEFT JOIN prev_logs pl2 ON pl2.patient_id = p.id
      WHERE p.is_active = true
        AND (
          (ll.mmse_score IS NOT NULL AND ll.mmse_score < 10)
          OR (pl2.prev_mmse IS NOT NULL AND ll.mmse_score IS NOT NULL AND (pl2.prev_mmse - ll.mmse_score) >= 3)
          OR (ll.tremor_severity IS NOT NULL AND ll.tremor_severity >= 4)
          OR (ll.mobility_score IS NOT NULL AND ll.mobility_score < 40)
          OR (ll.log_date < CURRENT_DATE - INTERVAL '60 days')
          OR ll.overall_condition = 'declined'
        )
      ORDER BY p.last_name
    `);
    res.json(result.rows);
  } catch (err) { next(err); }
}

// ── PATIENT PROGRESS (single patient, for charts) ────────────────────────────
async function patientProgress(req, res, next) {
  try {
    const result = await query(
      `SELECT log_date, mmse_score, moca_score, tremor_severity,
              mobility_score, rigidity_score, overall_condition
       FROM progress_logs WHERE patient_id = $1
       ORDER BY log_date ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
}

module.exports = { overview, cohortComparison, treatmentEffectiveness, riskFlags, patientProgress };
