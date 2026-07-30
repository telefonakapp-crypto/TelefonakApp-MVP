const pool = require('../config/database');

/**
 * Resolve client IP from Express request (supports proxies).
 * @param {import('express').Request} req
 */
function resolveIpAddress(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim().slice(0, 64);
  }
  return (req.ip || req.socket?.remoteAddress || '').slice(0, 64) || null;
}

/**
 * Fire-and-forget safe audit writer. Never throws to callers.
 *
 * @param {{
 *   adminId?: number|null,
 *   action: string,
 *   entityType?: string|null,
 *   entityId?: string|number|null,
 *   metadata?: Record<string, unknown>,
 *   req?: import('express').Request,
 * }} params
 */
async function writeAuditLog({
  adminId = null,
  action,
  entityType = null,
  entityId = null,
  metadata = {},
  req = null,
}) {
  try {
    if (!action) return;

    await pool.query(
      `INSERT INTO audit_logs (
         admin_id, action, entity_type, entity_id, metadata, ip_address, user_agent
       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
      [
        adminId || null,
        String(action).slice(0, 64),
        entityType ? String(entityType).slice(0, 64) : null,
        entityId == null ? null : String(entityId).slice(0, 64),
        JSON.stringify(metadata || {}),
        req ? resolveIpAddress(req) : null,
        req?.headers?.['user-agent']
          ? String(req.headers['user-agent']).slice(0, 1000)
          : null,
      ]
    );
  } catch (error) {
    console.error('Failed to write audit log:', error.message);
  }
}

module.exports = {
  writeAuditLog,
  resolveIpAddress,
};
