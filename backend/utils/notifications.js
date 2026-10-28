async function createNotification(pool, {
  organizationId,
  userId,
  title,
  message,
  type = 'info',
  entityType = null,
  entityId = null,
}) {
  if (!pool || !organizationId || !userId || !title || !message) return null;
  try {
    const { rows } = await pool.query(
      `INSERT INTO notifications (organization_id, user_id, title, message, type, entity_type, entity_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [organizationId, userId, title, message, type, entityType, entityId]
    );
    return rows[0];
  } catch (err) {
    console.error('Failed to create notification:', err.message);
    return null;
  }
}

module.exports = { createNotification };
