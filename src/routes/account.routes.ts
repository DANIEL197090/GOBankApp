import { Router } from 'express';
import * as accountController from '../controllers/account.controller';
import { protect, requireAccount } from '../middleware/auth.middleware';
import { validateAccountNumber } from '../middleware/validate.middleware';
import { handleValidationErrors } from '../middleware/validationHandler.middleware';

const router = Router();

// All account routes require authentication
router.use(protect);

// POST /api/accounts/create – verified customers only, no account required yet
router.post('/create', accountController.createAccount);

// GET /api/accounts/balance – requires a bank account
router.get('/balance', requireAccount, accountController.getBalance);

// GET /api/accounts/details – requires a bank account
router.get('/details', requireAccount, accountController.getAccountDetails);

// GET /api/accounts/name-enquiry/:accountNumber – requires a bank account
router.get(
  '/name-enquiry/:accountNumber',
  requireAccount,
  validateAccountNumber,
  handleValidationErrors,
  accountController.nameEnquiry
);

export default router;
