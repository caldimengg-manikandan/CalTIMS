'use strict';

const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema(
    {
        ticketId: {
            type: String,
            unique: true,
            trim: true,
        },
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            trim: true,
            lowercase: true,
        },
        issueType: {
            type: String,
            required: [true, 'Issue type is required'],
            enum: [
                'Login & Access',
                'Timesheet Issues',
                'Leave Management',
                'Reports',
                'Technical Issues',
                'General Support'
            ],
        },
        responses: [
            {
                message: String,
                sender: {
                    type: String,
                    enum: ['user', 'admin'],
                    default: 'user'
                },
                createdAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ],
        message: {
            type: String,
            required: [true, 'Initial message is required'],
            trim: true,
        },
        status: {
            type: String,
            enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
            default: 'Open',
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Auto-generate ticketId before save if not set
supportTicketSchema.pre('save', async function (next) {
    if (this.ticketId || !this.isNew) return next();
    try {
        const count = await this.constructor.countDocuments();
        // SUP-1001 onwards
        this.ticketId = `SUP-${1001 + count}`;
        next();
    } catch (err) {
        next(err);
    }
});

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);

module.exports = SupportTicket;
