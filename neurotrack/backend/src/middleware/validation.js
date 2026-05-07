const { body, param, query, validationResult } = require('express-validator');
const { checkCommonPatterns, checkBreachedPassword } = require('../utils/hipaaCompliance');

const uuid = (name = 'id') => param(name).isUUID().withMessage(`${name} must be a valid UUID`);
const optionalUuidBody = (name) => body(name).optional({ nullable: true }).isUUID();
const optionalDateBody = (name) => body(name).optional({ nullable: true }).isISO8601().toDate();
const textBody = (name, max = 255) => body(name).trim().isLength({ min: 1, max });
const optionalTextBody = (name, max = 255) => body(name).optional({ nullable: true }).trim().isLength({ max });

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

// Login: minimal validation (don't expose policy details to unauthenticated callers)
const loginRules = [
  body('email').isEmail().normalizeEmail().isLength({ max: 255 }),
  body('password').isString().isLength({ min: 1, max: 256 }),
  validate,
];

// NIST SP 800-63B password creation rules (for password change / admin user creation)
// min 12 chars, no composition rules, HIBP breach check, common pattern block
const passwordCreationRules = [
  body('password')
    .isString()
    .isLength({ min: 12, max: 256 })
    .withMessage('Password must be at least 12 characters')
    .custom((value) => {
      if (checkCommonPatterns(value)) {
        throw new Error('Password matches a common or easily guessed pattern');
      }
      return true;
    })
    .custom(async (value) => {
      const breached = await checkBreachedPassword(value);
      if (breached) throw new Error('Password was found in a known data breach. Choose a different password.');
      return true;
    }),
  validate,
];

const patientListRules = [
  query('diagnosis').optional().isIn(['alzheimers', 'parkinsons', 'other']),
  query('stage').optional().isIn(['early', 'moderate', 'advanced']),
  query('search').optional().trim().isLength({ max: 100 }),
  query('page').optional().isInt({ min: 1, max: 10000 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  validate,
];

const searchRules = [
  query('q').trim().isLength({ min: 2, max: 100 }),
  validate,
];

const patientCreateRules = [
  textBody('mrn', 50),
  textBody('firstName', 100),
  textBody('lastName', 100),
  body('dateOfBirth').isISO8601().toDate(),
  body('gender').optional({ nullable: true }).isIn(['female', 'male', 'nonbinary', 'other', 'unknown']),
  body('email').optional({ nullable: true }).isEmail().normalizeEmail().isLength({ max: 255 }),
  optionalTextBody('phone', 50),
  optionalTextBody('address', 1000),
  optionalTextBody('emergencyContactName', 200),
  optionalTextBody('emergencyContactPhone', 50),
  optionalUuidBody('primaryDoctorId'),
  body('diagnosisType').isIn(['alzheimers', 'parkinsons', 'other']),
  optionalDateBody('diagnosisDate'),
  body('diseaseStage').optional({ nullable: true }).isIn(['early', 'moderate', 'advanced']),
  validate,
];

const patientUpdateRules = [
  uuid(),
  body('firstName').optional().trim().isLength({ min: 1, max: 100 }),
  body('lastName').optional().trim().isLength({ min: 1, max: 100 }),
  optionalDateBody('dateOfBirth'),
  body('gender').optional({ nullable: true }).isIn(['female', 'male', 'nonbinary', 'other', 'unknown']),
  body('email').optional({ nullable: true }).isEmail().normalizeEmail().isLength({ max: 255 }),
  optionalTextBody('phone', 50),
  optionalTextBody('address', 1000),
  optionalTextBody('emergencyContactName', 200),
  optionalTextBody('emergencyContactPhone', 50),
  optionalUuidBody('primaryDoctorId'),
  optionalDateBody('diagnosisDate'),
  body('diseaseStage').optional({ nullable: true }).isIn(['early', 'moderate', 'advanced']),
  validate,
];

const progressRules = [
  uuid(),
  optionalDateBody('logDate'),
  body('mmseScore').optional({ nullable: true }).isInt({ min: 0, max: 30 }).toInt(),
  body('mocaScore').optional({ nullable: true }).isInt({ min: 0, max: 30 }).toInt(),
  optionalTextBody('cognitiveNotes', 2000),
  body('tremorSeverity').optional({ nullable: true }).isInt({ min: 0, max: 4 }).toInt(),
  body('mobilityScore').optional({ nullable: true }).isInt({ min: 0, max: 100 }).toInt(),
  body('rigidityScore').optional({ nullable: true }).isInt({ min: 0, max: 4 }).toInt(),
  body('bradykinesiaScore').optional({ nullable: true }).isInt({ min: 0, max: 4 }).toInt(),
  optionalTextBody('motorNotes', 2000),
  body('overallCondition').optional({ nullable: true }).isIn(['improved', 'stable', 'declined', 'unknown']),
  optionalTextBody('clinicianNotes', 2000),
  validate,
];

const medicationRules = [
  uuid(),
  textBody('medicationName', 255),
  optionalTextBody('dosage', 100),
  optionalTextBody('frequency', 100),
  optionalDateBody('startDate'),
  optionalDateBody('endDate'),
  optionalTextBody('notes', 2000),
  validate,
];

const surgeryRules = [
  uuid(),
  textBody('procedureName', 255),
  body('procedureDate').isISO8601().toDate(),
  optionalTextBody('performingSurgeon', 200),
  optionalTextBody('facility', 200),
  body('outcome').optional({ nullable: true }).isIn(['successful', 'complicated', 'ongoing_recovery', 'unknown']),
  optionalTextBody('notes', 2000),
  validate,
];

module.exports = {
  loginRules,
  passwordCreationRules,
  medicationRules,
  patientCreateRules,
  patientListRules,
  patientUpdateRules,
  progressRules,
  searchRules,
  surgeryRules,
  uuid,
  validate,
};
