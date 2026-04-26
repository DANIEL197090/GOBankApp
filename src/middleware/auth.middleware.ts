import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Customer } from '../models/customer.model';
import { AppError } from '../utils/AppError';

interface JwtPayload {
  id: string;
  iat: number;
  exp: number;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      customer?: any;
      customerId?: string;
    }
  }
}

/**
 * Protect routes – verify JWT & attach customer to request
 */
export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    // Extract token from Authorization header or cookie
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new AppError('Authentication required. Please log in.', 401);
    }

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'fallback_secret'
    ) as JwtPayload;

    // Check if customer still exists
    const customer = await Customer.findById(decoded.id);
    if (!customer) {
      throw new AppError(
        'The customer associated with this token no longer exists.',
        401
      );
    }

    // Attach customer to request
    req.customer = customer;
    req.customerId = (customer._id as any).toString();

    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token. Please log in again.', 401));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Your session has expired. Please log in again.', 401));
    }
    next(error);
  }
};

/**
 * Check if customer has a bank account
 */
export const requireAccount = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.customer?.hasAccount) {
    return next(
      new AppError(
        'You need a verified bank account to access this resource. Please create an account first.',
        403
      )
    );
  }
  next();
};
