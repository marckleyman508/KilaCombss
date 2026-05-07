const router = require('express').Router();
const c = require('../controllers/analyticsController');
const { authenticate, requirePatientAccess } = require('../middleware/auth');
const { uuid } = require('../middleware/validation');

router.use(authenticate);

router.get('/overview',               c.overview);
router.get('/cohort-comparison',      c.cohortComparison);
router.get('/treatment-effectiveness', c.treatmentEffectiveness);
router.get('/risk-flags',             c.riskFlags);
router.get('/patient/:id/progress',   uuid(), requirePatientAccess, c.patientProgress);

module.exports = router;
