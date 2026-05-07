const { query } = require('../config/database');
const { audit } = require('../utils/audit');
const { patientScope } = require('../utils/accessScope');

async function globalSearch(req, res, next) {
  try {
    const { q } = req.query;
    const term = `%${q.trim()}%`;
    const scope = patientScope(req.user, 'p', 2);

    const [patients, papers, treatments] = await Promise.all([
      query(
        `SELECT id, mrn, first_name, last_name, diagnosis_type, disease_stage
         FROM patients p
         WHERE p.is_active = true
           AND ${scope.sql}
           AND (p.first_name ILIKE $1 OR p.last_name ILIKE $1 OR p.mrn ILIKE $1)
         LIMIT 10`,
        [term, ...scope.params]
      ),
      query(
        `SELECT id, title, publication_year, journal, diagnosis_relevance
         FROM research_papers
         WHERE title ILIKE $1 OR abstract ILIKE $1 OR $2 = ANY(tags)
         LIMIT 10`,
        [term, q.trim()]
      ),
      query(
        `SELECT id, name, treatment_type, diagnosis_type
         FROM treatments
         WHERE is_active = true AND (name ILIKE $1 OR description ILIKE $1)
         LIMIT 10`,
        [term]
      ),
    ]);

    await audit(req, {
      action: 'SEARCH',
      entityType: 'global_search',
      details: {
        patientResultCount: patients.rows.length,
        researchResultCount: papers.rows.length,
        treatmentResultCount: treatments.rows.length,
      },
    });

    res.json({
      patients: patients.rows,
      researchPapers: papers.rows,
      treatments: treatments.rows,
    });
  } catch (err) { next(err); }
}

module.exports = { globalSearch };
