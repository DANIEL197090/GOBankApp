import mongoose, { Document, Schema } from 'mongoose';

export type TransactionType = 'credit' | 'debit';
export type TransactionStatus = 'pending' | 'successful' | 'failed';
export type TransferType = 'intra' | 'inter';

export interface ITransaction extends Document {
  reference: string;
  customerId: mongoose.Types.ObjectId;
  type: TransactionType;
  transferType: TransferType;
  amount: number;
  fromAccount: string;
  toAccount: string;
  fromBank?: string;
  toBank?: string;
  narration: string;
  status: TransactionStatus;
  nibssReference?: string;
  balanceBefore?: number;
  balanceAfter?: number;
  recipientName?: string;
  senderName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['credit', 'debit'],
      required: true,
    },
    transferType: {
      type: String,
      enum: ['intra', 'inter'],
      required: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [1, 'Amount must be at least 1'],
    },
    fromAccount: {
      type: String,
      required: true,
      index: true,
    },
    toAccount: {
      type: String,
      required: true,
    },
    fromBank: {
      type: String,
    },
    toBank: {
      type: String,
    },
    narration: {
      type: String,
      required: true,
      maxlength: [255, 'Narration cannot exceed 255 characters'],
    },
    status: {
      type: String,
      enum: ['pending', 'successful', 'failed'],
      default: 'pending',
    },
    nibssReference: {
      type: String,
    },
    balanceBefore: {
      type: Number,
    },
    balanceAfter: {
      type: Number,
    },
    recipientName: {
      type: String,
    },
    senderName: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index for customer transaction history lookups
TransactionSchema.index({ customerId: 1, createdAt: -1 });
TransactionSchema.index({ fromAccount: 1, createdAt: -1 });

export const Transaction = mongoose.model<ITransaction>(
  'Transaction',
  TransactionSchema
);
