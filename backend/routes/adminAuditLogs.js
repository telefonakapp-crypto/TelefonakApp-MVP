const express = require('express');
const pool = require('../config/database');
const verifyAdminAuth = require('../middleware/verifyAdminAuth');
const { toPublicAdmin } = require('../utils/adminAuth');

const router = express.Router();

router.use(verifyAdminAuth);

function parsePositiveInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/**
 * GET /api/admin/audit-logs
 */
router.get('/', async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const offset = (page - 1) * limit;

    const action = typeof req.query.action === 'string' ? req.query.action.trim() : '';
    const entityType =
      typeof req.query.entity_type === 'string' ? req.query.entity_type.trim() : '';
    const admin = typeof req.query.admin === 'string' ? req.query.admin.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const dateFrom =
      typeof req.query.date_from === 'string' ? req.query.date_from.trim() : '';
    const dateTo = typeof req.query.date_to === 'string' ? req.query.date_to.trim() : '';

    const params = [];
    const where = [];

    const pushParam = (value) => {
      params.push(value);
      return params.length;
    };

    if (action) {
      where.push(`al.action = $${pushParam(action)}`);
    }

    if (entityType) {
      where.push(`al.entity_type = $${pushParam(entityType)}`);
    }

    if (admin) {
      if (/^\d+$/.test(admin)) {
        where.push(`al.admin_id = $${pushParam(parseInt(admin, 10))}`);
      } else {
        const pattern = `%${admin.replace(/[%_\\]/g, '')}%`;
        const idx = pushParam(pattern);
        where.push(`(
          a.full_name ILIKE $${idx}
          OR a.email ILIKE $${idx}
        )`);
      }
    }

    if (search) {
      const pattern = `%${search.replace(/[%_\\]/g, '')}%`;
      const idx = pushParam(pattern);
      where.push(`(
        al.action ILIKE $${idx}
        OR COALESCE(al.entity_type, '') ILIKE $${idx}
        OR COALESCE(al.entity_id, '') ILIKE $${idx}
        OR COALESCE(al.ip_address, '') ILIKE $${idx}
        OR COALESCE(a.full_name, '') ILIKE $${idx}
        OR COALESCE(a.email, '') ILIKE $${idx}
        OR al.metadata::text ILIKE $${idx}
      )`);
    }

    if (dateFrom) {
      const from = new Date(dateFrom);
      if (Number.isNaN(from.getTime())) {
        return res.status(400).json({ error: 'Invalid date_from' });
      }
      where.push(`al.created_at >= $${pushParam(from.toISOString())}`);
    }

    if (dateTo) {
      const to = new Date(dateTo);
      if (Number.isNaN(to.getTime())) {
        return res.status(400).json({ error: 'Invalid date_to' });
      }
      // Inclusive end-of-day when only a date is provided
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
        to.setHours(23, 59, 59, 999);
      }
      where.push(`al.created_at <= $${pushParam(to.toISOString())}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM audit_logs al
       LEFT JOIN admins a ON a.id = al.admin_id
       ${whereSql}`,
      params
    );

    const totalItems = countResult.rows[0].total;
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

    const limitIdx = pushParam(limit);
    const offsetIdx = pushParam(offset);

    const listResult = await pool.query(
      `SELECT
         al.id,
         al.admin_id,
         al.action,
         al.entity_type,
         al.entity_id,
         al.metadata,
         al.ip_address,
         al.user_agent,
         al.created_at,
         a.full_name AS admin_full_name,
         a.email AS admin_email,
         a.role AS admin_role,
         a.is_active AS admin_is_active
       FROM audit_logs al
       LEFT JOIN admins a ON a.id = al.admin_id
       ${whereSql}
       ORDER BY al.created_at DESC, al.id DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    const items = listResult.rows.map((row) => ({
      id: Number(row.id),
      admin_id: row.admin_id,
      admin: row.admin_id
        ? toPublicAdmin({
            id: row.admin_id,
            full_name: row.admin_full_name,
            email: row.admin_email,
            role: row.admin_role,
            is_active: row.admin_is_active,
          })
        : null,
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      metadata: row.metadata || {},
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      created_at: row.created_at,
    }));

    // Distinct filter options for the UI
    const [actionsResult, entitiesResult, adminsResult] = await Promise.all([
      pool.query(
        `SELECT DISTINCT action FROM audit_logs ORDER BY action ASC`
      ),
      pool.query(
        `SELECT DISTINCT entity_type
         FROM audit_logs
         WHERE entity_type IS NOT NULL
         ORDER BY entity_type ASC`
      ),
      pool.query(
        `SELECT DISTINCT a.id, a.full_name, a.email
         FROM audit_logs al
         JOIN admins a ON a.id = al.admin_id
         ORDER BY a.full_name ASC`
      ),
    ]);

    res.json({
      items,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
      },
      filters: {
        actions: actionsResult.rows.map((r) => r.action),
        entityTypes: entitiesResult.rows.map((r) => r.entity_type),
        admins: adminsResult.rows,
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

/**
 * GET /api/admin/audit-logs/:id
 */
router.get('/:id(\\d+)', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT
         al.*,
         a.full_name AS admin_full_name,
         a.email AS admin_email,
         a.role AS admin_role,
         a.is_active AS admin_is_active
       FROM audit_logs al
       LEFT JOIN admins a ON a.id = al.admin_id
       WHERE al.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Audit log not found' });
    }

    const row = result.rows[0];
    res.json({
      log: {
        id: Number(row.id),
        admin_id: row.admin_id,
        admin: row.admin_id
          ? toPublicAdmin({
              id: row.admin_id,
              full_name: row.admin_full_name,
              email: row.admin_email,
              role: row.admin_role,
              is_active: row.admin_is_active,
            })
          : null,
        action: row.action,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        metadata: row.metadata || {},
        ip_address: row.ip_address,
        user_agent: row.user_agent,
        created_at: row.created_at,
      },
    });
  } catch (error) {
    console.error('Error fetching audit log detail:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

module.exports = router;
