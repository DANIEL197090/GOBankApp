import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import { catchAsync } from '../utils/catchAsync';

/**
 * GET /api/customers/profile
 */
export const getProfile = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const customer = await authService.getCustomerProfile(req.customerId!);
    res.status(200).json({
      success: true,
      data: { customer },
    });
  }
);

/**
 * PUT /api/customers/profile
 */
export const updateProfile = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { firstName, lastName, phone, email } = req.body;
    const customer = await authService.updateCustomerProfile(req.customerId!, {
      firstName,
      lastName,
      phone,
      email,
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { customer },
    });
  }
);
