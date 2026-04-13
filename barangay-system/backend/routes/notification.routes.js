const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const notifService = require('../services/notification.service');

// GET /api/notifications
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { limit, unread_only } = req.query;
    const data = await notifService.getUserNotifications(req.user.id, {
      limit: parseInt(limit) || 50,
      unreadOnly: unread_only === 'true',
    });
    res.json({ data });
  } catch (err) { next(err); }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticate, async (req, res, next) => {
  try {
    await notifService.markAsRead(req.params.id, req.user.id);
    res.json({ message: 'Marked as read' });
  } catch (err) { next(err); }
});

// PUT /api/notifications/read-all
router.put('/read-all', authenticate, async (req, res, next) => {
  try {
    await notifService.markAllRead(req.user.id);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) { next(err); }
});

module.exports = router;
