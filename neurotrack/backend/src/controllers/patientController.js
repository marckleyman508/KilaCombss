const { query } = require('../config/database');

// ── LIST ────────────────────────────────────────────────────────────────────
async function listPatients(req, res, next) {
  try {
    const { diagnosis, stage, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const conditions = ['p.is_active = true'];
    const params = [];
    let i = 1;

    if (req.user.role === 'doctor') {
      conditions.push(`p.primary_doctor_id = $${i++}`);
      params.push(req.user.id);
    }
    if (diagnosis) { conditions.push(`p.diagnosis_type = $${i++}`); params.push(diagnosis); }
    if (stage)     { conditions.push(`p.disease_stage = $${i++}`);   params.push(stage); }
    if (search) {
      conditions.push(`(p.first_name ILIKE $${i} OR p.last_name ILIKE $${i} OR p.mrn ILIKE $${i})`);
      params.push(`%${search}%`); i++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM patients p ${where}`,
      params
    );

    const result = await query(
      `SELECT p.id, p.mrn, p.first_name, p.last_name, p.date_of_birth,
              p.diagnosis_type, p.disease_stage, p.diagnosis_date, p.is_active,
              u.first_name AS doctor_first_name, u.last_name AS doctor_last_name
       FROM patients p
       LEFT JOIN users u ON p.primary_doctor_id = u.id
       ${where}
       ORDER BY p.last_name, p.first_name
       LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    );

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) { next(err); }
}

// ── GET ONE ──────────────────────────────────────────────────────────────────
async function getPatient(req, res, next) {
  try {
    const { id } = req.params;

    const [patientRes, historyRes, surgeriesRes, medsRes, treatmentsRes] = await Promise.all([
      query(
        `SELECT p.*, u.first_name AS doctor_first_name, u.last_name AS doctor_last_name,
                u.specialty AS doctor_specialty
         FROM patients p LEFT JOIN users u ON p.primary_doctor_id = u.id
         WHERE p.id = $1`,
        [id]
      ),
      query('SELECT * FROM medical_history WHERE patient_id = $1 ORDER BY onset_date DESC NULLS LAST', [id]),
      query('SELECT * FROM surgeries WHERE patient_id = $1 ORDER BY procedure_date DESC', [id]),
      query('SELECT * FROM medications WHERE patient_id = $1 ORDER BY is_current DESC, start_date DESC', [id]),
      query(
        `SELECT pt.*, t.name, t.treatment_type, t.description
         FROM patient_treatments pt
         JOIN treatments t ON pt.treatment_id = t.id
         WHERE pt.patient_id = $1 ORDER BY pt.start_date DESC`,
        [id]
      ),
    ]);

    if (!patientRes.rows.length) return res.status(404).json({ error: 'Patient not found' });

    res.json({
      ...patientRes.rows[0],
      medicalHistory: historyRes.rows,
      surgeries: surgeriesRes.rows,
      medications: medsRes.rows,
      treatments: treatmentsRes.rows,
    });
  } catch (err) { next(err); }
}

// ── CREATE ────────────────────────────────────────────────────────────────────
async function createPatient(req, res, next) {
  try {
    const {
      mrn, firstName, lastName, dateOfBirth, gender, email, phone, address,
      emergencyContactName, emergencyContactPhone, primaryDoctorId,
      diagnosisType, diagnosisDate, diseaseStage,
    } = req.body;

    const result = await query(
      `INSERT INTO patients (mrn, first_name, last_name, date_of_birth, gender, email, phone,
         address, emergency_contact_name, emergency_contact_phone, primary_doctor_id,
         diagnosis_type, diagnosis_date, disease_stage)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [mrn, firstName, lastName, dateOfBirth, gender, email, phone, address,
       emergencyContactName, emergencyContactPhone, primaryDoctorId,
       diagnosisType, diagnosisDate, diseaseStage]
    );

    // Auto-create diagnosis event
    await query(
      `INSERT INTO patient_events (patient_id, event_type, event_date, title, recorded_by)
       VALUES ($1, 'diagnosis', $2, $3, $4)`,
      [result.rows[0].id, diagnosisDate || new Date(),
       `${diagnosisType === 'alzheimers' ? "Alzheimer's" : "Parkinson's"} Disease Diagnosis`,
       req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
}

// ── UPDATE ────────────────────────────────────────────────────────────────────
async function updatePatient(req, res, next) {
  try {
    const { id } = req.params;
    const {
      firstName, lastName, dateOfBirth, gender, email, phone, address,
      emergencyContactName, emergencyContactPhone, primaryDoctorId,
      diagnosisDate, diseaseStage,
    } = req.body;

    const result = await query(
      `UPDATE patients SET
         first_name = COALESCE($1, first_name),
         last_name = COALESCE($2, last_name),
         date_of_birth = COALESCE($3, date_of_birth),
         gender = COALESCE($4, gender),
         email = COALESCE($5, email),
         phone = COALESCE($6, phone),
         address = COALESCE($7, address),
         emergency_contact_name = COALESCE($8, emergency_contact_name),
         emergency_contact_phone = COALESCE($9, emergency_contact_phone),
         primary_doctor_id = COALESCE($10, primary_doctor_id),
         diagnosis_date = COALESCE($11, diagnosis_date),
         disease_stage = COALESCE($12, disease_stage)
       WHERE id = $13 RETURNING *`,
      [firstName, lastName, dateOfBirth, gender, email, phone, address,
       emergencyContactName, emergencyContactPhone, primaryDoctorId,
       diagnosisDate, diseaseStage, id]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Patient not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
}

// ── TIMELINE ──────────────────────────────────────────────────────────────────
async function getTimeline(req, res, next) {
  try {
    const result = await query(
      `SELECT * FROM patient_events WHERE patient_id = $1
       ORDER BY event_date DESC, created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
}

// ── PROGRESS LOGS ─────────────────────────────────────────────────────────────
async function getProgressLogs(req, res, next) {
  try {
    const result = await query(
      `SELECT pl.*, u.first_name AS recorded_by_first, u.last_name AS recorded_by_last
       FROM progress_logs pl
       LEFT JOIN users u ON pl.recorded_by = u.id
       WHERE pl.patient_id = $1
       ORDER BY pl.log_date ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
}

async function addProgressLog(req, res, next) {
  try {
    const {
      logDate, mmseScore, mocaScore, cognitiveNotes,
      tremorSeverity, mobilityScore, rigidityScore, bradykinesiaScore, motorNotes,
      overallCondition, clinicianNotes,
    } = req.body;

    const result = await query(
      `INSERT INTO progress_logs
         (patient_id, recorded_by, log_date, mmse_score, moca_score, cognitive_notes,
          tremor_severity, mobility_score, rigidity_score, bradykinesia_score, motor_notes,
          overall_condition, clinician_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [req.params.id, req.user.id, logDate || new Date(),
       mmseScore, mocaScore, cognitiveNotes,
       tremorSeverity, mobilityScore, rigidityScore, bradykinesiaScore, motorNotes,
       overallCondition, clinicianNotes]
    );

    // Create timeline event
    await query(
      `INSERT INTO patient_events (patient_id, event_type, event_date, title, description, related_entity_type, related_entity_id, recorded_by)
       VALUES ($1, 'progress_log', $2, 'Clinical Assessment', $3, 'progress_log', $4, $5)`,
      [req.params.id, logDate || new Date(),
       `Condition: ${overallCondition || 'unknown'}. ${clinicianNotes || ''}`,
       result.rows[0].id, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
}

// ── MEDICATIONS ────────────────────────────────────────────────────────────────
async function addMedication(req, res, next) {
  try {
    const { medicationName, dosage, frequency, startDate, endDate, notes } = req.body;
    const result = await query(
      `INSERT INTO medications (patient_id, medication_name, dosage, frequency, start_date, end_date, prescribed_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.params.id, medicationName, dosage, frequency, startDate, endDate, req.user.id, notes]
    );
    await query(
      `INSERT INTO patient_events (patient_id, event_type, event_date, title, related_entity_type, related_entity_id, recorded_by)
       VALUES ($1, 'medication_start', $2, $3, 'medication', $4, $5)`,
      [req.params.id, startDate || new Date(), `Started ${medicationName}`, result.rows[0].id, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
}

async function updateMedication(req, res, next) {
  try {
    const { isCurrent, endDate, notes } = req.body;
    const result = await query(
      `UPDATE medications SET
         is_current = COALESCE($1, is_current),
         end_date = COALESCE($2, end_date),
         notes = COALESCE($3, notes)
       WHERE id = $4 AND patient_id = $5 RETURNING *`,
      [isCurrent, endDate, notes, req.params.medId, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Medication not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
}

// ── SURGERIES ──────────────────────────────────────────────────────────────────
async function addSurgery(req, res, next) {
  try {
    const { procedureName, procedureDate, performingSurgeon, facility, outcome, notes } = req.body;
    const result = await query(
      `INSERT INTO surgeries (patient_id, procedure_name, procedure_date, performing_surgeon, facility, outcome, notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.params.id, procedureName, procedureDate, performingSurgeon, facility, outcome, notes, req.user.id]
    );
    await query(
      `INSERT INTO patient_events (patient_id, event_type, event_date, title, related_entity_type, related_entity_id, recorded_by)
       VALUES ($1, 'surgery', $2, $3, 'surgery', $4, $5)`,
      [req.params.id, procedureDate, procedureName, result.rows[0].id, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
}

module.exports = {
  listPatients, getPatient, createPatient, updatePatient,
  getTimeline, getProgressLogs, addProgressLog,
  addMedication, updateMedication, addSurgery,
};
