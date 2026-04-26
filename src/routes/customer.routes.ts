import { Router } from 'express';
import * as customerController from '../controllers/customer.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

// All customer routes require authentication
router.use(protect);

// GET /api/customers/profile
router.get('/profile', customerController.getProfile);

// PUT /api/customers/profile
router.put('/profile', customerController.updateProfile);

export default router;
