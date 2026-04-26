import { body, param, query, ValidationChain } from 'express-validator';

// ────────────────────────────────────────────────────────────────────────────
// Auth Validators
// ────────────────────────────────────────────────────────────────────────────

export const validateRegister: ValidationChain[] = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 50 })
    .withMessage('First name cannot exceed 50 characters'),

  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ max: 50 })
    .withMessage('Last name cannot exceed 50 characters'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^(\+234|0)[789]\d{9}$/)
    .withMessage('Please provide a valid Nigerian phone number'),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),

  body('kycType')
    .notEmpty()
    .withMessage('KYC type is required')
    .isIn(['bvn', 'nin', 'BVN', 'NIN'])
    .withMessage('KYC type must be either bvn or nin'),

  body('kycID')
    .trim()
    .notEmpty()
    .withMessage('KYC ID (BVN/NIN) is required')
    .isLength({ min: 11, max: 11 })
    .withMessage('BVN/NIN must be exactly 11 digits')
    .isNumeric()
    .withMessage('BVN/NIN must contain only numbers'),

  body('dob')
    .notEmpty()
    .withMessage('Date of birth is required')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Date of birth must be in YYYY-MM-DD format'),
];

export const validateLogin: ValidationChain[] = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address'),

  body('password').notEmpty().withMessage('Password is required'),
];

// ────────────────────────────────────────────────────────────────────────────
// Transfer Validators
// ────────────────────────────────────────────────────────────────────────────

export const validateTransfer: ValidationChain[] = [
  body('toAccount')
    .trim()
    .notEmpty()
    .withMessage('Recipient account number is required')
    .isLength({ min: 10, max: 10 })
    .withMessage('Account number must be exactly 10 digits')
    .isNumeric()
    .withMessage('Account number must contain only digits'),

  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 1 })
    .withMessage('Amount must be greater than or equal to 1'),

  body('narration')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Narration cannot exceed 255 characters'),

  body('bankCode')
    .optional()
    .trim()
    .isNumeric()
    .withMessage('Bank code must be numeric'),
];

// ────────────────────────────────────────────────────────────────────────────
// Account Number Param Validator
// ────────────────────────────────────────────────────────────────────────────

export const validateAccountNumber = [
  param('accountNumber')
    .trim()
    .notEmpty()
    .withMessage('Account number is required')
    .isLength({ min: 10, max: 10 })
    .withMessage('Account number must be exactly 10 digits')
    .isNumeric()
    .withMessage('Account number must contain only digits'),
];

// ────────────────────────────────────────────────────────────────────────────
// Transaction Query Validators
// ────────────────────────────────────────────────────────────────────────────

export const validateTransactionQuery: ValidationChain[] = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('status')
    .optional()
    .isIn(['pending', 'successful', 'failed'])
    .withMessage('Status must be pending, successful, or failed'),

  query('type')
    .optional()
    .isIn(['credit', 'debit'])
    .withMessage('Type must be credit or debit'),

  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('startDate must be a valid ISO 8601 date'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('endDate must be a valid ISO 8601 date'),
];
