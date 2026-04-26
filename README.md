# 🏦 GOBank — Digital Banking System

A production-ready Node.js/TypeScript digital banking backend system integrated with NIBSS by Phoenix API.

## ✨ Features

- ✅ **Customer Onboarding** — BVN/NIN KYC verification via NIBSS
- ✅ **Account Creation** — Auto NUBAN-style account number, pre-funded with ₦15,000
- ✅ **One Account Per Customer** — Enforced at system level
- ✅ **Name Enquiry** — Verify recipient before transferring
- ✅ **Fund Transfers** — Intra-bank and inter-bank transfers
- ✅ **Balance Check** — Live real-time balance from NIBSS
- ✅ **Transaction History** — Paginated, filtered transaction history
- ✅ **Transaction Status Check** — By reference number
- ✅ **Data Privacy** — Customers can only see their own data
- ✅ **JWT Authentication** — Secure stateless auth with auto-expiry
- ✅ **Rate Limiting** — Protection against abuse
- ✅ **Input Validation** — Comprehensive request validation
- ✅ **Auto Token Refresh** — NIBSS token auto-refreshes before expiry

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18
- MongoDB (local or Atlas)
- NIBSS Phoenix API credentials

### Installation

```bash
# Clone the repository
git clone https://github.com/DANIEL197090/GOBankApp.git
cd GOBankApp

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your values
nano .env
```

### Running the Server

```bash
# Development (with hot reload)
npm run dev

# Production (compile first)
npm run build
npm start
```

---

## 🔑 Environment Variables

| Variable | Description | Example |
|---|---|---|
| `PORT` | Server port | `5000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/gobank` |
| `JWT_SECRET` | JWT signing secret | `your_secret_key` |
| `JWT_EXPIRES_IN` | JWT lifetime | `7d` |
| `NIBSS_BASE_URL` | NIBSS API base URL | `https://nibssbyphoenix.onrender.com/api` |
| `NIBSS_API_KEY` | Your NIBSS API key | `8cd99b...` |
| `NIBSS_API_SECRET` | Your NIBSS API secret | `a0d290...` |
| `BANK_CODE` | Your bank code from NIBSS | `248` |
| `BANK_NAME` | Your bank name | `GOB Bank` |

---

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/auth/register` | Register & verify customer (KYC) | No |
| `POST` | `/api/auth/login` | Customer login | No |
| `GET`  | `/api/auth/me` | Get my profile | ✅ |
| `POST` | `/api/auth/logout` | Logout | ✅ |

### Accounts

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/accounts/create` | Create bank account | ✅ |
| `GET`  | `/api/accounts/balance` | Get live balance | ✅ |
| `GET`  | `/api/accounts/details` | Get account details | ✅ |
| `GET`  | `/api/accounts/name-enquiry/:accountNumber` | Name enquiry | ✅ |

### Transactions

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/transactions/transfer` | Transfer funds | ✅ |
| `GET`  | `/api/transactions/history` | Transaction history | ✅ |
| `GET`  | `/api/transactions/status/:reference` | Check status | ✅ |

### Utility

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/docs` | API documentation |

---

## 📋 Request & Response Examples

### Register Customer (Onboarding)

```http
POST /api/auth/register
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phone": "08012345678",
  "password": "SecurePass1",
  "kycType": "bvn",
  "kycID": "10840712847",
  "dob": "2005-04-04"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Welcome! Your identity has been verified via BVN.",
  "data": {
    "customer": { ... },
    "token": "eyJhbGci...",
    "nextStep": "POST /api/accounts/create to open your bank account"
  }
}
```

### Create Bank Account

```http
POST /api/accounts/create
Authorization: Bearer <token>
```

**Response (201):**
```json
{
  "success": true,
  "message": "Bank account created successfully! Your account has been pre-funded with ₦15,000.",
  "data": {
    "account": {
      "accountNumber": "1084071287",
      "bankCode": "248",
      "bankName": "GOB Bank",
      "balance": 15000,
      "customerName": "John Doe"
    }
  }
}
```

