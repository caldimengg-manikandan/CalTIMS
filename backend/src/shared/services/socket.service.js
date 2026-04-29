'use strict';

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { prisma } = require('../../config/database');
const logger = require('../utils/logger');

let io;

const init = (server) => {
  io = new Server(server, {
    path: '/api/socket.io',
    cors: {
      origin: [
        process.env.CLIENT_URL,
        'https://caldimproducts.com',
        'http://localhost:3000',
        'http://127.0.0.1:3000'
      ].filter(Boolean),
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      
      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
        select: { id: true, organizationId: true, role: true }
      });

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = user;
      next();
    } catch (err) {
      logger.error('Socket authentication failed:', err);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { id: userId, organizationId, role } = socket.user;
    logger.info(`Client connected: ${socket.id} (User: ${userId}, Org: ${organizationId})`);

    // Join organization room
    if (organizationId) {
      socket.join(`org_${organizationId}`);
      logger.debug(`User ${userId} joined room: org_${organizationId}`);
    }

    // Join personal room for targeted notifications
    socket.join(`user_${userId}`);
    logger.debug(`User ${userId} joined room: user_${userId}`);

    // Join superadmin room if applicable
    if (role === 'super_admin') {
      socket.join('global_audit');
      logger.info(`Super Admin ${userId} joined room: global_audit`);
    }

    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

/**
 * Enhanced emit function with targeting
 * @param {string} event - Event name
 * @param {any} data - Data to emit
 * @param {object} options - Options: { room, to, broadcast }
 */
const emit = (event, data, options = {}) => {
  if (!io) return;

  if (options.room || options.to) {
    io.to(options.room || options.to).emit(event, data);
  } else {
    io.emit(event, data);
  }
};

module.exports = {
  init,
  getIO,
  emit
};
