'use strict';

const systemService = require('./system.service');
const logger = require('../../shared/utils/logger'); // Note: path to logger was adjusted

const getSystemVersion = async (req, res, next) => {
    try {
        const result = await systemService.getSystemVersion();
        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error(`Error fetching system version: ${error.message}`);
        next(error);
    }
};

const updateSystemVersion = async (req, res, next) => {
    try {
        const { version } = req.body;
        const result = await systemService.updateSystemVersion(version, req.user._id);

        logger.info(`System version updated to ${version} by Admin: ${req.user._id}`);

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error(`Error updating system version: ${error.message}`);
        next(error);
    }
};

module.exports = {
    getSystemVersion,
    updateSystemVersion
};
