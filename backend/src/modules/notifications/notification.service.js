'use strict';

const Notification = require('./notification.model');

const notificationService = {
  async create({ userId, type, title, message, refId = null, refModel = null }) {
    return Notification.create({ userId, type, title, message, refId, refModel });
  },

  async getForUser(userId, query = {}) {
    const limit = Math.min(parseInt(query.limit) || 20, 5000);
    const page = parseInt(query.page) || 1;
    const skip = (page - 1) * limit;
    const filter = { userId };
    if (query.unreadOnly === 'true') filter.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId, isRead: false }),
    ]);

    return { notifications, total, unreadCount, page, limit };
  },

  async markRead(id, userId) {
    return Notification.findOneAndUpdate(
      { _id: id, userId },
      { isRead: true },
      { new: true }
    );
  },

  async markAllRead(userId) {
    return Notification.updateMany({ userId, isRead: false }, { isRead: true });
  },

  async getUnreadCount(userId) {
    return Notification.countDocuments({ userId, isRead: false });
  },

  async clearAll(userId) {
    return Notification.deleteMany({ userId });
  },
};

module.exports = notificationService;
