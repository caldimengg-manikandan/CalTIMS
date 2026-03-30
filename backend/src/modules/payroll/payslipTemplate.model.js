const mongoose = require('mongoose');

const PayslipTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['DEFAULT', 'CUSTOM'],
  },
  layoutType: {
    type: String,
    enum: ['CORPORATE', 'MODERN', 'MINIMAL', 'EXECUTIVE', 'COMPACT'],
    default: 'CORPORATE'
  },
  backgroundImageUrl: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isSystemDefault: {
    type: Boolean,
    default: false
  },
  htmlContent: {
    type: String
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  }
}, { timestamps: true });

// Unique name per organization
PayslipTemplateSchema.index({ organizationId: 1, name: 1 }, { unique: true });

// Ensure only one system default per company (or globally)
PayslipTemplateSchema.pre('save', async function(next) {
  if (this.isSystemDefault) {
    await this.constructor.updateMany(
      { organizationId: this.organizationId, _id: { $ne: this._id } },
      { $set: { isSystemDefault: false } }
    );
  }
  next();
});

module.exports = mongoose.model('PayslipTemplate', PayslipTemplateSchema);
