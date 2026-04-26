import axios, { AxiosInstance, AxiosError } from 'axios';
import logger from '../utils/logger';

interface NibssToken {
  token: string;
  expiresAt: number; // unix timestamp
}

interface NibssFintech {
  name: string;
  email: string;
  bankCode: string;
  bankName: string;
}

interface AccountInfo {
  accountNumber: string;
  bankCode: string;
  bankName: string;
  balance: number;
}

export interface NameEnquiryResult {
  accountNumber: string;
  accountName: string;
  bankCode?: string;
  bankName?: string;
}

interface TransferResult {
  reference?: string;
  status?: string;
  message?: string;
  [key: string]: any;
}

interface TransactionDetail {
  reference: string;
  status: string;
  amount?: number;
  from?: string;
  to?: string;
  [key: string]: any;
}

interface BalanceResult {
  balance: number;
  accountNumber: string;
  [key: string]: any;
}

class NibssService {
  private client: AxiosInstance;
  private tokenData: NibssToken | null = null;
  private readonly API_KEY = process.env.NIBSS_API_KEY!;
  private readonly API_SECRET = process.env.NIBSS_API_SECRET!;
  private readonly BASE_URL = process.env.NIBSS_BASE_URL!;

  constructor() {
    this.client = axios.create({
      baseURL: this.BASE_URL,
      timeout: 60000, // Increased to 60s for cold starts
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add bearer token
    this.client.interceptors.request.use(
      async (config) => {
        if (config.url !== '/auth/token') {
          const token = await this.getValidToken();
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          logger.warn('NIBSS token expired, refreshing...');
          this.tokenData = null;
          await this.initializeToken();
        }
        const message =
          (error.response?.data as any)?.message ||
          error.message ||
          'NIBSS API Error';
        throw new Error(message);
      }
    );
  }

  /**
   * Get a valid (non-expired) token, refreshing if necessary
   */
  private async getValidToken(): Promise<string> {
    const now = Date.now();
    const buffer = 60 * 1000; // 1 minute buffer

    if (this.tokenData && this.tokenData.expiresAt > now + buffer) {
      return this.tokenData.token;
    }

    logger.info('🔄 NIBSS token expired or missing, refreshing...');
    return this.initializeToken();
  }

  /**
   * Fetch a fresh JWT token from NIBSS with retry logic
   */
  async initializeToken(retries = 3): Promise<string> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await axios.post(
          `${this.BASE_URL}/auth/token`,
          {
            apiKey: this.API_KEY,
            apiSecret: this.API_SECRET,
          },
          { 
            headers: { 'Content-Type': 'application/json' },
            timeout: 60000 
          }
        );

        const { token } = response.data;
        if (!token) throw new Error('No token received from NIBSS');

        const payload = JSON.parse(
          Buffer.from(token.split('.')[1], 'base64').toString()
        );
        const expiresAt = payload.exp * 1000;

        this.tokenData = { token, expiresAt };
        logger.info(`✅ NIBSS token refreshed. Expires at: ${new Date(expiresAt).toISOString()}`);

        return token;
      } catch (error: any) {
        const isLastRetry = i === retries - 1;
        const delay = (i + 1) * 2000; // 2s, 4s, 6s
        
        logger.warn(`⚠️ NIBSS Auth attempt ${i + 1} failed: ${error.message}. ${isLastRetry ? 'Giving up.' : `Retrying in ${delay}ms...`}`);
        
        if (isLastRetry) {
          throw new Error(`NIBSS authentication failed after ${retries} attempts: ${error.message}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('NIBSS authentication failed');
  }

  /**
   * Validate BVN/NIN for customer onboarding
   */
  async validateKyc(
    kycType: 'bvn' | 'nin',
    kycID: string,
    dob: string
  ): Promise<boolean> {
    try {
      const endpoint = kycType === 'bvn' ? '/validateBvn' : '/validateNin';
      const payload =
        kycType === 'bvn'
          ? { bvn: kycID, dob }
          : { nin: kycID };

      const response = await this.client.post(endpoint, payload);
      return response.status === 200;
    } catch (error: any) {
      logger.warn(`KYC validation failed for ${kycType}: ${error.message}`);
      return false;
    }
  }

  /**
   * Create a bank account on NIBSS.
   * Falls back to fetching from /accounts list if the create endpoint
   * doesn't return accountNumber (can happen with some NIBSS responses).
   */
  async createAccount(
    kycType: 'bvn' | 'nin',
    kycID: string,
    dob: string
  ): Promise<AccountInfo> {
    const response = await this.client.post('/account/create', {
      kycType,
      kycID,
      dob,
    });

    const data = response.data;

    // If NIBSS returned the account details directly — use them
    if (data.accountNumber) {
      return {
        accountNumber: data.accountNumber,
        bankCode: data.bankCode || process.env.BANK_CODE!,
        bankName: data.bankName || process.env.BANK_NAME!,
        balance: data.balance || 15000,
      };
    }

    // Otherwise look up the newly-created account from the accounts list using kycID
    logger.info(`🔍 Account number not in create response — looking up via /accounts (kycID: ${kycID})`);
    const accounts = await this.getAllAccounts();
    const found = accounts.find((a: any) => a.kycID === kycID);

    if (!found) {
      throw new Error('Account created at NIBSS but account number could not be retrieved');
    }

    return {
      accountNumber: found.accountNumber,
      bankCode: found.bankCode || process.env.BANK_CODE!,
      bankName: found.bankName || process.env.BANK_NAME!,
      balance: found.balance || 15000,
    };
  }

  /**
   * Name enquiry for an account number
   */
  async nameEnquiry(accountNumber: string): Promise<NameEnquiryResult> {
    const response = await this.client.get(
      `/account/name-enquiry/${accountNumber}`
    );

    const data = response.data;
    return {
      accountNumber: data.accountNumber || accountNumber,
      accountName: data.accountName || data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
      bankCode: data.bankCode,
      bankName: data.bankName,
    };
  }

  /**
   * Transfer funds between accounts
   */
  async transfer(
    fromAccount: string,
    toAccount: string,
    amount: number,
    narration?: string
  ): Promise<TransferResult> {
    const response = await this.client.post('/transfer', {
      from: fromAccount,
      to: toAccount,
      amount,
      narration: narration || 'GOBank Transfer',
    });

    return response.data;
  }

  /**
   * Get transaction by reference
   */
  async getTransaction(reference: string): Promise<TransactionDetail> {
    const response = await this.client.get(`/transaction/${reference}`);
    return response.data;
  }

  /**
   * Get account balance
   */
  async getBalance(accountNumber: string): Promise<BalanceResult> {
    const response = await this.client.get(
      `/account/balance/${accountNumber}`
    );
    return response.data;
  }

  /**
   * Get all accounts under this fintech
   */
  async getAllAccounts(): Promise<any[]> {
    const response = await this.client.get('/accounts');
    return response.data.accounts || response.data || [];
  }

  /**
   * Get fintech info
   */
  getFintechInfo(): Partial<NibssFintech> {
    return {
      name: process.env.FINTECH_NAME,
      bankCode: process.env.BANK_CODE,
      bankName: process.env.BANK_NAME,
    };
  }
}

// Singleton instance
export const nibssService = new NibssService();
