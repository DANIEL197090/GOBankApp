import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import { catchAsync } from '../utils/catchAsync';

/**
 * POST /api/auth/register
 * Register a new customer with KYC verification
 */
export const register = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { firstName, lastName, email, phone, password, kycType, kycID, dob } =
      req.body;

    const { customer, token } = await authService.registerCustomer({
      firstName,
      lastName,
      email,
      phone,
      password,
      kycType: kycType.toLowerCase() as 'bvn' | 'nin',
      kycID,
      dob,
    });

    res.status(201).json({
      success: true,
      message: `Welcome! Your identity has been verified via ${kycType.toUpperCase()}. You can now create a bank account.`,
      data: {
        customer,
        token,
        nextStep: 'POST /api/accounts/create to open your bank account',
      },
    });
  }
);

/**
 * POST /api/auth/login
 */
export const login = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { email, password } = req.body;

    const { customer, token } = await authService.loginCustomer(email, password);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { customer, token },
    });
  }
);

/**
 * GET /api/auth/me
 * Get current logged-in customer profile
 */
export const getMe = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const customer = await authService.getCustomerProfile(req.customerId!);

    res.status(200).json({
      success: true,
      data: { customer },
    });
  }
);

/**
 * POST /api/auth/logout (client-side token deletion, server acknowledges)
 */
export const logout = catchAsync(
  async (_req: Request, res: Response, _next: NextFunction) => {
    res.status(200).json({
      success: true,
      message: 'Logged out successfully. Please delete your token on the client.',
    });
  }
);
