'use strict';

const SystemSettings = require('../../models/systemSettings.model');

const getSystemVersion = async () => {
    const settings = await SystemSettings.getInstance();
    return { version: settings.appVersion };
};

const updateSystemVersion = async (version, userId) => {
    if (!['basic', 'pro'].includes(version)) {
        const error = new Error('Invalid application version. Must be "basic" or "pro".');
        error.statusCode = 400;
        throw error;
    }

    const settings = await SystemSettings.getInstance();
    settings.appVersion = version;
    settings.updatedBy = userId;
    await settings.save();

    return { version: settings.appVersion };
};

module.exports = {
    getSystemVersion,
    updateSystemVersion
};
