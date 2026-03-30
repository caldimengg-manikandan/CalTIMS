'use strict';

const Notification = require('./notification.model');

const notificationService = {
  async create({ userId, type, title, message, refId = null, refModel = null, organizationId }) {
    if (!organizationId) {
      console.warn(`[NotificationService] Missing organizationId for notification to user ${userId}`);
    }
    return Notification.create({ userId, type, title, message, refId, refModel, organizationId });
  },

  async getForUser(userId, query = {}, organizationId) {
    const limit = Math.min(parseInt(query.limit) || 20, 5000);
    const page = parseInt(query.page) || 1;
    const skip = (page - 1) * limit;
    const filter = { userId, organizationId };
    if (query.unreadOnly === 'true') filter.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId, organizationId, isRead: false }),
    ]);

    return { notifications, total, unreadCount, page, limit };
  },

  async markRead(id, userId, organizationId) {
    return Notification.findOneAndUpdate(
      { _id: id, userId, organizationId },
      { isRead: true },
      { new: true }
    );
  },

  async markAllRead(userId, organizationId) {
    return Notification.updateMany({ userId, isRead: false, organizationId }, { isRead: true });
  },

  async getUnreadCount(userId, organizationId) {
    return Notification.countDocuments({ userId, isRead: false, organizationId });
  },

  async clearAll(userId, organizationId) {
    return Notification.deleteMany({ userId, organizationId });
  },
};

module.exports = notificationService;
