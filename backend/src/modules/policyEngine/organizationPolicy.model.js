const mongoose = require('mongoose');

const OrganizationPolicySchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: false
  },
  payroll: {
    workingDaysPerMonth: { type: Number, default: 22 },
    workingHoursPerDay: { type: Number, default: 8 },
    lopCalculation: { type: String, enum: ['PER_DAY', 'PER_HOUR'], default: 'PER_DAY' },
    salaryProration: { type: Boolean, default: true }
  },
  leave: {
    types: [{
      name: { type: String },
      paid: { type: Boolean, default: true }
    }],
    allowNegativeBalance: { type: Boolean, default: false }
  },
  attendance: {
    minHoursPerDay: { type: Number, default: 8 },
    allowHalfDay: { type: Boolean, default: true }
  },
  departmentPolicies: {
    type: Object,
    default: {}
  }
}, { timestamps: true });

module.exports = mongoose.model('OrganizationPolicy', OrganizationPolicySchema);
