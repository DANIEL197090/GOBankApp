import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface ICustomer extends Document {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  kycType: 'bvn' | 'nin';
  kycID: string;
  dob: string;
  isVerified: boolean;
  hasAccount: boolean;
  accountNumber?: string;
  bankCode?: string;
  bankName?: string;
  balance?: number;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    kycType: {
      type: String,
      enum: ['bvn', 'nin'],
      required: [true, 'KYC type is required'],
    },
    kycID: {
      type: String,
      required: [true, 'KYC ID is required'],
      unique: true,
      trim: true,
    },
    dob: {
      type: String,
      required: [true, 'Date of birth is required'],
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    hasAccount: {
      type: Boolean,
      default: false,
    },
    accountNumber: {
      type: String,
      unique: true,
      sparse: true,
    },
    bankCode: {
      type: String,
    },
    bankName: {
      type: String,
    },
    balance: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Hash password before saving (Mongoose v9: async pre hooks should NOT call next())
CustomerSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
CustomerSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Compound index for efficient account/transaction lookups
CustomerSchema.index({ hasAccount: 1, isVerified: 1 });

export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema);
