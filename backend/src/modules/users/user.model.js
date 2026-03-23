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
    employeeId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
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
      required: [true, 'Password is required'],
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
      default: null,
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
    phoneNumber: this.phoneNumber,
    lastLogin: this.lastLogin,
    trialStartDate: this.trialStartDate,
    trialExpiresAt: this.trialExpiresAt,
    passwordChangedAt: this.passwordChangedAt,
    createdAt: this.createdAt,
  };
};

// Auto-generate employeeId before save if not set
userSchema.pre('save', async function (next) {
  if (this.employeeId || !this.isNew) return next();
  const count = await mongoose.model('User').countDocuments();
  this.employeeId = `EMP${String(count + 1).padStart(4, '0')}`;
  next();
});

const User = mongoose.model('User', userSchema);
module.exports = User;
