const { query } = require('../config/database');

async function listPapers(req, res, next) {
  try {
    const { diagnosis, tag, search, page = 1, limit = 20 } = req.query;
    const conditions = [];
    const params = [];
    let i = 1;

    if (diagnosis) { conditions.push(`$${i++} = ANY(diagnosis_relevance)`); params.push(diagnosis); }
    if (tag)       { conditions.push(`$${i++} = ANY(tags)`);                params.push(tag); }
    if (search) {
      conditions.push(`(title ILIKE $${i} OR abstract ILIKE $${i} OR $${i} = ANY(tags))`);
      params.push(`%${search}%`); i++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const [countResult, result] = await Promise.all([
      query(`SELECT COUNT(*) FROM research_papers ${where}`, params),
      query(
        `SELECT id, title, authors, publication_year, journal, doi, tags,
                diagnosis_relevance, summary, external_source, created_at
         FROM research_papers ${where}
         ORDER BY publication_year DESC NULLS LAST, created_at DESC
         LIMIT $${i} OFFSET $${i + 1}`,
        [...params, limit, offset]
      ),
    ]);

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) { next(err); }
}

async function getPaper(req, res, next) {
  try {
    const [paperRes, linksRes] = await Promise.all([
      query('SELECT * FROM research_papers WHERE id = $1', [req.params.id]),
      query(
        `SELECT trl.*, t.name AS treatment_name, t.treatment_type
         FROM treatment_research_links trl
         JOIN treatments t ON trl.treatment_id = t.id
         WHERE trl.research_paper_id = $1`,
        [req.params.id]
      ),
    ]);
    if (!paperRes.rows.length) return res.status(404).json({ error: 'Paper not found' });
    res.json({ ...paperRes.rows[0], treatmentLinks: linksRes.rows });
  } catch (err) { next(err); }
}

async function createPaper(req, res, next) {
  try {
    const {
      title, authors, publicationYear, journal, doi, abstract,
      tags, diagnosisRelevance, externalUrl, summary, externalSource, externalId,
    } = req.body;

    const result = await query(
      `INSERT INTO research_papers
         (title, authors, publication_year, journal, doi, abstract, tags,
          diagnosis_relevance, external_url, summary, added_by, external_source, external_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [title, authors || [], publicationYear, journal, doi, abstract,
       tags || [], diagnosisRelevance || [], externalUrl, summary,
       req.user.id, externalSource || 'manual', externalId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
}

async function updatePaper(req, res, next) {
  try {
    const { title, summary, tags, diagnosisRelevance, externalUrl } = req.body;
    const result = await query(
      `UPDATE research_papers SET
         title = COALESCE($1, title),
         summary = COALESCE($2, summary),
         tags = COALESCE($3, tags),
         diagnosis_relevance = COALESCE($4, diagnosis_relevance),
         external_url = COALESCE($5, external_url)
       WHERE id = $6 RETURNING *`,
      [title, summary, tags, diagnosisRelevance, externalUrl, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Paper not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
}

async function deletePaper(req, res, next) {
  try {
    const result = await query('DELETE FROM research_papers WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Paper not found' });
    res.status(204).end();
  } catch (err) { next(err); }
}

async function linkToTreatment(req, res, next) {
  try {
    const { treatmentId, relevanceNotes } = req.body;
    const result = await query(
      `INSERT INTO treatment_research_links (treatment_id, research_paper_id, relevance_notes, linked_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (treatment_id, research_paper_id) DO UPDATE SET relevance_notes = $3
       RETURNING *`,
      [treatmentId, req.params.id, relevanceNotes, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
}

module.exports = { listPapers, getPaper, createPaper, updatePaper, deletePaper, linkToTreatment };
