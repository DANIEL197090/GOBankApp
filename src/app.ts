import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

// Import routes
import authRoutes from './routes/auth.routes';
import customerRoutes from './routes/customer.routes';
import accountRoutes from './routes/account.routes';
import transactionRoutes from './routes/transaction.routes';
import { errorHandler } from './middleware/error.middleware';
import { notFound } from './middleware/notFound.middleware';
import logger from './utils/logger';

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : '*',
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// HTTP request logger
app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.http(message.trim()),
  },
}));

// Global Rate limiter
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  max: Number(process.env.RATE_LIMIT_MAX) || 100,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again in 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/transactions', transactionRoutes);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'GOBank API is running',
    timestamp: new Date().toISOString(),
    bank: process.env.BANK_NAME,
    bankCode: process.env.BANK_CODE,
  });
});

// API documentation endpoint
app.get('/api/docs', (_req, res) => {
  res.json({
    success: true,
    title: 'GOBank API Documentation',
    version: '1.0.0',
    bank: process.env.BANK_NAME,
    bankCode: process.env.BANK_CODE,
    baseUrl: '/api',
    endpoints: {
      auth: {
        'POST /api/auth/register': 'Register a new customer (onboarding with BVN/NIN)',
        'POST /api/auth/login': 'Customer login',
        'GET /api/auth/me': 'Get current customer profile (auth required)',
        'POST /api/auth/logout': 'Logout (auth required)',
      },
      customers: {
        'GET /api/customers/profile': 'Get customer profile (auth required)',
        'PUT /api/customers/profile': 'Update customer profile (auth required)',
      },
      accounts: {
        'POST /api/accounts/create': 'Create bank account for verified customer (auth required)',
        'GET /api/accounts/balance': 'Get account balance (auth required)',
        'GET /api/accounts/name-enquiry/:accountNumber': 'Name enquiry for any account (auth required)',
        'GET /api/accounts/details': 'Get own account details (auth required)',
      },
      transactions: {
        'POST /api/transactions/transfer': 'Transfer funds (intra or inter-bank) (auth required)',
        'GET /api/transactions/history': 'Get transaction history (auth required)',
        'GET /api/transactions/status/:reference': 'Check transaction status (auth required)',
      },
    },
  });
});

// Serve static files for any frontend
app.use(express.static(path.join(__dirname, '../public')));

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

export default app;
