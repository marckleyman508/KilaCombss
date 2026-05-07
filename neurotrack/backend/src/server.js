require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { errorHandler } = require('./middleware/errorHandler');
const { authenticate } = require('./middleware/auth');
const { searchRules } = require('./middleware/validation');
const { globalSearch } = require('./controllers/searchController');
const { installLogSanitizer, sanitizeForLog } = require('./utils/hipaaCompliance');

// Strip PHI from all server-side logs in production (HIPAA § 164.312(c)(1))
installLogSanitizer();

const app = express();

// ── Request correlation ID ────────────────────────────────────────────────────
app.use((req, _res, next) => {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
  next();
});

// ── Security ─────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
// Development: very permissive; Production: stricter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 100000,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later.',
});

app.use(limiter);

// ── Parsing ───────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// Morgan with PHI sanitization in production (HIPAA § 164.312(c)(1))
if (process.env.NODE_ENV === 'production') {
  morgan.token('sanitized-url', (req) => sanitizeForLog(req.originalUrl));
  app.use(morgan(':remote-addr - :method :sanitized-url :status :res[content-length] - :response-time ms'));
} else {
  app.use(morgan('dev'));
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/mfa',        require('./routes/mfa'));
app.use('/api/admin',      require('./routes/admin'));
app.use('/api/patients',   require('./routes/patients'));
app.use('/api/analytics',  require('./routes/analytics'));
app.use('/api/ai',         require('./routes/ai'));
app.use('/api/research',   require('./routes/research'));
app.use('/api/treatments', require('./routes/treatments'));
app.get('/api/search', authenticate, searchRules, globalSearch);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`NeuroTrack API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = app;
