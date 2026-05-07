const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { login, logout, me, refresh } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { loginRules } = require('../middleware/validation');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login',   loginLimiter,   loginRules,  login);
router.post('/refresh', refreshLimiter, refresh);
router.post('/logout',  authenticate,   logout);
router.get('/me',       authenticate,   me);

module.exports = router;
