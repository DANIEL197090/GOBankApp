import { Router } from 'express';
import * as transactionController from '../controllers/transaction.controller';
import { protect, requireAccount } from '../middleware/auth.middleware';
import {
  validateTransfer,
  validateTransactionQuery,
} from '../middleware/validate.middleware';
import { handleValidationErrors } from '../middleware/validationHandler.middleware';

const router = Router();

// All transaction routes require auth + account
router.use(protect);
router.use(requireAccount);

// POST /api/transactions/transfer
router.post(
  '/transfer',
  validateTransfer,
  handleValidationErrors,
  transactionController.transfer
);

// GET /api/transactions/history
router.get(
  '/history',
  validateTransactionQuery,
  handleValidationErrors,
  transactionController.getHistory
);

// GET /api/transactions/status/:reference
router.get('/status/:reference', transactionController.checkStatus);

export default router;
