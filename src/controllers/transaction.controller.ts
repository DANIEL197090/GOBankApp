import { Request, Response, NextFunction } from 'express';
import * as transactionService from '../services/transaction.service';
import { catchAsync } from '../utils/catchAsync';

/**
 * POST /api/transactions/transfer
 * Initiate a fund transfer (intra or inter-bank)
 */
export const transfer = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { toAccount, amount, narration, bankCode } = req.body;

    const result = await transactionService.transferFunds(req.customerId!, {
      toAccount,
      amount: Number(amount),
      narration,
      bankCode,
    });

    res.status(200).json({
      success: true,
      message: 'Transfer completed successfully',
      data: { transaction: result },
    });
  }
);

/**
 * GET /api/transactions/history
 * Get transaction history for the logged-in customer only
 */
export const getHistory = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { page, limit, startDate, endDate, status, type } = req.query;

    const result = await transactionService.getTransactionHistory(
      req.customerId!,
      {
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        status: status as string | undefined,
        type: type as string | undefined,
      }
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  }
);

/**
 * GET /api/transactions/status/:reference
 * Check transaction status – only the owning customer can check their transactions
 */
export const checkStatus = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const reference = req.params.reference as string;

    const transaction = await transactionService.checkTransactionStatus(
      req.customerId!,
      reference
    );

    res.status(200).json({
      success: true,
      data: { transaction },
    });
  }
);
