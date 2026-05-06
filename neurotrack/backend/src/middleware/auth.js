const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Doctors can only access patients assigned to them unless they are admin
async function requirePatientAccess(req, res, next) {
  if (req.user.role === 'admin') return next();

  const { query } = require('../config/database');
  const patientId = req.params.id || req.params.patientId;

  try {
    const result = await query(
      'SELECT primary_doctor_id FROM patients WHERE id = $1',
      [patientId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Patient not found' });

    if (result.rows[0].primary_doctor_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied to this patient record' });
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticate, requireRole, requirePatientAccess };
