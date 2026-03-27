const mongoose = require('mongoose');

const PayslipDesignSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  templateId: {
    type: String, // Can be layout name like 'CORPORATE' or a Template ID
    required: true
  },
  backgroundImageUrl: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

// Ensure only one active design per company
PayslipDesignSchema.index({ companyId: 1, isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

module.exports = mongoose.model('PayslipDesign', PayslipDesignSchema);
