'use strict';

const User = require('./user.model');
const AppError = require('../../shared/utils/AppError');
const { parsePagination, buildPaginationMeta, buildSort } = require('../../shared/utils/pagination');

const userService = {
  async getAll(query) {
    const { page, limit, skip } = parsePagination(query);
    const sort = buildSort(query);

    // status filter: 'active' => isActive:true, 'inactive' => isActive:false, else show all
    const filter = {};
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

  async getById(id) {
    const user = await User.findById(id).populate('managerId', 'name email employeeId');
    if (!user) throw new AppError('User not found', 404);
    return user;
  },

  async create(data) {
    const existing = await User.findOne({ email: data.email });
    if (existing) throw new AppError('An account with this email already exists', 409);
    const user = await User.create(data);
    return user.toPublicJSON();
  },

  async update(id, data, requestorId, requestorRole) {
    const user = await User.findById(id);
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

    Object.assign(user, data);
    await user.save();
    return user.toPublicJSON();
  },

  async deactivate(id) {
    const user = await User.findByIdAndUpdate(id, { isActive: false, refreshTokenHash: null }, { new: true });
    if (!user) throw new AppError('User not found', 404);
    return user.toPublicJSON();
  },

  async activate(id) {
    const user = await User.findByIdAndUpdate(id, { isActive: true }, { new: true });
    if (!user) throw new AppError('User not found', 404);
    return user.toPublicJSON();
  },

  async changeRole(id, role) {
    const user = await User.findByIdAndUpdate(id, { role }, { new: true, runValidators: true });
    if (!user) throw new AppError('User not found', 404);
    return user.toPublicJSON();
  },

  async getMe(userId) {
    return this.getById(userId);
  },

  async deleteUser(id) {
    const user = await User.findByIdAndDelete(id);
    if (!user) throw new AppError('User not found', 404);
    return true;
  },

  async getDepartments() {
    return User.distinct('department', { isActive: true });
  },
};

module.exports = userService;
