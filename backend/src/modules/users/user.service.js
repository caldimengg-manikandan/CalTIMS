'use strict';

const { prisma } = require('../../config/database');
const AppError = require('../../shared/utils/AppError');
const emailService = require('../../shared/services/email.service');
const { parsePagination, buildPaginationMeta } = require('../../shared/utils/pagination');
const { logAction } = require('../audit/audit.routes');
const { ROLES, ROLE_PERMISSIONS } = require('../../constants');
const bcrypt = require('bcryptjs');
const { enforceOrg } = require('../../shared/utils/prismaHelper');
const { hasPermission } = require('../../shared/utils/rbac');
const { encrypt, decrypt } = require('../../shared/utils/security');

// Helper to decrypt JSON blobs
const decryptJson = (str) => {
    if (!str || typeof str !== 'string') return str;
    try {
        const decrypted = decrypt(str);
        return decrypted ? JSON.parse(decrypted) : str;
    } catch (e) {
        return str; 
    }
};

const PII_FIELDS = ['accountNumber', 'uan', 'pan', 'aadhaar', 'ifscCode', 'bankName', 'branchName'];

const userService = {
  async getAll(query, context) {
    const { organizationId } = context;
    const { page, limit, skip } = parsePagination(query);

    // Use enforceOrg to start with a safe base filter
    const baseQuery = enforceOrg({ where: { isDeleted: false } }, organizationId);
    const where = baseQuery.where;

    if (query.status === 'active') where.isActive = true;
    else if (query.status === 'inactive') where.isActive = false;
    if (query.role) {
      where.OR = [
        { role: { equals: query.role, mode: 'insensitive' } },
        { roleRef: { name: { equals: query.role, mode: 'insensitive' } } }
      ];
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const include = {
      roleRef: { select: { id: true, name: true, permissions: true } },
      employee: { 
        include: { 
          department: { select: { name: true } },
          designation: { select: { name: true } },
          leaveBalances: { include: { leaveType: { select: { name: true } } } }
        } 
      },
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({ where, include, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.user.count({ where }),
    ]);

    return { users: users.map(formatUser), pagination: buildPaginationMeta(total, page, limit) };
  },

  async getById(id, organizationId) {
    // Hard DB isolation using composite unique index
    const user = await prisma.user.findUnique({
      where: { id_organizationId: { id, organizationId } },
      include: { 
        roleRef: true, 
        employee: {
          include: {
            department: { select: { name: true } },
            designation: { select: { name: true } },
            leaveBalances: { include: { leaveType: { select: { name: true } } } }
          }
        } 
      },
    });
    if (!user || user.isDeleted) throw new AppError('User not found', 404);
    return formatUser(user);
  },

  async create(data, context, ipAddress) {
    const { organizationId, userId: requestorId } = context;
    
    // 1. Check for duplicates
    const checks = {
      email: prisma.user.findUnique({ where: { email: (data.email || '').toLowerCase().trim() } }),
      employeeId: (data.employeeId || data.employeeCode) ? prisma.employee.findFirst({
        where: { organizationId, employeeCode: data.employeeId || data.employeeCode }
      }) : Promise.resolve(null),
      phone: (data.phone || data.phoneNumber) ? prisma.user.findFirst({
        where: { OR: [{ phone: data.phone || data.phoneNumber }, { phoneNumber: data.phone || data.phoneNumber }] }
      }) : Promise.resolve(null),
      pan: data.pan ? prisma.user.findFirst({ where: { pan: data.pan } }) : Promise.resolve(null),
      aadhaar: data.aadhaar ? prisma.user.findFirst({ where: { aadhaar: data.aadhaar } }) : Promise.resolve(null),
      uan: data.uan ? prisma.user.findFirst({ where: { uan: data.uan } }) : Promise.resolve(null),
      ifscCode: data.ifscCode ? prisma.user.findFirst({ where: { ifscCode: data.ifscCode } }) : Promise.resolve(null),
    };

    const [existingEmail, existingEmp, existingPhone, existingPan, existingAadhaar, existingUan, existingIfsc] = await Promise.all([
      checks.email, checks.employeeId, checks.phone, checks.pan, checks.aadhaar, checks.uan, checks.ifscCode
    ]);

    const errors = {};
    if (existingEmail) errors.email = `${data.email} ALREADY TAKEN`;
    if (existingEmp) errors.employeeId = `${data.employeeId || data.employeeCode} ALREADY TAKEN`;
    if (existingPhone) errors.phone = `${data.phone || data.phoneNumber} ALREADY TAKEN`;
    if (existingPan) errors.pan = `${data.pan} ALREADY TAKEN`;
    if (existingAadhaar) errors.aadhaar = `${data.aadhaar} ALREADY TAKEN`;
    if (existingUan) errors.uan = `${data.uan} ALREADY TAKEN`;
    if (existingIfsc) errors.ifscCode = `${data.ifscCode} ALREADY TAKEN`;

    if (Object.keys(errors).length > 0) {
      throw new AppError('Validation failed', 409, errors);
    }

    const hashed = await bcrypt.hash(data.password, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12);

    const user = await prisma.$transaction(async (tx) => {
      // 1. Lock the organization row to serialize employee creation for this tenant
      await tx.$executeRaw`SELECT id FROM "Organization" WHERE id = ${organizationId} FOR UPDATE`;

      // 2. Resolve Role
      let roleId = data.roleId;
      let role = (data.role || ROLES.EMPLOYEE).toLowerCase();
      
      if (!roleId) {
        const matchedRole = await tx.role.findFirst({
          where: { 
            organizationId, 
            name: { equals: role, mode: 'insensitive' },
            isDeleted: false
          },
        });
        
        if (matchedRole) { 
          roleId = matchedRole.id; 
          role = matchedRole.name.toLowerCase(); 
        } else {
          // If no specific role found by name, still use the provided role string
          // Only fallback to 'employee' if it's truly empty
          role = role || ROLES.EMPLOYEE;
        }
      }

      let employeeCode = data.employeeId || data.employeeCode;


      // 4. Create User
      const newUser = await tx.user.create({
        data: {
          email: data.email,
          name: data.name,
          password: hashed,
          phone: data.phone || data.phoneNumber || null,
          phoneNumber: data.phoneNumber || null,
          role,
          roleId: roleId || null,
          organizationId,
          isActive: true,
          isOnboardingComplete: true,
          provider: 'local',
          providers: ['local'],
          bankName: data.bankName ? encrypt(data.bankName) : null,
          accountNumber: data.accountNumber ? encrypt(data.accountNumber) : null,
          branchName: data.branchName ? encrypt(data.branchName) : null,
          ifscCode: data.ifscCode ? encrypt(data.ifscCode) : null,
          uan: data.uan ? encrypt(data.uan) : null,
          pan: data.pan ? encrypt(data.pan) : null,
          aadhaar: data.aadhaar ? encrypt(data.aadhaar) : null,
        },
        include: { roleRef: true },
      });

      // 5. Resolve Department & Designation
      let departmentId = data.departmentId;
      if (!departmentId && data.department) {
        const dep = await tx.department.upsert({
          where: { organizationId_name: { organizationId, name: data.department.trim() } },
          update: {},
          create: { organizationId, name: data.department.trim() }
        });
        departmentId = dep.id;
      }

      let designationId = data.designationId;
      if (!designationId && data.designation) {
        const des = await tx.designation.upsert({
          where: { organizationId_name: { organizationId, name: data.designation.trim() } },
          update: {},
          create: { organizationId, name: data.designation.trim() }
        });
        designationId = des.id;
      }

      // 6. Calculate Next Employee Code (Safe due to row lock)
      if (!employeeCode) {
        const lastEmp = await tx.employee.findFirst({
          where: { organizationId },
          orderBy: { employeeCode: 'desc' },
          select: { employeeCode: true }
        });
        
        let nextNumber = 1;
        if (lastEmp && lastEmp.employeeCode) {
          const match = lastEmp.employeeCode.match(/\d+$/);
          if (match) {
            nextNumber = parseInt(match[0]) + 1;
          }
        }
        employeeCode = `EMP-${nextNumber.toString().padStart(4, '0')}`;
      }

      // 7. Create Employee
      const employee = await tx.employee.create({
        data: {
          userId: newUser.id,
          organizationId,
          employeeCode,
          status: 'ACTIVE',
          joiningDate: data.joiningDate ? new Date(data.joiningDate) : new Date(), 
          departmentId: departmentId || null,
          designationId: designationId || null,
        }
      });

      newUser.employee = employee;
      return newUser;
    });

    // 6. Post-transaction tasks (Emails & Logs)
    try {
      const settings = await prisma.orgSettings.findFirst({ where: { organizationId } });
      const companyName = settings?.data?.organization?.companyName || 'CALTIMS';
      await emailService.sendWelcomeEmail(user.email, {
        name: user.name,
        password: data.password,
        portalLink: process.env.CLIENT_URL || 'http://localhost:3000',
        companyName,
      }).catch(e => console.error('Email failed:', e.message));
    } catch (err) {}

    if (logAction) {
      logAction({ userId: requestorId, action: 'CREATE_EMPLOYEE', entityType: 'User', entityId: user.id, details: { name: user.name, email: user.email }, ipAddress });
    }

    return formatUser(user);
  },

  async update(id, data, context) {
    const { organizationId, userId: requestorId, role: requestorRole } = context;
    
    // Hard isolation check
    const user = await prisma.user.findUnique({ 
      where: { id_organizationId: { id, organizationId } } 
    });
    
    if (!user || user.isDeleted) throw new AppError('User not found', 404);
    
    const canEditOthers = hasPermission(context.permissions, 'Employees', 'Employee List', 'edit');
    const canChangeRoles = hasPermission(context.permissions, 'Settings', 'Users & Roles', 'edit');
    const isEditingSelf = id === requestorId;
    const isChangingRole = (data.role && data.role !== user.role) || (data.roleId && data.roleId !== user.roleId);

    // Bypass check: Super Admins and Owners can do anything
    const hasFullPower = context.isSuperAdmin || context.isOwner;

    if (isChangingRole && !hasFullPower && !canChangeRoles) {
      throw new AppError('Only authorized users can change user roles', 403);
    }
    
    if (!isEditingSelf && !hasFullPower && !canEditOthers) {
      throw new AppError('You do not have permission to edit this profile', 403);
    }

    // Check for duplicates in other users
    const updateChecks = {
      phone: (data.phone || data.phoneNumber) ? prisma.user.findFirst({
        where: { 
          OR: [{ phone: data.phone || data.phoneNumber }, { phoneNumber: data.phone || data.phoneNumber }],
          NOT: { id }
        }
      }) : Promise.resolve(null),
      pan: data.pan ? prisma.user.findFirst({ where: { pan: data.pan, NOT: { id } } }) : Promise.resolve(null),
      aadhaar: data.aadhaar ? prisma.user.findFirst({ where: { aadhaar: data.aadhaar, NOT: { id } } }) : Promise.resolve(null),
      uan: data.uan ? prisma.user.findFirst({ where: { uan: data.uan, NOT: { id } } }) : Promise.resolve(null),
      ifscCode: data.ifscCode ? prisma.user.findFirst({ where: { ifscCode: data.ifscCode, NOT: { id } } }) : Promise.resolve(null),
      employeeId: data.employeeId ? prisma.employee.findFirst({
        where: { organizationId, employeeCode: data.employeeId, NOT: { userId: id } }
      }) : Promise.resolve(null),
    };

    const [dupPhone, dupPan, dupAadhaar, dupUan, dupIfsc, dupEmp] = await Promise.all([
      updateChecks.phone, updateChecks.pan, updateChecks.aadhaar, updateChecks.uan, updateChecks.ifscCode, updateChecks.employeeId
    ]);

    const updateErrors = {};
    if (dupPhone) updateErrors.phone = `${data.phone || data.phoneNumber} ALREADY TAKEN`;
    if (dupPan) updateErrors.pan = `${data.pan} ALREADY TAKEN`;
    if (dupAadhaar) updateErrors.aadhaar = `${data.aadhaar} ALREADY TAKEN`;
    if (dupUan) updateErrors.uan = `${data.uan} ALREADY TAKEN`;
    if (dupIfsc) updateErrors.ifscCode = `${data.ifscCode} ALREADY TAKEN`;
    if (dupEmp) updateErrors.employeeId = `${data.employeeId} ALREADY TAKEN`;

    if (Object.keys(updateErrors).length > 0) {
      throw new AppError('Validation failed', 409, updateErrors);
    }

    delete data.password;
    delete data.refreshTokenHash;

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update User fields
      const userUpdate = {
        name: data.name ?? undefined,
        phone: data.phone ?? undefined,
        phoneNumber: data.phoneNumber ?? undefined,
        role: data.role ?? undefined,
        roleId: data.roleId ?? undefined,
        isActive: data.isActive ?? undefined,
        avatar: data.avatar ?? undefined,
        bankName: data.bankName !== undefined ? (data.bankName ? encrypt(data.bankName) : null) : undefined,
        accountNumber: data.accountNumber !== undefined ? (data.accountNumber ? encrypt(data.accountNumber) : null) : undefined,
        branchName: data.branchName !== undefined ? (data.branchName ? encrypt(data.branchName) : null) : undefined,
        ifscCode: data.ifscCode !== undefined ? (data.ifscCode ? encrypt(data.ifscCode) : null) : undefined,
        uan: data.uan !== undefined ? (data.uan ? encrypt(data.uan) : null) : undefined,
        pan: data.pan !== undefined ? (data.pan ? encrypt(data.pan) : null) : undefined,
        aadhaar: data.aadhaar !== undefined ? (data.aadhaar ? encrypt(data.aadhaar) : null) : undefined,
      };

      const updatedUser = await tx.user.update({
        where: { id_organizationId: { id, organizationId } },
        data: userUpdate,
        include: { 
          roleRef: true,
          employee: {
            include: {
              department: { select: { name: true } },
              designation: { select: { name: true } }
            }
          }
        },
      });

      // 2. Update Employee fields if needed
      const employeeUpdate = {};
      const hasEmployeeFields = data.employeeId || data.joiningDate || data.joinDate || data.department || data.departmentId || data.designation || data.designationId || data.leaveBalance;

      if (hasEmployeeFields) {
        if (data.employeeId) employeeUpdate.employeeCode = data.employeeId;
        if (data.joiningDate) employeeUpdate.joiningDate = new Date(data.joiningDate);
        if (data.joinDate) employeeUpdate.joiningDate = new Date(data.joinDate);

        if (data.department) {
          const dep = await tx.department.upsert({
            where: { organizationId_name: { organizationId, name: data.department.trim() } },
            update: {},
            create: { organizationId, name: data.department.trim() }
          });
          employeeUpdate.departmentId = dep.id;
        } else if (data.departmentId) {
          employeeUpdate.departmentId = data.departmentId;
        }

        if (data.designation) {
          const des = await tx.designation.upsert({
            where: { organizationId_name: { organizationId, name: data.designation.trim() } },
            update: {},
            create: { organizationId, name: data.designation.trim() }
          });
          employeeUpdate.designationId = des.id;
        } else if (data.designationId) {
          employeeUpdate.designationId = data.designationId;
        }

        // Check if employee record exists
        const existingEmp = await tx.employee.findUnique({ where: { userId: id } });
        
        let updatedEmp;
        if (existingEmp) {
          updatedEmp = await tx.employee.update({
            where: { userId: id },
            data: employeeUpdate,
            include: {
              department: { select: { name: true } },
              designation: { select: { name: true } }
            }
          });
        } else {
          // Create employee record if it doesn't exist but we have fields to save
          updatedEmp = await tx.employee.create({
            data: {
              ...employeeUpdate,
              userId: id,
              organizationId,
              employeeCode: data.employeeId || `EMP-${id.substring(0, 4)}`, // Fallback code
              status: 'ACTIVE'
            },
            include: {
              department: { select: { name: true } },
              designation: { select: { name: true } }
            }
          });
        }
        // 3. Handle Leave Balance Updates if provided
        if (data.leaveBalance && typeof data.leaveBalance === 'object') {
          const empId = updatedEmp.id;
          for (const [typeName, balance] of Object.entries(data.leaveBalance)) {
            const leaveType = await tx.leaveType.findFirst({
              where: { 
                organizationId, 
                OR: [
                  { name: { equals: typeName, mode: 'insensitive' } },
                  { name: { equals: typeName + ' Leave', mode: 'insensitive' } },
                  { name: { equals: typeName.replace(' Leave', ''), mode: 'insensitive' } }
                ]
              }
            });

            if (leaveType) {
              const quota = parseFloat(balance);
              await tx.leaveBalance.upsert({
                where: { 
                  employeeId_leaveTypeId: { 
                    employeeId: empId, 
                    leaveTypeId: leaveType.id 
                  } 
                },
                update: { total: quota, remaining: quota }, 
                create: { 
                  employeeId: empId, 
                  leaveTypeId: leaveType.id, 
                  total: quota,
                  remaining: quota
                }
              });
            }
          }
          
          // Refresh employee record to get updated balances
          const freshEmp = await tx.employee.findUnique({
             where: { id: empId },
             include: {
               department: { select: { name: true } },
               designation: { select: { name: true } },
               leaveBalances: { include: { leaveType: { select: { name: true } } } }
             }
          });
          updatedUser.employee = freshEmp;
        } else {
          updatedUser.employee = updatedEmp;
        }
      }

      return updatedUser;
    });

    return formatUser(updated);
  },

  async resetPassword(id, newPassword, organizationId) {
    const user = await prisma.user.findUnique({ where: { id_organizationId: { id, organizationId } } });
    if (!user || user.isDeleted) throw new AppError('User not found', 404);
    
    const hashed = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12);
    await prisma.user.update({ 
      where: { id_organizationId: { id, organizationId } }, 
      data: { password: hashed, refreshTokenHash: null } 
    });
    return true;
  },

  async deactivate(id, organizationId) {
    const user = await prisma.user.findUnique({ where: { id_organizationId: { id, organizationId } } });
    if (!user || user.isDeleted) throw new AppError('User not found', 404);
    
    const updated = await prisma.user.update({ 
      where: { id_organizationId: { id, organizationId } }, 
      data: { isActive: false, refreshTokenHash: null } 
    });
    return formatUser(updated);
  },

  async activate(id, organizationId) {
    const user = await prisma.user.findUnique({ where: { id_organizationId: { id, organizationId } } });
    if (!user || user.isDeleted) throw new AppError('User not found', 404);
    
    const updated = await prisma.user.update({ 
      where: { id_organizationId: { id, organizationId } }, 
      data: { isActive: true } 
    });
    return formatUser(updated);
  },

  async changeRole(id, role, organizationId) {
    const user = await prisma.user.findUnique({ where: { id_organizationId: { id, organizationId } } });
    if (!user || user.isDeleted) throw new AppError('User not found', 404);
    
    const updated = await prisma.user.update({ 
      where: { id_organizationId: { id, organizationId } }, 
      data: { role } 
    });
    return formatUser(updated);
  },

  async getMe(userId, organizationId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { 
        roleRef: true, 
        employee: {
          include: {
            department: { select: { name: true } },
            designation: { select: { name: true } },
            leaveBalances: { include: { leaveType: { select: { name: true } } } }
          }
        } 
      },
    });
    if (!user || user.isDeleted) throw new AppError('User not found', 404);
    return formatUser(user);
  },

  async deleteUser(id, organizationId) {
    const user = await prisma.user.findUnique({ where: { id_organizationId: { id, organizationId } } });
    if (!user || user.isDeleted) throw new AppError('User not found', 404);
    
    await prisma.user.update({ 
      where: { id_organizationId: { id, organizationId } }, 
      data: { isDeleted: true, deletedAt: new Date(), isActive: false } 
    });
    return true;
  },

  async getDepartments(organizationId) {
    const deps = await prisma.department.findMany({
      where: { organizationId },
      select: { name: true },
    });
    return deps.map(d => d.name);
  },

  async getRoles(organizationId) {
    const roles = await prisma.role.findMany({
      where: {
        OR: [{ organizationId: null }, { organizationId }],
        isDeleted: false
      },
      orderBy: { name: 'asc' }
    });

    // SELF-HEALING: ensuring standard roles exist for the organization
    const standardNames = ['Admin', 'HR', 'Finance', 'Manager', 'Employee'];
    const existingNamesInOrg = new Set(roles.filter(r => r.organizationId === organizationId).map(r => r.name.toLowerCase()));
    
    const missingStandards = standardNames.filter(name => !existingNamesInOrg.has(name.toLowerCase()));
    
    if (missingStandards.length > 0) {
      for (const name of missingStandards) {
        try {
          // Generate a unique ID for this organization's system role
          const roleId = `sys-${name.toLowerCase().replace(/\s+/g, '-')}-${organizationId}`;
          
          await prisma.role.upsert({
            where: { id_organizationId: { id: roleId, organizationId } },
            update: { isDeleted: false, isActive: true, isSystem: true },
            create: {
              id: roleId,
              organizationId,
              name: name,
              isSystem: true,
              permissions: name === 'Admin' ? { all: true } : {}, 
            }
          });
        } catch (err) {
          console.error(`Failed to heal role ${name}:`, err.message);
        }
      }
      
      // Re-fetch to return strictly org roles now that they are healed
      return await prisma.role.findMany({
        where: { organizationId, isDeleted: false },
        orderBy: { name: 'asc' }
      });
    }

    // If no healing was needed, still return unique by name, prioritizing this org
    const uniqueRoles = [];
    const seen = new Set();
    
    // Sort to prioritize org roles: those with organizationId !== null come first
    const sortedRoles = [...roles].sort((a, b) => {
        if (a.organizationId && !b.organizationId) return -1;
        if (!a.organizationId && b.organizationId) return 1;
        return 0;
    });

    for (const r of sortedRoles) {
        const lowerName = r.name.toLowerCase();
        if (!seen.has(lowerName)) {
            uniqueRoles.push(r);
            seen.add(lowerName);
        }
    }

    return uniqueRoles;
  },
};

function formatUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    _id: u.id, // Compatibility with frontend expecting _id
    name: u.name,
    email: u.email,
    role: u.role,
    roleId: u.roleId,
    roleName: u.roleRef?.name,
    permissions: (() => {
      const raw = u.roleRef?.permissions || {};
      const role = (u.role || '').toLowerCase();
      
      // Hardcoded fallbacks for system roles to ensure core access is always available
      const defaultPermissions = {
        'admin': ROLE_PERMISSIONS.ADMIN,
        'super_admin': ROLE_PERMISSIONS.ADMIN,
        'owner': ROLE_PERMISSIONS.ADMIN,
        'manager': ROLE_PERMISSIONS.MANAGER,
        'hr': ROLE_PERMISSIONS.HR,
        'finance': { 
          "Payroll": { "Dashboard": ["view"], "Payroll Engine": ["view", "approve", "disburse"], "Bank Export": ["view", "export"], "Payroll Reports": ["view", "export"] },
          "Reports": { "Reports Dashboard": ["view", "export"] },
          "My Payslip": { "Payslip View": ["view", "download"] }
        },
        'employee': ROLE_PERMISSIONS.EMPLOYEE
      };

      // If it's a standard system role, merge defaults with DB permissions to ensure critical updates are picked up
      if (['admin', 'manager', 'hr', 'finance', 'employee'].includes(role) && defaultPermissions[role]) {
        // We merge them, giving priority to DB permissions if they exist, 
        // but ensuring default keys from hardcoded list are present.
        const merged = { ...defaultPermissions[role] };
        
        // Deep merge for modules
        Object.keys(raw).forEach(module => {
          if (typeof raw[module] === 'object' && !Array.isArray(raw[module])) {
            merged[module] = { ...(merged[module] || {}), ...raw[module] };
          } else {
            merged[module] = raw[module];
          }
        });
        return merged;
      }
      
      if (Object.keys(raw).length > 0) return raw;
      return defaultPermissions[role] || {};
    })(),
    organizationId: u.organizationId,
    phone: u.phone,
    phoneNumber: u.phoneNumber,
    isActive: u.isActive,
    isOwner: u.isOwner,
    isOnboardingComplete: u.isOnboardingComplete,
    provider: u.provider,
    providers: u.providers,
    avatar: u.avatar,
    lastLogin: u.lastLogin,
    bankName: decrypt(u.bankName),
    accountNumber: decrypt(u.accountNumber),
    branchName: decrypt(u.branchName),
    ifscCode: decrypt(u.ifscCode),
    uan: decrypt(u.uan),
    pan: decrypt(u.pan),
    aadhaar: decrypt(u.aadhaar),
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    employeeId: u.employee?.employeeCode,
    department: u.employee?.department?.name,
    designation: u.employee?.designation?.name,
    joinDate: u.employee?.joiningDate,
    leaveBalance: (() => {
      const balanceObj = {};
      if (u.employee?.leaveBalances) {
        u.employee.leaveBalances.forEach(lb => {
          if (lb.leaveType?.name) {
            balanceObj[lb.leaveType.name] = lb.remaining;
          }
        });
      }
      return balanceObj;
    })(),
    employee: u.employee ? {
      ...u.employee,
      payrollProfile: u.employee.payrollProfile ? {
        ...u.employee.payrollProfile,
        earnings: decryptJson(u.employee.payrollProfile.earnings),
        deductions: decryptJson(u.employee.payrollProfile.deductions),
      } : null
    } : null,
  };
}

module.exports = userService;
