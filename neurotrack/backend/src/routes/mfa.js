const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { mfaStatus, setupTotp, verifyMfa, disableTotp } = require('../controllers/mfaController');

// All MFA routes require a valid access token.
// They are deliberately exempt from the MFA check in authenticate()
// (the /api/mfa/ prefix is in MFA_EXEMPT_PREFIXES).
router.use(authenticate);

router.get('/status',       mfaStatus);
router.post('/setup/totp',  setupTotp);
router.post('/verify',      verifyMfa);
router.delete('/totp',      disableTotp);

module.exports = router;
