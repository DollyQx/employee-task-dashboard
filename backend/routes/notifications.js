const express = require('express');
const { getPool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

function createNotificationsRoutes({ poolProvider = getPool } = {}) {
  const router = express.Router();

  router.get('/', requireAuth, async (req, res) => {
    try {
      const pool = poolProvider();
      const userId = req.user.id;
      const orgId = req.user.organization_id;

      const { rows } = await pool.query(
        `SELECT id, title, message, type, entity_type, entity_id, is_read, created_at
         FROM notifications
         WHERE user_id = $1 AND organization_id = $2
         ORDER BY created_at DESC
         LIMIT 50`,
        [userId, orgId]
      );

      const unreadCount = rows.filter((n) => !n.is_read).length;

      return res.json({ notifications: rows, unreadCount });
    } catch (err) {
      console.error('List notifications error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch notifications.' });
    }
  });

  router.patch('/:id/read', requireAuth, async (req, res) => {
    try {
      const pool = poolProvider();
      const notifId = req.params.id;
      const userId = req.user.id;

      await pool.query(
        'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
        [notifId, userId]
      );

      return res.json({ message: 'Notification marked as read.' });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update notification.' });
    }
  });

  router.post('/mark-all-read', requireAuth, async (req, res) => {
    try {
      const pool = poolProvider();
      const userId = req.user.id;

      await pool.query('UPDATE notifications SET is_read = true WHERE user_id = $1', [userId]);

      return res.json({ message: 'All notifications marked as read.' });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to mark notifications read.' });
    }
  });

  return router;
}

module.exports = { createNotificationsRoutes };
