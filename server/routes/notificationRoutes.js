
import express from 'express';
import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// Get notifications belonging only to the logged-in user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const recipientId = req.user.userId;

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ recipient: recipientId })
        .populate('issue', 'title status')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      Notification.countDocuments({
        recipient: recipientId,
        isRead: false,
      }),
    ]);

    return res.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Fetch notifications error:', error.message);
    return res.status(500).json({ error: 'Unable to fetch notifications' });
  }
});

// Mark one of the logged-in user's notifications as read
router.patch('/:id/read', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid notification ID' });
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        recipient: req.user.userId,
      },
      { $set: { isRead: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    return res.json({ message: 'Notification marked as read', notification });
  } catch (error) {
    console.error('Mark notification read error:', error.message);
    return res.status(500).json({ error: 'Unable to update notification' });
  }
});

// Mark all notifications belonging to the logged-in user as read
router.patch('/read-all', authMiddleware, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.userId, isRead: false },
      { $set: { isRead: true } }
    );

    return res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read error:', error.message);
    return res.status(500).json({ error: 'Unable to update notifications' });
  }
});

export default router;
