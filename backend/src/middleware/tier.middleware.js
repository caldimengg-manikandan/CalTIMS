'use strict';

const SystemSettings = require('../models/systemSettings.model');
const logger = require('../shared/utils/logger');

/**
 * Middleware to restrict access to Pro tier features.
 * Reads the current system tier from SystemSettings and blocks access
 * when the tier is 'basic'. Allows access when tier is 'pro'.
 */
const requireProTier = async (req, res, next) => {
    try {
        const settings = await SystemSettings.findOne().lean();
        const version = settings?.appVersion || 'basic';

        if (version !== 'pro') {
            return res.status(403).json({
                success: false,
                message: 'This feature is available in the Pro version.'
            });
        }

        return next();
    } catch (err) {
        logger.error('requireProTier middleware error:', err);
        // Fail safe: block access if we can't determine tier
        return res.status(403).json({
            success: false,
            message: 'Unable to verify tier. Please try again.'
        });
    }
};

module.exports = {
    requireProTier
};
