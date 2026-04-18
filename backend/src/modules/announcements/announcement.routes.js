const express = require('express');
const router = express.Router();
const { prisma } = require('../../config/database');
const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/apiResponse');
const { parsePagination, buildPaginationMeta } = require('../../shared/utils/pagination');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize, checkPermission } = require('../../middleware/rbac.middleware');

router.use(authenticate);

// ─── Public/Role-based View ───────────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const now = new Date();
  
  const where = {
    organizationId: req.organizationId,
    isActive: true,
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: now } }
    ]
  };

  // Use standardized permission utility
  const { hasPermission } = require('../../shared/utils/rbac');
  const canViewAll = hasPermission(req.user.permissions, 'Announcements', 'Announcements', 'view');

  if (!canViewAll) {
    where.AND = [
      {
        OR: [
          { targetRoles: { has: req.user.role } },
          { targetRoles: { equals: [] } }
        ]
      }
    ];
  }

  const [announcements, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      include: { author: { select: { name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.announcement.count({ where }),
  ]);

  ApiResponse.success(res, { data: announcements, pagination: buildPaginationMeta(total, page, limit) });
}));

// ─── Admin View ───────────────────────────────────────────────────────────────
router.get('/admin', checkPermission('Announcements', 'Announcements', 'view'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const where = { 
    organizationId: req.organizationId,
    isDeleted: false 
  };
  
  const [announcements, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      include: { author: { select: { name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.announcement.count({ where }),
  ]);
  
  ApiResponse.success(res, { data: announcements, pagination: buildPaginationMeta(total, page, limit) });
}));

// ─── Create ──────────────────────────────────────────────────────────────────
router.post('/', checkPermission('Announcements', 'Announcements', 'create'), asyncHandler(async (req, res) => {
  const { title, content, type, priority, targetRoles, expiresAt } = req.body;
  
  // ── Duplicate Check (Same Day) ──
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const existing = await prisma.announcement.findFirst({
    where: {
      organizationId: req.organizationId,
      title: title.trim(),
      content: content.trim(),
      createdAt: {
        gte: startOfDay,
        lte: endOfDay
      },
      isDeleted: false
    }
  });

  if (existing) {
    return ApiResponse.badRequest(res, 'This announcement has already been published today.');
  }

  const ann = await prisma.announcement.create({
    data: {
      title: title.trim(),
      content: content.trim(),
      type: type || 'INFO',
      priority: priority || 'LOW',
      targetRoles: targetRoles || [],
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      organizationId: req.organizationId,
      authorId: req.user.id,
    }
  });

  ApiResponse.created(res, { message: 'Announcement published', data: ann });
}));

// ─── Update ──────────────────────────────────────────────────────────────────
router.put('/:id', checkPermission('Announcements', 'Announcements', 'edit'), asyncHandler(async (req, res) => {
  const { title, content, type, priority, targetRoles, expiresAt, isActive } = req.body;

  const ann = await prisma.announcement.update({
    where: { 
      id: req.params.id,
      organizationId: req.organizationId 
    },
    data: {
      title,
      content,
      type,
      priority,
      targetRoles,
      isActive,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    }
  });
  ApiResponse.success(res, { message: 'Announcement updated', data: ann });
}));

// ─── Delete ──────────────────────────────────────────────────────────────────
router.delete('/:id', checkPermission('Announcements', 'Announcements', 'edit'), asyncHandler(async (req, res) => {
  await prisma.announcement.update({
    where: { 
      id: req.params.id,
      organizationId: req.organizationId
    },
    data: { isDeleted: true, isActive: false }
  });
  ApiResponse.success(res, { message: 'Announcement deleted' });
}));

module.exports = router;
