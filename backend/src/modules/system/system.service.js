'use strict';

const SystemSettings = require('../../models/systemSettings.model');

const getSystemVersion = async () => {
    return { version: 'basic' };
};

const updateSystemVersion = async (version, userId) => {
    // Force version to 'basic' regardless of input to disable Pro toggle
    const enforcedVersion = 'basic';
    
    const settings = await SystemSettings.getInstance();
    settings.appVersion = enforcedVersion;
    settings.updatedBy = userId;
    await settings.save();

    return { version: enforcedVersion };
};

module.exports = {
    getSystemVersion,
    updateSystemVersion
};
