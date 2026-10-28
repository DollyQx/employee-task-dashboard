async function logAudit(pool, {
  organizationId,
  userId = null,
  actorName = 'System',
  action,
  entityType,
  entityId = null,
  details = null,
  ipAddress = null,
}) {
  if (!pool || !organizationId || !action || !entityType) return;
  try {
    const detailsString = details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null;
    await pool.query(
      `INSERT INTO audit_logs (organization_id, user_id, actor_name, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [organizationId, userId, actorName, action, entityType, entityId, detailsString, ipAddress]
    );
  } catch (err) {
    console.error('Failed to log audit event:', err.message);
  }
}

module.exports = { logAudit };
