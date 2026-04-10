'use strict';

const express = require('express');
const router = express.Router();
const subscriptionController = require('./subscription.controller');
const { authenticate } = require('../../middleware/auth.middleware');
 
 // All subscription routes are protected
 router.use(authenticate);

router.post('/upgrade', subscriptionController.upgrade);
router.get('/current', subscriptionController.getCurrent);
router.get('/history', subscriptionController.getHistory);

module.exports = router;
