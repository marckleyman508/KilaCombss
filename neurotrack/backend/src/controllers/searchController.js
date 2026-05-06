const { query } = require('../config/database');

async function globalSearch(req, res, next) {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }
    const term = `%${q.trim()}%`;

    const [patients, papers, treatments] = await Promise.all([
      query(
        `SELECT id, mrn, first_name, last_name, diagnosis_type, disease_stage
         FROM patients
         WHERE is_active = true AND (first_name ILIKE $1 OR last_name ILIKE $1 OR mrn ILIKE $1)
         LIMIT 10`,
        [term]
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

    res.json({
      patients: patients.rows,
      researchPapers: papers.rows,
      treatments: treatments.rows,
    });
  } catch (err) { next(err); }
}

module.exports = { globalSearch };
