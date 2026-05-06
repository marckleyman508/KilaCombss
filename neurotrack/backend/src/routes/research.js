const router = require('express').Router();
const c = require('../controllers/researchController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

router.get('/',         c.listPapers);
router.get('/:id',      c.getPaper);
router.post('/',        requireRole('admin', 'doctor'), c.createPaper);
router.put('/:id',      requireRole('admin', 'doctor'), c.updatePaper);
router.delete('/:id',   requireRole('admin'),           c.deletePaper);
router.post('/:id/link-treatment', requireRole('admin', 'doctor'), c.linkToTreatment);

module.exports = router;
