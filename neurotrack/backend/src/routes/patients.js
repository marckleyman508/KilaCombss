const router = require('express').Router();
const c = require('../controllers/patientController');
const { authenticate, requireRole, requirePatientAccess } = require('../middleware/auth');

router.use(authenticate);

router.get('/',    c.listPatients);
router.post('/',   requireRole('admin', 'doctor'), c.createPatient);
router.get('/:id', requirePatientAccess, c.getPatient);
router.put('/:id', requirePatientAccess, c.updatePatient);

router.get('/:id/timeline',        requirePatientAccess, c.getTimeline);
router.get('/:id/progress',        requirePatientAccess, c.getProgressLogs);
router.post('/:id/progress',       requirePatientAccess, c.addProgressLog);
router.post('/:id/medications',    requirePatientAccess, c.addMedication);
router.put('/:id/medications/:medId', requirePatientAccess, c.updateMedication);
router.post('/:id/surgeries',      requirePatientAccess, c.addSurgery);

module.exports = router;
