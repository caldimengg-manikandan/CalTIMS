'use strict';

const mongoose = require('mongoose');

// ── OTP Schema ───────────────────────────────────────────────────────────────
const otpSchema = new mongoose.Schema({
    email: { type: String, required: true, lowercase: true, trim: true },
    otp: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } } // TTL Index
}, { timestamps: true });

// ── Support Ticket Schema ────────────────────────────────────────────────────
const supportTicketSchema = new mongoose.Schema({
    ticketId: { type: String, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    issueType: { type: String, required: true },
    message: { type: String, required: true },
    status: { 
        type: String, 
        enum: ['Open', 'In Progress', 'Resolved', 'Closed'], 
        default: 'Open' 
    },
    responses: [{
        sender: { type: String, enum: ['user', 'admin'], default: 'user' },
        message: { type: String, required: true },
        createdAt: { type: Date, default: Date.now }
    }],
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    }
}, { timestamps: true });

// Auto-generate ticketId (scoped to organization)
supportTicketSchema.pre('save', async function(next) {
    if (this.ticketId || !this.isNew || !this.organizationId) return next();
    try {
        const count = await this.constructor.countDocuments({ organizationId: this.organizationId });
        this.ticketId = `TKT-${100001 + count}`;
        next();
    } catch (err) {
        next(err);
    }
});

const OTP = mongoose.model('SupportOTP', otpSchema);
const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);

module.exports = { OTP, SupportTicket };
