const router = require('express').Router();
const c = require('../controllers/patientController');
const { authenticate, requireRole, requirePatientAccess } = require('../middleware/auth');
const v = require('../middleware/validation');

router.use(authenticate);

router.get('/',    v.patientListRules, c.listPatients);
router.post('/',   requireRole('admin', 'doctor'), v.patientCreateRules, c.createPatient);
router.get('/:id', v.uuid(), requirePatientAccess, c.getPatient);
router.put('/:id', requireRole('admin', 'doctor'), v.patientUpdateRules, requirePatientAccess, c.updatePatient);

router.get('/:id/timeline',        v.uuid(), requirePatientAccess, c.getTimeline);
router.get('/:id/progress',        v.uuid(), requirePatientAccess, c.getProgressLogs);
router.post('/:id/progress',       requireRole('admin', 'doctor'), v.progressRules, requirePatientAccess, c.addProgressLog);
router.post('/:id/medications',    requireRole('admin', 'doctor'), v.medicationRules, requirePatientAccess, c.addMedication);
router.put('/:id/medications/:medId', requireRole('admin', 'doctor'), v.uuid(), v.uuid('medId'), v.validate, requirePatientAccess, c.updateMedication);
router.post('/:id/surgeries',      requireRole('admin', 'doctor'), v.surgeryRules, requirePatientAccess, c.addSurgery);

module.exports = router;
