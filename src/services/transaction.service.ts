import { v4 as uuidv4 } from 'uuid';
import { Customer } from '../models/customer.model';
import { Transaction } from '../models/transaction.model';
import { nibssService } from './nibss.service';
import { AppError } from '../utils/AppError';
import logger from '../utils/logger';

/**
 * Generate unique transaction reference
 */
const generateReference = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const uuid = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
  return `GOB${timestamp}${uuid}`;
};

/**
 * Name enquiry – verifies recipient details before transfer
 * Any authenticated customer can look up any account number
 */
export const nameEnquiry = async (
  requestingCustomerId: string,
  accountNumber: string
) => {
  // Ensure requesting customer exists
  const customer = await Customer.findById(requestingCustomerId);
  if (!customer) throw new AppError('Unauthorized', 401);
  if (!customer.hasAccount) throw new AppError('You need a bank account to use this service', 403);

  const result = await nibssService.nameEnquiry(accountNumber);
  return result;
};

/**
 * Transfer funds (intra or inter-bank)
 * A customer can only transfer from their own account
 */
export const transferFunds = async (
  customerId: string,
  body: {
    toAccount: string;
    amount: number;
    narration?: string;
    bankCode?: string; // If present, inter-bank; else intra
  }
) => {
  const { toAccount, amount, narration, bankCode } = body;

  // Get sender
  const sender = await Customer.findById(customerId);
  if (!sender) throw new AppError('Customer not found', 404);
  if (!sender.hasAccount || !sender.accountNumber) {
    throw new AppError('You need a bank account to make transfers', 403);
  }

  const fromAccount = sender.accountNumber;

  // Don't allow transfer to self
  if (fromAccount === toAccount) {
    throw new AppError('Cannot transfer to your own account', 400);
  }

  // Check minimum amount
  if (amount < 1) throw new AppError('Minimum transfer amount is ₦1', 400);

  // Get live balance from NIBSS to ensure accuracy
  let liveBalance: number;
  try {
    const balanceData = await nibssService.getBalance(fromAccount);
    liveBalance = balanceData.balance;
  } catch {
    liveBalance = sender.balance || 0;
  }

  if (liveBalance < amount) {
    throw new AppError(
      `Insufficient funds. Available balance: ₦${liveBalance.toLocaleString()}`,
      400
    );
  }

  // Name enquiry on recipient before transfer
  let recipientName = '';
  try {
    const enquiry = await nibssService.nameEnquiry(toAccount);
    recipientName = enquiry.accountName;
  } catch {
    logger.warn(`Could not perform name enquiry for account: ${toAccount}`);
  }

  const reference = generateReference();
  const transferType = !bankCode || bankCode === sender.bankCode ? 'intra' : 'inter';

  // Create a pending transaction record
  const transaction = await Transaction.create({
    reference,
    customerId: sender._id,
    type: 'debit',
    transferType,
    amount,
    fromAccount,
    toAccount,
    fromBank: sender.bankCode,
    toBank: bankCode || sender.bankCode,
    narration: narration || `Transfer to ${toAccount}`,
    status: 'pending',
    balanceBefore: liveBalance,
    recipientName,
  });

  // Execute transfer via NIBSS
  try {
    logger.info(
      `Initiating ${transferType} transfer: ${fromAccount} → ${toAccount}, ₦${amount}`
    );

    const transferResult = await nibssService.transfer(
      fromAccount,
      toAccount,
      amount,
      narration
    );

    // Update transaction status
    const newBalance = liveBalance - amount;
    await Transaction.findByIdAndUpdate(transaction._id, {
      status: 'successful',
      nibssReference: transferResult?.reference || reference,
      balanceAfter: newBalance,
    });

    // Update local balance
    await Customer.findByIdAndUpdate(customerId, { balance: newBalance });

    logger.info(`✅ Transfer successful: ${reference}`);

    return {
      reference,
      status: 'successful',
      amount,
      fromAccount,
      toAccount,
      recipientName,
      narration: narration || `Transfer to ${toAccount}`,
      balanceBefore: liveBalance,
      balanceAfter: newBalance,
      transferType,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    // Mark transaction as failed
    await Transaction.findByIdAndUpdate(transaction._id, {
      status: 'failed',
    });

    logger.error(`❌ Transfer failed: ${reference} - ${error.message}`);
    throw new AppError(`Transfer failed: ${error.message}`, 400);
  }
};

/**
 * Get transaction history for the logged-in customer only
 * Enforces strict data privacy – no access to other customers' data
 */
export const getTransactionHistory = async (
  customerId: string,
  options: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    status?: string;
    type?: string;
  }
) => {
  const customer = await Customer.findById(customerId);
  if (!customer) throw new AppError('Customer not found', 404);
  if (!customer.hasAccount) {
    throw new AppError('You need a bank account to view transactions', 403);
  }

  const page = options.page || 1;
  const limit = Math.min(options.limit || 20, 100); // cap at 100
  const skip = (page - 1) * limit;

  // Filter ONLY by this customer's ID – data isolation
  const filter: any = {
    customerId: customer._id,
    fromAccount: customer.accountNumber,
  };

  if (options.status) filter.status = options.status;
  if (options.type) filter.type = options.type;

  if (options.startDate || options.endDate) {
    filter.createdAt = {};
    if (options.startDate)
      filter.createdAt.$gte = new Date(options.startDate);
    if (options.endDate) filter.createdAt.$lte = new Date(options.endDate);
  }

  const [transactions, total] = await Promise.all([
    Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(filter),
  ]);

  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    },
  };
};

/**
 * Check transaction status by reference
 * Customers can only check THEIR OWN transactions
 */
export const checkTransactionStatus = async (
  customerId: string,
  reference: string
) => {
  const customer = await Customer.findById(customerId);
  if (!customer) throw new AppError('Customer not found', 404);

  // Strict data isolation: find only this customer's transaction
  const transaction = await Transaction.findOne({
    reference,
    customerId: customer._id,
  });

  if (!transaction) {
    throw new AppError(
      'Transaction not found or you do not have access to it',
      404
    );
  }

  // Also check live status from NIBSS if it's still pending
  if (transaction.status === 'pending') {
    try {
      const nibssStatus = await nibssService.getTransaction(
        transaction.nibssReference || reference
      );
      if (nibssStatus?.status) {
        transaction.status = nibssStatus.status.toLowerCase() as any;
        await transaction.save();
      }
    } catch {
      // Use local status if NIBSS check fails
    }
  }

  return transaction;
};

/**
 * Get account balance for the logged-in customer
 */
export const getAccountBalance = async (customerId: string) => {
  const customer = await Customer.findById(customerId);
  if (!customer) throw new AppError('Customer not found', 404);
  if (!customer.hasAccount || !customer.accountNumber) {
    throw new AppError('No bank account found. Please create an account first.', 404);
  }

  // Fetch live balance from NIBSS
  try {
    const balanceData = await nibssService.getBalance(customer.accountNumber);
    const liveBalance = balanceData.balance;

    // Sync local balance
    if (liveBalance !== customer.balance) {
      await Customer.findByIdAndUpdate(customerId, { balance: liveBalance });
    }

    return {
      accountNumber: customer.accountNumber,
      bankCode: customer.bankCode,
      bankName: customer.bankName,
      accountName: `${customer.firstName} ${customer.lastName}`,
      balance: liveBalance,
    };
  } catch {
    // Fallback to local cached balance
    return {
      accountNumber: customer.accountNumber,
      bankCode: customer.bankCode,
      bankName: customer.bankName,
      accountName: `${customer.firstName} ${customer.lastName}`,
      balance: customer.balance || 0,
    };
  }
};
