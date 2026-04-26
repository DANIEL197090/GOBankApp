import jwt from 'jsonwebtoken';
import { Customer, ICustomer } from '../models/customer.model';
import { nibssService } from '../services/nibss.service';
import { AppError } from '../utils/AppError';
import logger from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate a signed JWT for a customer
 */
const generateToken = (customerId: string): string => {
  return jwt.sign({ id: customerId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as any,
  });
};

/**
 * Register a new customer (onboarding)
 * - Validates KYC (BVN/NIN) via NIBSS
 * - Creates customer record in our DB
 * - Does NOT create bank account (separate step)
 */
export const registerCustomer = async (data: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  kycType: 'bvn' | 'nin';
  kycID: string;
  dob: string;
}) => {
  const { firstName, lastName, email, phone, password, kycType, kycID, dob } =
    data;

  // Check if email already exists
  const emailExists = await Customer.findOne({ email });
  if (emailExists) {
    throw new AppError('Email already registered', 409);
  }

  // Check if KYC ID already linked to an account
  const kycExists = await Customer.findOne({ kycID });
  if (kycExists) {
    throw new AppError(
      `${kycType.toUpperCase()} already linked to an existing account`,
      409
    );
  }

  // Validate KYC with NIBSS
  logger.info(`Validating ${kycType.toUpperCase()} for customer: ${email}`);
  const isKycValid = await nibssService.validateKyc(kycType, kycID, dob);

  if (!isKycValid) {
    throw new AppError(
      `${kycType.toUpperCase()} validation failed. Please check your details.`,
      400
    );
  }

  // Create customer
  const customer = await Customer.create({
    firstName,
    lastName,
    email,
    phone,
    password,
    kycType,
    kycID,
    dob,
    isVerified: true, // KYC validated
  });

  logger.info(`✅ Customer onboarded: ${customer.email} (${customer._id})`);

  const token = generateToken((customer._id as any).toString());

  return { customer, token };
};

/**
 * Login existing customer
 */
export const loginCustomer = async (
  email: string,
  password: string
) => {
  // Include password field for comparison
  const customer = await Customer.findOne({ email }).select('+password');

  if (!customer) {
    throw new AppError('Invalid email or password', 401);
  }

  const isPasswordCorrect = await customer.comparePassword(password);
  if (!isPasswordCorrect) {
    throw new AppError('Invalid email or password', 401);
  }

  const token = generateToken((customer._id as any).toString());

  logger.info(`Customer logged in: ${customer.email}`);

  // Return customer without password
  const customerObj = customer.toJSON();
  return { customer: customerObj, token };
};

/**
 * Create bank account for a verified customer (one per customer)
 */
export const createBankAccount = async (customerId: string) => {
  const customer = await Customer.findById(customerId);
  if (!customer) throw new AppError('Customer not found', 404);

  if (!customer.isVerified) {
    throw new AppError(
      'Customer KYC not verified. Please complete onboarding first.',
      403
    );
  }

  if (customer.hasAccount) {
    throw new AppError(
      'Customer already has a bank account. Maximum one account per customer.',
      409
    );
  }

  // Create account on NIBSS
  logger.info(
    `Creating NIBSS account for customer: ${customer.email} (${customer.kycType}: ${customer.kycID})`
  );

  const accountInfo = await nibssService.createAccount(
    customer.kycType,
    customer.kycID,
    customer.dob
  );

  // Update customer record
  customer.hasAccount = true;
  customer.accountNumber = accountInfo.accountNumber;
  customer.bankCode = accountInfo.bankCode;
  customer.bankName = accountInfo.bankName;
  customer.balance = accountInfo.balance;
  await customer.save();

  logger.info(
    `✅ Account created: ${accountInfo.accountNumber} for ${customer.email}`
  );

  return {
    accountNumber: accountInfo.accountNumber,
    bankCode: accountInfo.bankCode,
    bankName: accountInfo.bankName,
    balance: accountInfo.balance,
    customerName: `${customer.firstName} ${customer.lastName}`,
  };
};

/**
 * Get customer profile (excluding sensitive fields)
 */
export const getCustomerProfile = async (customerId: string) => {
  const customer = await Customer.findById(customerId);
  if (!customer) throw new AppError('Customer not found', 404);
  return customer;
};

/**
 * Update customer profile
 */
export const updateCustomerProfile = async (
  customerId: string,
  updates: { firstName?: string; lastName?: string; phone?: string; email?: string }
) => {
  // Email uniqueness check if email is being changed
  if (updates.email) {
    const existing = await Customer.findOne({
      email: updates.email,
      _id: { $ne: customerId },
    });
    if (existing) throw new AppError('Email already in use', 409);
  }

  const customer = await Customer.findByIdAndUpdate(
    customerId,
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!customer) throw new AppError('Customer not found', 404);
  return customer;
};
