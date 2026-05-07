const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { breachInvestigation, activeSessions, revokeUserSessions } = require('../controllers/adminController');
const { uuid } = require('../middleware/validation');

// All admin endpoints: authenticated + admin role only
router.use(authenticate, requireRole('admin'));

// HIPAA § 164.308(a)(6) — Security Incident Procedures
router.get('/breach-investigation', breachInvestigation);

// Session oversight
router.get('/sessions',                   activeSessions);
router.delete('/sessions/user/:userId',   uuid('userId'), revokeUserSessions);

module.exports = router;
