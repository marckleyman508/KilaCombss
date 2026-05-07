/**
 * AI-assisted analysis endpoints.
 *
 * IMPORTANT: All outputs are statistical summaries for clinical reference only.
 * This system does NOT provide medical diagnoses or treatment recommendations.
 */

const { query } = require('../config/database');
const { audit } = require('../utils/audit');
const { patientScope } = require('../utils/accessScope');
const { analyzeTrend, detectAnomalies, computeOverallTrend } = require('../utils/trends');

const DISCLAIMER =
  'This output is a statistical summary for clinical reference only and does not constitute medical advice or diagnosis.';

// ── PATIENT TREND ANALYSIS ───────────────────────────────────────────────────
async function patientTrends(req, res, next) {
  try {
    const { id } = req.params;
    const weeks = Math.min(Math.max(parseInt(req.query.weeks) || 12, 4), 52);

    const result = await query(
      `SELECT log_date, mmse_score, moca_score, tremor_severity,
              mobility_score, rigidity_score, overall_condition
       FROM progress_logs
       WHERE patient_id = $1
         AND log_date >= CURRENT_DATE - ($2 || ' weeks')::INTERVAL
       ORDER BY log_date ASC`,
      [id, weeks]
    );

    const logs = result.rows;

    if (logs.length < 2) {
      await audit(req, {
        action: 'VIEW', entityType: 'ai_trends', entityId: id,
        details: { outcome: 'insufficient_data', logCount: logs.length },
      });
      return res.json({
        patientId: id,
        status: 'insufficient_data',
        message: 'At least 2 assessments required for trend analysis',
        minimumRequired: 2,
        currentCount: logs.length,
        disclaimer: DISCLAIMER,
      });
    }

    const trends = {
      mmse:     logs.some(l => l.mmse_score    !== null) ? analyzeTrend(logs, 'mmse_score')    : null,
      moca:     logs.some(l => l.moca_score    !== null) ? analyzeTrend(logs, 'moca_score')    : null,
      mobility: logs.some(l => l.mobility_score !== null) ? analyzeTrend(logs, 'mobility_score') : null,
      tremor:   logs.some(l => l.tremor_severity !== null) ? analyzeTrend(logs, 'tremor_severity') : null,
    };

    const anomalies = detectAnomalies(logs);

    await audit(req, {
      action: 'VIEW', entityType: 'ai_trends', entityId: id,
      details: { weeksAnalyzed: weeks, logCount: logs.length, anomalyCount: anomalies.length },
    });

    res.json({
      patientId:      id,
      analysisWindow: `${weeks} weeks`,
      dataPoints:     logs.length,
      trends,
      anomalies,
      generatedAt:    new Date().toISOString(),
      disclaimer:     DISCLAIMER,
    });
  } catch (err) { next(err); }
}

