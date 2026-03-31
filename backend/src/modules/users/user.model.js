'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../../constants');

// Update ROLES if not already containing SUPER_ADMIN
const ALL_ROLES = {
  ...ROLES,
  SUPER_ADMIN: 'super_admin'
};

const userSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: false,
      index: true
    },
    employeeId: {
      type: String,
      sparse: true,
      trim: true,
      // No unique: true here to allow same IDs in different organizations
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: false, // Optional for OAuth users
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(ALL_ROLES),
      default: ALL_ROLES.EMPLOYEE,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: false, // Optional during onboarding
      index: true
    },
    isOnboardingComplete: {
      type: Boolean,
      default: false,
    },
    isOwner: {
      type: Boolean,
      default: false,
    },
    provider: {
      type: String,
      enum: ['local', 'google', 'microsoft'],
      default: 'local',
    },
    providers: {
      type: [String],
      default: ['local'],
    },
    phoneNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      default: null,
      index: true
    },

    department: {
      type: String,
      trim: true,
    },
    designation: {
      type: String,
      trim: true,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    phone: {
      type: String,
      trim: true,
    },
    joinDate: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    avatar: {
      type: String,
      default: null,
    },
    refreshTokenHash: {
      type: String,
      select: false,
      default: null,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    passwordChangedAt: {
      type: Date,
    },
    leaveBalance: {
      type: Map,
      of: Number,
      default: { annual: 18, sick: 10, casual: 6 },
    },
    gmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    macAddress: {
      type: String,
      trim: true,
    },
    trialStartDate: {
      type: Date,
    },
    trialExpiresAt: {
      type: Date,
    },
    isLocked: {
      type: Boolean,
      default: false,
    },
    isTrialUser: {
      type: Boolean,
      default: false,
    },
    // Bank Details
    bankName: {
      type: String,
      trim: true,
    },
    accountNumber: {
      type: String,
      trim: true,
      maxlength: [18, 'Account number cannot exceed 18 digits'],
    },
    branchName: {
      type: String,
      trim: true,
    },
    ifscCode: {
      type: String,
      trim: true,
    },
    uan: {
      type: String,
      trim: true,
    },
    // Personal Details
    pan: {
      type: String,
      trim: true,
    },
    aadhaar: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.refreshTokenHash;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        return ret;
      },
    },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
userSchema.index({ role: 1 });
userSchema.index({ managerId: 1 });
userSchema.index({ department: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ organizationId: 1, employeeId: 1 }, { unique: true, sparse: true });

// ─── Pre-save: Hash password ───────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
  this.password = await bcrypt.hash(this.password, salt);
  this.passwordChangedAt = Date.now();
  next();
});

// ─── Instance Methods ─────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    companyId: this.companyId,
    employeeId: this.employeeId,
    name: this.name,
    email: this.email,
    role: this.role,
    department: this.department,
    designation: this.designation,
    managerId: this.managerId,
    joinDate: this.joinDate,
    isActive: this.isActive,
    avatar: this.avatar,
    leaveBalance: this.leaveBalance,
    isLocked: this.isLocked,
    isTrialUser: this.isTrialUser,
    organizationId: this.organizationId,
    isOnboardingComplete: this.isOnboardingComplete,
    isOwner: this.isOwner,
    provider: this.provider,
    providers: this.providers || [],
    phoneNumber: this.phoneNumber,
    lastLogin: this.lastLogin,
    trialStartDate: this.trialStartDate,
    trialExpiresAt: this.trialExpiresAt,
    passwordChangedAt: this.passwordChangedAt,
    createdAt: this.createdAt,
    bankName: this.bankName,
    accountNumber: this.accountNumber,
    branchName: this.branchName,
    ifscCode: this.ifscCode,
    uan: this.uan,
    pan: this.pan,
    aadhaar: this.aadhaar,
    roleId: this.roleId?._id || this.roleId,
    roleName: this.roleId?.name,
    permissions: this.roleId?.permissions || {}
  };
};

// Ensure providers array is initialized
userSchema.pre('save', async function (next) {
  if (!this.providers || this.providers.length === 0) {
    this.providers = [this.provider || 'local'];
  }
  next();
});

// Auto-generate employeeId before save if not set (scoped to organization)
userSchema.pre('save', async function (next) {
  if (this.employeeId || !this.isNew || !this.organizationId) return next();
  
  // Use session if it exists to ensure consistency within transactions
  const session = this.$session();
  const count = await mongoose.model('User').countDocuments(
    { organizationId: this.organizationId },
    { session }
  );
  
  this.employeeId = `EMP${String(count + 1).padStart(4, '0')}`;
  next();
});

const User = mongoose.model('User', userSchema);
module.exports = User;
