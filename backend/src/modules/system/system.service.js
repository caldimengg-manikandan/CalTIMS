'use strict';

const SystemSettings = require('../../models/systemSettings.model');

const getSystemVersion = async () => {
    const settings = await SystemSettings.getInstance();
    return { version: settings.appVersion || 'basic' };
};

const updateSystemVersion = async (version, userId) => {
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