### Transfer Funds

```http
POST /api/transactions/transfer
Authorization: Bearer <token>
Content-Type: application/json

{
  "toAccount": "1234567890",
  "amount": 5000,
  "narration": "Payment for services",
  "bankCode": "248"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Transfer completed successfully",
  "data": {
    "transaction": {
      "reference": "GOBL0MV1NK4BA8",
      "status": "successful",
      "amount": 5000,
      "fromAccount": "1084071287",
      "toAccount": "1234567890",
      "recipientName": "Jane Smith",
      "balanceBefore": 15000,
      "balanceAfter": 10000,
      "transferType": "intra",
      "timestamp": "2026-04-25T16:00:00.000Z"
    }
  }
}
```

### Get Transaction History

```http
GET /api/transactions/history?page=1&limit=10&status=successful
Authorization: Bearer <token>
```

---

## 🏗️ Architecture

```
src/
├── server.ts              # Entry point
├── app.ts                 # Express app + middleware
├── config/
│   └── database.ts        # MongoDB connection
├── models/
│   ├── customer.model.ts  # Customer schema
│   └── transaction.model.ts # Transaction schema
├── services/
│   ├── nibss.service.ts   # NIBSS API wrapper (auto token refresh)
│   ├── auth.service.ts    # Registration, login, account creation
│   └── transaction.service.ts # Transfers, history, balance
├── controllers/
│   ├── auth.controller.ts
│   ├── customer.controller.ts
│   ├── account.controller.ts
│   └── transaction.controller.ts
├── routes/
│   ├── auth.routes.ts
│   ├── customer.routes.ts
│   ├── account.routes.ts
│   └── transaction.routes.ts
├── middleware/
│   ├── auth.middleware.ts        # JWT verification
│   ├── error.middleware.ts       # Global error handler
│   ├── notFound.middleware.ts    # 404 handler
│   ├── validate.middleware.ts    # Input validators
│   └── validationHandler.middleware.ts
└── utils/
    ├── AppError.ts        # Custom error class
    ├── catchAsync.ts      # Async wrapper
    └── logger.ts          # Colored console logger
```

---

## 🔒 Security Features

- **JWT Authentication** with configurable expiry
- **Bcrypt** password hashing (12 salt rounds)
- **Rate limiting** (100 req / 15 minutes per IP)
- **Helmet** security headers
- **CORS** configuration
- **Input validation** on all endpoints
- **Data isolation** — customers only see their own transactions
- **Strict account guard** — banking endpoints require verified account

---

## 📝 Business Rules Enforced

1. **KYC before account** — Customer must pass BVN/NIN verification before banking
2. **One account per customer** — Enforced in both local DB and NIBSS
3. **Sufficient funds check** — Transfer rejected if balance insufficient
4. **No self-transfer** — Cannot transfer to own account
5. **Transaction data privacy** — Only the account owner can view transactions
6. **Status reference privacy** — Can only check own transaction references

---

## 🧩 Testing with Postman

Import this collection for ready-made requests:

1. **Register** → Get token
2. **Create Account** → Get account number  
3. **Name Enquiry** → Verify a recipient
4. **Transfer** → Send money
5. **Balance** → Check balance
6. **History** → View transactions
7. **Status** → Check a transfer

---

## 🤝 NIBSS Integration

This system integrates with **NIBSS by Phoenix** API for:

| NIBSS Endpoint | Used For |
|---|---|
| `POST /auth/token` | Auto JWT token management |
| `POST /validateBvn` | BVN verification during onboarding |
| `POST /validateNin` | NIN verification during onboarding |
| `POST /account/create` | Creating NUBAN bank accounts |
| `GET /account/name-enquiry/:accountNumber` | Recipient verification |
| `POST /transfer` | Executing fund transfers |
| `GET /account/balance/:accountNumber` | Live balance |
| `GET /transaction/:ref` | Transaction status |

---

*Built for GOBank | Powered by NIBSS by Phoenix*
