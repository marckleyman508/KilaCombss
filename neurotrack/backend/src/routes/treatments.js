const router = require('express').Router();
const c = require('../controllers/treatmentController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

router.get('/',     c.listTreatments);
router.get('/:id',  c.getTreatment);
router.post('/',    requireRole('admin', 'doctor'), c.createTreatment);
router.put('/:id',  requireRole('admin', 'doctor'), c.updateTreatment);

module.exports = router;
