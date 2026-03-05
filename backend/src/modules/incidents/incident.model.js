'use strict';

const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema(
    {
        incidentId: {
            type: String,
            unique: true,
            trim: true,
        },
        title: {
            type: String,
            required: [true, 'Incident title is required'],
            trim: true,
            maxlength: [100, 'Title cannot exceed 100 characters'],
        },
        description: {
            type: String,
            required: [true, 'Incident description is required'],
            trim: true,
            maxlength: [2000, 'Description cannot exceed 2000 characters'],
        },
        category: {
            type: String,
            enum: ['timesheet error', 'project missing', 'incorrect hours', 'leave conflict', 'general help'],
            required: [true, 'Category is required'],
        },
        priority: {
            type: String,
            enum: ['Low', 'Medium', 'High', 'Urgent'],
            default: 'Medium',
        },
        status: {
            type: String,
            enum: ['Open', 'In Progress', 'Pending', 'Resolved', 'Closed', 'Withdrawn'],
            default: 'Open',
        },
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Employee reference is required'],
        },
        relatedTimesheet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Timesheet',
            default: null,
        },
        attachments: [
            {
                type: String,
            },
        ],
        responses: [
            {
                message: {
                    type: String,
                    required: [true, 'Response message is required'],
                    trim: true,
                },
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                    required: true,
                },
                createdAt: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Auto-generate incidentId before save if not set
incidentSchema.pre('save', async function (next) {
    if (this.incidentId || !this.isNew) return next();
    try {
        const count = await this.constructor.countDocuments();
        // INC-1001 onwards
        this.incidentId = `INC-${1001 + count}`;
        next();
    } catch (err) {
        next(err);
    }
});

// Indexes for common queries
incidentSchema.index({ employee: 1 });
incidentSchema.index({ status: 1 });
incidentSchema.index({ priority: 1 });
incidentSchema.index({ assignedTo: 1 });

const Incident = mongoose.model('Incident', incidentSchema);

module.exports = Incident;
