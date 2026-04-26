import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';
import {
  validateRegister,
  validateLogin,
} from '../middleware/validate.middleware';
import { handleValidationErrors } from '../middleware/validationHandler.middleware';

const router = Router();

// POST /api/auth/register
router.post(
  '/register',
  validateRegister,
  handleValidationErrors,
  authController.register
);

// POST /api/auth/login
router.post(
  '/login',
  validateLogin,
  handleValidationErrors,
  authController.login
);

// GET /api/auth/me (protected)
router.get('/me', protect, authController.getMe);

// POST /api/auth/logout (protected)
router.post('/logout', protect, authController.logout);

export default router;
