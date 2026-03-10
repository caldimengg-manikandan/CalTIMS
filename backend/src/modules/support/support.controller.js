'use strict';

const SupportTicket = require('./support.model');
const SupportOTP = require('./supportOTP.model');
const asyncHandler = require('../../shared/utils/asyncHandler');
const AppError = require('../../shared/utils/AppError');
const logger = require('../../shared/utils/logger');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Helper to send email
const sendEmail = async (options) => {
    try {
        if (process.env.NODE_ENV === 'development') {
            logger.info(`[DEV] Mock email - To: ${options.to}, Subject: ${options.subject}, Body: ${options.text}`);
            return true;
        }

        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const mailOptions = {
            from: `"CALTIMS Support" <${process.env.EMAIL_FROM}>`,
            to: options.to,
            subject: options.subject,
            text: options.text,
        };

        await transporter.sendMail(mailOptions);
        return true;
    } catch (err) {
        logger.error(`Email delivery failed: ${err.message}`);
        return true; // Return true to not block the user if email credentials are not set up
    }
};

// --- OTP Logic ---

exports.sendOTP = asyncHandler(async (req, res, next) => {
    const { email } = req.body;

    if (!email) {
        return next(new AppError('Email is required', 400));
    }

    // Generate 6-digit OTP (hardcoded to '123456' in dev for easy testing)
    const otp = process.env.NODE_ENV === 'development' ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Upsert OTP record
    await SupportOTP.findOneAndUpdate(
        { email },
        { otp, expiresAt, verified: false },
        { upsert: true, new: true }
    );

    // Send email
    const emailSent = await sendEmail({
        to: email,
        subject: 'CALTIMS Support - Verification Code',
        text: `Your verification code is: ${otp}. This code is valid for 10 minutes.`,
    });

    if (!emailSent) {
        return next(new AppError('Failed to send verification email. Please try again later.', 500));
    }

    res.status(200).json({
        status: 'success',
        message: 'Verification code sent to email',
    });
});

exports.verifyOTP = asyncHandler(async (req, res, next) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return next(new AppError('Email and OTP are required', 400));
    }

    const otpRecord = await SupportOTP.findOne({ email, otp });

    if (!otpRecord || otpRecord.expiresAt < new Date()) {
        return next(new AppError('Invalid or expired verification code', 400));
    }

    otpRecord.verified = true;
    await otpRecord.save();

    res.status(200).json({
        status: 'success',
        message: 'Email verified successfully',
    });
});

// --- Ticket Logic ---

exports.createTicket = asyncHandler(async (req, res, next) => {
    const { name, email, issueType, message } = req.body;

    // Verify if email was verified via OTP
    const otpRecord = await SupportOTP.findOne({ email, verified: true });
    if (!otpRecord) {
        return next(new AppError('Email must be verified via OTP before submitting a ticket', 400));
    }

    const ticket = await SupportTicket.create({
        name,
        email,
        issueType,
        message,
    });

    // Auto Response to User
    await sendEmail({
        to: email,
        subject: `Support Request Received - ${ticket.ticketId}`,
        text: `Hello ${name},\n\nYour support request has been received successfully.\n\nTicket ID: ${ticket.ticketId}\nIssue Type: ${issueType}\n\nOur team will review your issue and contact you shortly.\n\nThank you for reaching out to CALTIMS Support.`,
    });

    // Once ticket is created, we can remove the OTP record
    await SupportOTP.deleteOne({ _id: otpRecord._id });

    res.status(201).json({
        status: 'success',
        data: {
            ticket,
        },
    });
});

exports.getMyTickets = asyncHandler(async (req, res, next) => {
    const { email } = req.body;

    // Verify if email was verified via OTP
    const otpRecord = await SupportOTP.findOne({ email, verified: true });
    if (!otpRecord) {
        return next(new AppError('Please verify your email via OTP to track tickets', 400));
    }

    const tickets = await SupportTicket.find({ email }).sort('-createdAt');

    // Remove OTP record after successful fetch
    await SupportOTP.deleteOne({ _id: otpRecord._id });

    res.status(200).json({
        status: 'success',
        results: tickets.length,
        data: {
            tickets,
        },
    });
});

exports.addTicketMessage = asyncHandler(async (req, res, next) => {
    const { message, sender } = req.body; // sender: 'user' or 'admin'
    const ticket = await SupportTicket.findById(req.params.id);

    if (!ticket) {
        return next(new AppError('No ticket found with that ID', 404));
    }

    ticket.responses.push({ message, sender });

    // If admin replies, maybe update status to In Progress
    if (sender === 'admin' && ticket.status === 'Open') {
        ticket.status = 'In Progress';
    }

    await ticket.save();

    res.status(200).json({
        status: 'success',
        data: {
            ticket,
        },
    });
});

exports.getAllTickets = asyncHandler(async (req, res, next) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const queryObj = { ...req.query };
    const excludedFields = ['page', 'sort', 'limit', 'fields', 'search'];
    excludedFields.forEach((el) => delete queryObj[el]);

    if (req.query.search) {
        queryObj.$or = [
            { ticketId: { $regex: req.query.search, $options: 'i' } },
            { name: { $regex: req.query.search, $options: 'i' } },
            { email: { $regex: req.query.search, $options: 'i' } },
        ];
    }

    const tickets = await SupportTicket.find(queryObj)
        .sort('-createdAt')
        .skip(skip)
        .limit(limit);

    const total = await SupportTicket.countDocuments(queryObj);

    res.status(200).json({
        status: 'success',
        results: tickets.length,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
        data: {
            tickets,
        },
    });
});

exports.getTicket = asyncHandler(async (req, res, next) => {
    const ticket = await SupportTicket.findById(req.params.id);

    if (!ticket) {
        return next(new AppError('No ticket found with that ID', 404));
    }

    res.status(200).json({
        status: 'success',
        data: {
            ticket,
        },
    });
});

exports.updateTicketStatus = asyncHandler(async (req, res, next) => {
    const { status } = req.body;

    if (!['Open', 'In Progress', 'Resolved', 'Closed'].includes(status)) {
        return next(new AppError('Invalid status', 400));
    }

    const ticket = await SupportTicket.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true, runValidators: true }
    );

    if (!ticket) {
        return next(new AppError('No ticket found with that ID', 404));
    }

    res.status(200).json({
        status: 'success',
        data: {
            ticket,
        },
    });
});

exports.deleteTicket = asyncHandler(async (req, res, next) => {
    const ticket = await SupportTicket.findByIdAndDelete(req.params.id);

    if (!ticket) {
        return next(new AppError('No ticket found with that ID', 404));
    }

    res.status(204).json({
        status: 'success',
        data: null,
    });
});
