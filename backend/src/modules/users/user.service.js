'use strict';

const User = require('./user.model');
const AppError = require('../../shared/utils/AppError');
const emailService = require('../../shared/services/email.service');
const { parsePagination, buildPaginationMeta, buildSort } = require('../../shared/utils/pagination');
const { logAction } = require('../audit/audit.routes');

const userService = {
  async getAll(query, organizationId) {
    const { page, limit, skip } = parsePagination(query);
    const sort = buildSort(query);

    // status filter: 'active' => isActive:true, 'inactive' => isActive:false, else show all
    const filter = { organizationId };
    if (query.status === 'active') filter.isActive = true;
    else if (query.status === 'inactive') filter.isActive = false;
    if (query.role) filter.role = query.role;
    if (query.department) filter.department = new RegExp(query.department, 'i');
    if (query.name) filter.name = new RegExp(query.name, 'i');
    if (query.employeeId) filter.employeeId = new RegExp(query.employeeId, 'i');
    if (query.search) {
      filter.$or = [
        { name: new RegExp(query.search, 'i') },
        { email: new RegExp(query.search, 'i') },
        { employeeId: new RegExp(query.search, 'i') },
        { phone: new RegExp(query.search, 'i') },
        { department: new RegExp(query.search, 'i') },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter).populate('managerId', 'name email').skip(skip).limit(limit).sort(sort).lean(),
      User.countDocuments(filter),
    ]);

    return { users, pagination: buildPaginationMeta(total, page, limit) };
  },

  async getById(id, organizationId) {
    const user = await User.findOne({ _id: id, organizationId }).populate('managerId', 'name email employeeId');
    if (!user) throw new AppError('User not found', 404);
    return user;
  },

  async create(data, requestorId, organizationId, ipAddress) {
    const existing = await User.findOne({ email: data.email, organizationId });
    if (existing) throw new AppError('An account with this email already exists in this organization', 409);
    
    data.organizationId = organizationId;
    // Store plain password to send in email before it gets hashed by pre-save hook
    const plainPassword = data.password;

    // Initialize leave balance from settings if not provided
    if (!data.leaveBalance) {
      try {
        const Settings = require('../settings/settings.model');
        const settings = await Settings.findOne({ organizationId }).lean();
        const policy = settings?.leavePolicy || {};
        
        // Map policy settings to user leave balance
        data.leaveBalance = {
          annual: policy.annualLeaveDays || 20,
          sick: policy.sickLeaveDays || 10,
          casual: policy.casualLeaveDays || 6 // Default fallback
        };
      } catch (err) {
        console.error('Failed to fetch leave policy for new user:', err);
        // Fallback to hardcoded defaults if settings fetch fails
        data.leaveBalance = { annual: 20, sick: 10, casual: 6 };
      }
    }

    const user = await User.create(data);

    // Send Welcome Email
    try {
      const Settings = require('../settings/settings.model');
      const settings = await Settings.findOne({ organizationId }).lean();
      const companyName = settings?.organization?.companyName || 'CALTIMS';
      const portalLink = process.env.CLIENT_URL || 'http://localhost:5173';

      await emailService.sendWelcomeEmail(user.email, {
        name: user.name,
        password: plainPassword,
        portalLink,
        companyName
      });
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      // We don't throw here to avoid failing user creation if email fails
    }

    logAction({
        userId: requestorId,
        action: 'CREATE_EMPLOYEE',
        entityType: 'Employee',
        entityId: user._id,
        details: { name: user.name, email: user.email, role: user.role },
        ipAddress
    });

    return user.toPublicJSON();
  },

  async update(id, data, requestorId, requestorRole, organizationId) {
    const user = await User.findOne({ _id: id, organizationId });
    if (!user) throw new AppError('User not found', 404);

    // Only admins can change roles
    if (data.role && requestorRole !== 'admin') {
      throw new AppError('Only admins can change user roles', 403);
    }

    // Disallow editing someone else's profile unless admin
    if (id !== requestorId.toString() && requestorRole !== 'admin') {
      throw new AppError('You can only edit your own profile', 403);
    }

    // Prevent editing sensitive fields
    delete data.password;
    delete data.refreshTokenHash;

    const changes = {};
    for (const key of Object.keys(data)) {
        if (data[key] !== undefined && String(data[key]) !== String(user[key])) {
            changes[key] = { old: user[key], new: data[key] };
        }
    }

    Object.assign(user, data);
    await user.save();

    if (Object.keys(changes).length > 0) {
        logAction({
            userId: requestorId,
            action: 'UPDATE_EMPLOYEE',
            entityType: 'Employee',
            entityId: id,
            details: { changes }
        });
    }

    return user.toPublicJSON();
  },

  async resetPassword(id, newPassword, requestorId, organizationId) {
    const user = await User.findOne({ _id: id, organizationId });
    if (!user) throw new AppError('User not found', 404);

    user.password = newPassword;
    await user.save();

    logAction({
        userId: requestorId,
        action: 'RESET_PASSWORD',
        entityType: 'Employee',
        entityId: id,
        details: { changes: { password: { old: '***', new: '***' } } }
    });
    return true;
  },

  async deactivate(id, requestorId, organizationId, ipAddress) {
    const user = await User.findOneAndUpdate({ _id: id, organizationId }, { isActive: false, refreshTokenHash: null }, { new: true });
    if (!user) throw new AppError('User not found', 404);

    logAction({
        userId: requestorId,
        action: 'DEACTIVATE_EMPLOYEE',
        entityType: 'Employee',
        entityId: id,
        details: { name: user.name, email: user.email },
        ipAddress
    });

    return user.toPublicJSON();
  },

  async activate(id, requestorId, organizationId, ipAddress) {
    const user = await User.findOneAndUpdate({ _id: id, organizationId }, { isActive: true }, { new: true });
    if (!user) throw new AppError('User not found', 404);

    logAction({
        userId: requestorId,
        action: 'ACTIVATE_EMPLOYEE',
        entityType: 'Employee',
        entityId: id,
        details: { name: user.name, email: user.email },
        ipAddress
    });

    return user.toPublicJSON();
  },

  async changeRole(id, role, organizationId) {
    const user = await User.findOneAndUpdate({ _id: id, organizationId }, { role }, { new: true, runValidators: true });
    if (!user) throw new AppError('User not found', 404);
    return user.toPublicJSON();
  },

  async getMe(userId, organizationId) {
    return this.getById(userId, organizationId);
  },

  async deleteUser(id, requestorId, organizationId, ipAddress) {
    const user = await User.findOne({ _id: id, organizationId });
    if (!user) throw new AppError('User not found', 404);

    await User.findOneAndDelete({ _id: id, organizationId });

    logAction({
        userId: requestorId,
        action: 'DELETE_EMPLOYEE',
        entityType: 'Employee',
        entityId: id,
        details: { name: user.name, email: user.email },
        ipAddress
    });

    return true;
  },

  async getDepartments(organizationId) {
    return User.distinct('department', { organizationId, isActive: true });
  },
};

module.exports = userService;
