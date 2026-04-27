import axios, { AxiosInstance, AxiosError } from 'axios';
import { execSync } from 'child_process';
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
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
      }
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
   * Fetch a fresh JWT token from NIBSS with retry logic and cURL fallback
   */
  async initializeToken(retries = 3): Promise<string> {
    for (let i = 0; i < retries; i++) {
      try {
        logger.info(`🔄 NIBSS Auth attempt ${i + 1}...`);
        
        // Try standard axios first
        try {
          const response = await axios.post(
            `${this.BASE_URL}/auth/token`,
            { apiKey: this.API_KEY, apiSecret: this.API_SECRET },
            { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
          );

          if (response.data?.token) {
            return this.saveToken(response.data.token);
          }
        } catch (axiosError: any) {
          logger.warn(`⚠️ Axios failed: ${axiosError.message}. Trying cURL fallback...`);
          
          // Fallback to cURL (bypasses Node.js TLS/Socket issues)
          const curlCommand = `curl -s -X POST ${this.BASE_URL}/auth/token -H "Content-Type: application/json" -d '{"apiKey":"${this.API_KEY}","apiSecret":"${this.API_SECRET}"}'`;
          const curlOutput = execSync(curlCommand).toString();
          const data = JSON.parse(curlOutput);
          
          if (data.token) {
            logger.info('✅ NIBSS token retrieved via cURL fallback');
            return this.saveToken(data.token);
          }
          throw new Error(data.message || 'No token in cURL response');
        }

      } catch (error: any) {
        const isLastRetry = i === retries - 1;
        const delay = (i + 1) * 2000;
        
        logger.warn(`❌ Attempt ${i + 1} failed: ${error.message}. ${isLastRetry ? '' : `Retrying in ${delay}ms...`}`);
        
        if (isLastRetry) throw error;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('NIBSS authentication failed');
  }

  private saveToken(token: string): string {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString()
    );
    const expiresAt = payload.exp * 1000;
    this.tokenData = { token, expiresAt };
    logger.info(`✅ NIBSS token updated. Expires at: ${new Date(expiresAt).toISOString()}`);
    return token;
  }

  /**
   * Validate BVN/NIN for customer onboarding
   */
  /**
   * Universal request handler with cURL fallback
   */
  private async makeRequest(method: 'GET' | 'POST', endpoint: string, payload?: any): Promise<any> {
    const token = await this.getValidToken();
    const url = `${this.BASE_URL}${endpoint}`;
    
    // Try Axios first
    try {
      const config: any = {
        method,
        url,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        timeout: 30000
      };
      if (payload) config.data = payload;
      
      const response = await this.client(config);
      return response.data;
    } catch (axiosError: any) {
      logger.warn(`⚠️ Axios ${method} ${endpoint} failed: ${axiosError.message}. Trying cURL fallback...`);
      
      // Fallback to cURL
      const curlHeaders = `-H "Content-Type: application/json" -H "Authorization: Bearer ${token}"`;
      let curlCommand = `curl -s -X ${method} ${url} ${curlHeaders}`;
      
      if (payload) {
        curlCommand += ` -d '${JSON.stringify(payload)}'`;
      }
      
      const curlOutput = execSync(curlCommand).toString();
      try {
        return JSON.parse(curlOutput);
      } catch (parseError) {
        logger.error(`❌ cURL output was not valid JSON: ${curlOutput}`);
        throw new Error(`Failed to process NIBSS response: ${axiosError.message}`);
      }
    }
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
      const payload = kycType === 'bvn' ? { bvn: kycID, dob } : { nin: kycID };

      logger.info(`🔍 Validating ${kycType} via NIBSS: ${kycID}`);
      const data = await this.makeRequest('POST', endpoint, payload);
      
      const isSuccess = data.success === true || data.bvn === kycID || data.nin === kycID;
      if (isSuccess) {
        logger.info(`✅ NIBSS validated ${kycType} successfully`);
        return true;
      }

      logger.warn(`❌ NIBSS rejected ${kycType} validation:`, data);
      return false;
    } catch (error: any) {
      logger.warn(`❌ KYC validation fatal error: ${error.message}`);
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
    logger.info(`🏦 Creating NIBSS account for ${kycID}`);
    const data = await this.makeRequest('POST', '/account/create', {
      kycType,
      kycID,
      dob,
    });

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
      throw new Error(data.message || 'Account created at NIBSS but account number could not be retrieved');
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
    const data = await this.makeRequest('GET', `/account/name-enquiry/${accountNumber}`);

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
    logger.info(`💸 Sending ${amount} from ${fromAccount} to ${toAccount}`);
    return this.makeRequest('POST', '/transfer', {
      from: fromAccount,
      to: toAccount,
      amount,
      narration: narration || 'GOBank Transfer',
    });
  }

  /**
   * Get transaction by reference
   */
  async getTransaction(reference: string): Promise<TransactionDetail> {
    return this.makeRequest('GET', `/transaction/${reference}`);
  }

  /**
   * Get account balance
   */
  async getBalance(accountNumber: string): Promise<BalanceResult> {
    return this.makeRequest('GET', `/account/balance/${accountNumber}`);
  }

  /**
   * Get all accounts under this fintech
   */
  async getAllAccounts(): Promise<any[]> {
    const data = await this.makeRequest('GET', '/accounts');
    return data.accounts || data || [];
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
