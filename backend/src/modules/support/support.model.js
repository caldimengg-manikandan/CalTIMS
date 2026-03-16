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
    }]
}, { timestamps: true });

// Auto-generate ticketId
supportTicketSchema.pre('save', async function(next) {
    if (this.ticketId || !this.isNew) return next();
    try {
        const count = await this.constructor.countDocuments();
        this.ticketId = `TKT-${100001 + count}`;
        next();
    } catch (err) {
        next(err);
    }
});

const OTP = mongoose.model('SupportOTP', otpSchema);
const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);

module.exports = { OTP, SupportTicket };