// ── ANOMALY DETECTION ────────────────────────────────────────────────────────
async function patientAnomalies(req, res, next) {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT log_date, mmse_score, moca_score, tremor_severity,
              mobility_score, overall_condition
       FROM progress_logs
       WHERE patient_id = $1
       ORDER BY log_date ASC`,
      [id]
    );

    const logs     = result.rows;
    const anomalies = detectAnomalies(logs);

    await audit(req, {
      action: 'VIEW', entityType: 'ai_anomalies', entityId: id,
      details: { totalAssessments: logs.length, anomalyCount: anomalies.length },
    });

    res.json({
      patientId:         id,
      totalAssessments:  logs.length,
      anomalies,
      generatedAt:       new Date().toISOString(),
      disclaimer:        'Anomalies are statistical deviations. Clinical significance requires professional evaluation.',
    });
  } catch (err) { next(err); }
}

// ── THERAPIST WEEKLY SUMMARY ─────────────────────────────────────────────────
async function weeklyTherapistSummary(req, res, next) {
  try {
    const { id } = req.params;

    const [patientRes, logsRes, medsRes, treatmentsRes] = await Promise.all([
      query(
        `SELECT p.first_name, p.last_name, p.diagnosis_type, p.disease_stage, p.mrn
         FROM patients p WHERE p.id = $1`,
        [id]
      ),
      query(
        `SELECT log_date, mmse_score, moca_score, tremor_severity, mobility_score,
                overall_condition, clinician_notes
         FROM progress_logs
         WHERE patient_id = $1
           AND log_date >= CURRENT_DATE - INTERVAL '30 days'
         ORDER BY log_date DESC`,
        [id]
      ),
      query(
        `SELECT medication_name, dosage, frequency
         FROM medications WHERE patient_id = $1 AND is_current = true`,
        [id]
      ),
      query(
        `SELECT t.name, t.treatment_type, pt.start_date
         FROM patient_treatments pt
         JOIN treatments t ON t.id = pt.treatment_id
         WHERE pt.patient_id = $1 AND pt.is_active = true`,
        [id]
      ),
    ]);

    if (!patientRes.rows.length) return res.status(404).json({ error: 'Patient not found' });

    const patient    = patientRes.rows[0];
    const logs       = logsRes.rows;
    const latestLog  = logs[0] || null;
    const previousLog = logs[1] || null;

    const cognitiveChange =
      latestLog?.mmse_score != null && previousLog?.mmse_score != null
        ? { mmse: latestLog.mmse_score - previousLog.mmse_score }
        : null;

    const motorChange =
      latestLog?.mobility_score != null && previousLog?.mobility_score != null
        ? { mobility: latestLog.mobility_score - previousLog.mobility_score }
        : null;

    await audit(req, {
      action: 'VIEW', entityType: 'ai_weekly_summary', entityId: id,
      details: { logCount: logs.length },
    });

    res.json({
      patient: {
        name:      `${patient.first_name} ${patient.last_name}`,
        mrn:       patient.mrn,
        diagnosis: patient.diagnosis_type,
        stage:     patient.disease_stage,
      },
      reportPeriod: {
        from: new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10),
        to:   new Date().toISOString().slice(0, 10),
      },
      assessmentCount:  logs.length,
      latestAssessment: latestLog ? {
        date:             latestLog.log_date,
        mmseScore:        latestLog.mmse_score,
        mocaScore:        latestLog.moca_score,
        mobilityScore:    latestLog.mobility_score,
        tremorSeverity:   latestLog.tremor_severity,
        overallCondition: latestLog.overall_condition,
        clinicianNotes:   latestLog.clinician_notes,
      } : null,
      recentChanges: {
        cognitive: cognitiveChange,
        motor:     motorChange,
      },
      currentMedications: medsRes.rows,
      activeTreatments:   treatmentsRes.rows,
      overallTrend:       computeOverallTrend(logs),
      generatedAt:        new Date().toISOString(),
      disclaimer:         DISCLAIMER,
    });
  } catch (err) { next(err); }
}

// ── REHAB EFFECTIVENESS ──────────────────────────────────────────────────────
// Correlates active treatment periods with logged outcomes (observational only)
async function rehabEffectiveness(req, res, next) {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT
         t.name                AS treatment_name,
         t.treatment_type,
         pt.start_date,
         pt.end_date,
         COUNT(pl.id)          AS log_count,
         ROUND(AVG(CASE
           WHEN pl.overall_condition = 'improved' THEN  1
           WHEN pl.overall_condition = 'stable'   THEN  0
           WHEN pl.overall_condition = 'declined' THEN -1
           ELSE NULL
         END), 2)              AS avg_outcome_score,
         ROUND(AVG(pl.mmse_score), 1)     AS avg_mmse,
         ROUND(AVG(pl.mobility_score), 1) AS avg_mobility
       FROM patient_treatments pt
       JOIN treatments t ON t.id = pt.treatment_id
       LEFT JOIN progress_logs pl
         ON pl.patient_id = pt.patient_id
        AND pl.log_date BETWEEN
              COALESCE(pt.start_date, '2000-01-01')
              AND COALESCE(pt.end_date, CURRENT_DATE)
       WHERE pt.patient_id = $1
       GROUP BY t.name, t.treatment_type, pt.start_date, pt.end_date
       ORDER BY pt.start_date DESC NULLS LAST`,
      [id]
    );

    await audit(req, {
      action: 'VIEW', entityType: 'ai_rehab_effectiveness', entityId: id,
      details: { treatmentCount: result.rows.length },
    });

    res.json({
      patientId:  id,
      treatments: result.rows,
      note:       'Outcome scores are observational correlations only — not evidence of causation.',
      generatedAt: new Date().toISOString(),
      disclaimer:  DISCLAIMER,
    });
  } catch (err) { next(err); }
}

