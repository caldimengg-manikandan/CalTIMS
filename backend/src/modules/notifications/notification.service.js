'use strict';

const { prisma } = require('../../config/database');
const socketService = require('../../shared/services/socket.service');

const notificationService = {
  async create({ userId, type, title, message, refId = null, refModel = null, organizationId, link = null }) {
    if (!organizationId) {
      console.warn(`[NotificationService] Missing organizationId for notification to user ${userId}`);
    }
    const notification = await prisma.notification.create({
      data: {
        userId,
        organizationId: organizationId || '',
        title: title || type,
        message,
        isRead: false,
        link: link || (refId ? `/${(refModel || '').toLowerCase()}s/${refId}` : null),
      },
    });

    // Real-time delivery via Socket.io
    socketService.emit('notification', notification, { room: `user_${userId}` });

    return notification;
  },

  async getForUser(userId, query = {}, organizationId) {
    const limit = Math.min(parseInt(query.limit) || 20, 5000);
    const page = parseInt(query.page) || 1;
    const skip = (page - 1) * limit;

    const where = { userId, organizationId };
    if (query.unreadOnly === 'true') where.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, organizationId, isRead: false } }),
    ]);

    return { notifications, total, unreadCount, page, limit };
  },

  async markRead(id, userId, organizationId) {
    return prisma.notification.updateMany({
      where: { id, userId, organizationId },
      data: { isRead: true },
    });
  },

  async markAllRead(userId, organizationId) {
    return prisma.notification.updateMany({
      where: { userId, organizationId, isRead: false },
      data: { isRead: true },
    });
  },

  async getUnreadCount(userId, organizationId) {
    return prisma.notification.count({ where: { userId, organizationId, isRead: false } });
  },

  async clearAll(userId, organizationId) {
    return prisma.notification.deleteMany({ where: { userId, organizationId } });
  },
};

module.exports = notificationService;
