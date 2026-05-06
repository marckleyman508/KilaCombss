const router = require('express').Router();
const c = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/overview',               c.overview);
router.get('/cohort-comparison',      c.cohortComparison);
router.get('/treatment-effectiveness', c.treatmentEffectiveness);
router.get('/risk-flags',             c.riskFlags);
router.get('/patient/:id/progress',   c.patientProgress);

module.exports = router;
