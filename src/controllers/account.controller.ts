import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import * as transactionService from '../services/transaction.service';
import { catchAsync } from '../utils/catchAsync';

/**
 * POST /api/accounts/create
 * Create a bank account for a verified customer (one per customer)
 */
export const createAccount = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const accountInfo = await authService.createBankAccount(req.customerId!);

    res.status(201).json({
      success: true,
      message: 'Bank account created successfully! Your account has been pre-funded with ₦15,000.',
      data: { account: accountInfo },
    });
  }
);

/**
 * GET /api/accounts/balance
 * Get the live balance for the logged-in customer's account
 */
export const getBalance = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const balance = await transactionService.getAccountBalance(req.customerId!);

    res.status(200).json({
      success: true,
      data: { account: balance },
    });
  }
);

/**
 * GET /api/accounts/details
 * Get own account details
 */
export const getAccountDetails = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const customer = req.customer;

    res.status(200).json({
      success: true,
      data: {
        account: {
          accountNumber: customer.accountNumber,
          bankCode: customer.bankCode,
          bankName: customer.bankName,
          accountName: `${customer.firstName} ${customer.lastName}`,
          balance: customer.balance,
          kycType: customer.kycType,
          isVerified: customer.isVerified,
          createdAt: customer.createdAt,
        },
      },
    });
  }
);

/**
 * GET /api/accounts/name-enquiry/:accountNumber
 * Verify recipient before initiating a transfer
 */
export const nameEnquiry = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const accountNumber = req.params.accountNumber as string;

    const result = await transactionService.nameEnquiry(
      req.customerId!,
      accountNumber
    );

    res.status(200).json({
      success: true,
      message: 'Name enquiry successful',
      data: { account: result },
    });
  }
);
