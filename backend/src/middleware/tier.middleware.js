'use strict';

const SystemSettings = require('../models/systemSettings.model');
const logger = require('../shared/utils/logger');

/**
 * Middleware to restrict access to Pro tier features.
 * If the system is currently natively set to 'basic', this rejects the request.
 */
const requireProTier = async (req, res, next) => {
    // Definitive lockdown: No Pro features allowed
    return res.status(403).json({
        success: false,
        message: 'This feature is available in the Pro version.'
    });
};

module.exports = {
    requireProTier
};
