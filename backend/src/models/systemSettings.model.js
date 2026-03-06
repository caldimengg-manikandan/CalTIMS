'use strict';

const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema(
    {
        appVersion: {
            type: String,
            enum: ['basic', 'pro'],
            default: 'basic'
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false
        }
    },
    { timestamps: true }
);

// Ensure only one document exists in this collection
systemSettingsSchema.statics.getInstance = async function () {
    let settings = await this.findOne();
    if (!settings) {
        settings = await this.create({ appVersion: 'basic' });
    }
    return settings;
};

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);

module.exports = SystemSettings;
