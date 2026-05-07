const router = require('express').Router();
const c = require('../controllers/aiController');
const { authenticate, requireRole, requirePatientAccess } = require('../middleware/auth');
const { uuid } = require('../middleware/validation');

// All AI endpoints require authentication
router.use(authenticate);

// ── Cohort-level (aggregate, no individual patient data) ──────────────────────
// Any authenticated role may access — patientScope ensures data isolation
router.get('/cohort-insights', c.cohortInsights);

// ── Patient-level — requires patient access AND doctor/admin role ─────────────
router.get(
  '/patients/:id/trends',
  uuid(), requireRole('admin', 'doctor'), requirePatientAccess,
  c.patientTrends
);

router.get(
  '/patients/:id/anomalies',
  uuid(), requireRole('admin', 'doctor'), requirePatientAccess,
  c.patientAnomalies
);

router.get(
  '/patients/:id/summary',
  uuid(), requireRole('admin', 'doctor'), requirePatientAccess,
  c.weeklyTherapistSummary
);

router.get(
  '/patients/:id/rehab-effectiveness',
  uuid(), requireRole('admin', 'doctor'), requirePatientAccess,
  c.rehabEffectiveness
);

router.get(
  '/patients/:id/research-match',
  uuid(), requireRole('admin', 'doctor'), requirePatientAccess,
  c.researchMatch
);

module.exports = router;
