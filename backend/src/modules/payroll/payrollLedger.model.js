'use strict';

const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * PayrollLedger - Immutable Financial Audit Trail
 * Each entry is append-only and contains a hash of the previous record
 * for chain-of-custody verification.
 */
const payrollLedgerSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ['PAYROLL_RUN', 'PAYROLL_MARK_PAID', 'PAYROLL_LOCK', 'PAYROLL_VOID'],
      required: true,
    },
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PayrollBatch',
      required: true,
      index: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    /** SHA-256 Hash for tamper-evidence */
    hash: {
      type: String,
      required: false,
    },
    previousHash: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: false, // uses custom timestamp
    collection: 'payroll_ledgers',
  }
);

// --- Bank-Grade Immutability Locks ---

/** Prevent updates or deletes on ledger collection */
payrollLedgerSchema.pre(['save', 'updateOne', 'findOneAndUpdate', 'updateMany', 'deleteOne', 'deleteMany', 'remove'], function(next) {
    if (this instanceof mongoose.Query) {
        return next(new Error('Bank-Grade Security Error: Payroll Ledger is IMMUTABLE. Direct mutations are prohibited.'));
    }
    if (!this.isNew) {
        return next(new Error('Bank-Grade Security Error: Cannot update an existing Ledger entry. Records are append-only.'));
    }
    next();
});

/** 
 * Automatic Chain Linking (Deterministic Hashing)
 * Note: In a production cluster, this would be handled by a serialized worker.
 */
payrollLedgerSchema.pre('save', async function(next) {
    try {
        const lastEntry = await this.constructor.findOne({ 
            organizationId: this.organizationId 
        }).sort({ timestamp: -1 });

        this.previousHash = lastEntry ? lastEntry.hash : '0000000000000000000000000000000000000000000000000000000000000000';
        
        const dataToHash = JSON.stringify({
            org: this.organizationId,
            action: this.action,
            batch: this.batchId,
            user: this.performedBy,
            meta: this.metadata,
            ts: this.timestamp,
            prev: this.previousHash
        });

        this.hash = crypto.createHash('sha256').update(dataToHash).digest('hex');
        next();
    } catch (err) {
        next(err);
    }
});

const PayrollLedger = mongoose.model('PayrollLedger', payrollLedgerSchema);

module.exports = PayrollLedger;
