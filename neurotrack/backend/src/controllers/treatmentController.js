const { query } = require('../config/database');

async function listTreatments(req, res, next) {
  try {
    const { diagnosis, type } = req.query;
    const conditions = ['t.is_active = true'];
    const params = [];
    let i = 1;
    if (diagnosis) { conditions.push(`t.diagnosis_type IN ($${i++}, 'both')`); params.push(diagnosis); }
    if (type)      { conditions.push(`t.treatment_type = $${i++}`);            params.push(type); }

    const result = await query(
      `SELECT t.*,
         COUNT(DISTINCT pt.patient_id) AS active_patient_count,
         COUNT(DISTINCT trl.research_paper_id) AS linked_paper_count
       FROM treatments t
       LEFT JOIN patient_treatments pt ON pt.treatment_id = t.id AND pt.is_active = true
       LEFT JOIN treatment_research_links trl ON trl.treatment_id = t.id
       WHERE ${conditions.join(' AND ')}
       GROUP BY t.id
       ORDER BY t.name`,
      params
    );
    res.json(result.rows);
  } catch (err) { next(err); }
}

async function getTreatment(req, res, next) {
  try {
    const [tRes, papersRes] = await Promise.all([
      query('SELECT * FROM treatments WHERE id = $1', [req.params.id]),
      query(
        `SELECT rp.id, rp.title, rp.authors, rp.publication_year, rp.journal,
                trl.relevance_notes
         FROM treatment_research_links trl
         JOIN research_papers rp ON trl.research_paper_id = rp.id
         WHERE trl.treatment_id = $1`,
        [req.params.id]
      ),
    ]);
    if (!tRes.rows.length) return res.status(404).json({ error: 'Treatment not found' });
    res.json({ ...tRes.rows[0], researchPapers: papersRes.rows });
  } catch (err) { next(err); }
}

async function createTreatment(req, res, next) {
  try {
    const { name, description, treatmentType, diagnosisType } = req.body;
    const result = await query(
      `INSERT INTO treatments (name, description, treatment_type, diagnosis_type, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, description, treatmentType, diagnosisType, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
}

async function updateTreatment(req, res, next) {
  try {
    const { name, description, diagnosisType, isActive } = req.body;
    const result = await query(
      `UPDATE treatments SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         diagnosis_type = COALESCE($3, diagnosis_type),
         is_active = COALESCE($4, is_active)
       WHERE id = $5 RETURNING *`,
      [name, description, diagnosisType, isActive, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Treatment not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
}

module.exports = { listTreatments, getTreatment, createTreatment, updateTreatment };