// ── RESEARCH MATCHING ────────────────────────────────────────────────────────
async function researchMatch(req, res, next) {
  try {
    const { id } = req.params;

    const [patientRes, recentLogsRes] = await Promise.all([
      query('SELECT diagnosis_type, disease_stage FROM patients WHERE id = $1', [id]),
      query(
        `SELECT overall_condition FROM progress_logs
         WHERE patient_id = $1 ORDER BY log_date DESC LIMIT 3`,
        [id]
      ),
    ]);

    if (!patientRes.rows.length) return res.status(404).json({ error: 'Patient not found' });

    const { diagnosis_type, disease_stage } = patientRes.rows[0];
    const recentConditions = recentLogsRes.rows.map(r => r.overall_condition);
    const isDeclining = recentConditions.filter(c => c === 'declined').length >= 2;

    const searchTags = [diagnosis_type];
    if (disease_stage) searchTags.push(disease_stage);
    if (isDeclining)   searchTags.push('rapid_progression');

    const result = await query(
      `SELECT id, title, authors, publication_year, journal, abstract,
              tags, diagnosis_relevance, summary, doi
       FROM research_papers
       WHERE $1 = ANY(diagnosis_relevance)
          OR tags && $2::text[]
       ORDER BY publication_year DESC NULLS LAST
       LIMIT 5`,
      [diagnosis_type, searchTags]
    );

    await audit(req, {
      action: 'VIEW', entityType: 'ai_research_match', entityId: id,
      details: { matchCount: result.rows.length, tags: searchTags },
    });

    res.json({
      patientId:   id,
      matchedTags: searchTags,
      papers:      result.rows,
      generatedAt: new Date().toISOString(),
      disclaimer:  'Research matches are based on metadata similarity only and do not imply clinical recommendation.',
    });
  } catch (err) { next(err); }
}

// ── COHORT-LEVEL INSIGHTS (aggregate, no individual data) ────────────────────
async function cohortInsights(req, res, next) {
  try {
    const scope = patientScope(req.user, 'p', 1);

    const result = await query(`
      WITH monthly AS (
        SELECT
          p.diagnosis_type,
          DATE_TRUNC('month', pl.log_date)     AS month,
          AVG(pl.mmse_score)                   AS avg_mmse,
          AVG(pl.moca_score)                   AS avg_moca,
          AVG(pl.mobility_score)               AS avg_mobility,
          COUNT(DISTINCT pl.patient_id)        AS patient_count
        FROM progress_logs pl
        JOIN patients p ON p.id = pl.patient_id
        WHERE pl.log_date >= NOW() - INTERVAL '6 months'
          AND p.is_active = true
          AND ${scope.sql}
        GROUP BY p.diagnosis_type, DATE_TRUNC('month', pl.log_date)
      )
      SELECT * FROM monthly ORDER BY month, diagnosis_type
    `, scope.params);

    const byDiagnosis = {};
    for (const row of result.rows) {
      if (!byDiagnosis[row.diagnosis_type]) byDiagnosis[row.diagnosis_type] = [];
      byDiagnosis[row.diagnosis_type].push(row);
    }

    const insights = Object.entries(byDiagnosis).map(([diagnosis, data]) => {
      if (data.length < 2) return { diagnosis, status: 'insufficient_data' };
      const first = data[0];
      const last  = data[data.length - 1];

      const mmseChange     = last.avg_mmse     && first.avg_mmse     ? parseFloat((last.avg_mmse - first.avg_mmse).toFixed(1))         : null;
      const mobilityChange = last.avg_mobility && first.avg_mobility ? parseFloat((last.avg_mobility - first.avg_mobility).toFixed(1)) : null;

      return {
        diagnosis,
        period:             { from: first.month, to: last.month },
        avgMmseChange:      mmseChange,
        avgMobilityChange:  mobilityChange,
        latestCohortSize:   last.patient_count,
        trend:              mmseChange > 0 ? 'improving' : mmseChange < -2 ? 'declining' : 'stable',
      };
    });

    await audit(req, { action: 'VIEW', entityType: 'ai_cohort_insights' });

    res.json({
      insights,
      generatedAt: new Date().toISOString(),
      disclaimer:  'Cohort insights are statistical aggregates and do not constitute medical findings.',
    });
  } catch (err) { next(err); }
}

module.exports = {
  patientTrends,
  patientAnomalies,
  weeklyTherapistSummary,
  rehabEffectiveness,
  researchMatch,
  cohortInsights,
};
