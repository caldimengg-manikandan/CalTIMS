'use strict';

const SystemSettings = require('../models/systemSettings.model');
const logger = require('../shared/utils/logger');

/**
 * Middleware to restrict access to Pro tier features.
 * If the system is currently natively set to 'basic', this rejects the request.
 */
const requireProTier = async (req, res, next) => {
    try {
        const settings = await SystemSettings.getInstance();
        if (settings.appVersion !== 'pro') {
            return res.status(403).json({
                success: false,
                message: 'This feature is available in the Pro version.'
            });
        }
        next();
    } catch (error) {
        logger.error(`Error checking tier permission: ${error.message}`);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while checking feature permissions.'
        });
    }
};

module.exports = {
    requireProTier
};
