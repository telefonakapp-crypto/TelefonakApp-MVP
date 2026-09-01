const express = require('express');
const pool = require('../config/database');
const verifyAdminAuth = require('../middleware/verifyAdminAuth');
const { LISTING_STATUS } = require('../utils/listingStatus');
const { writeAuditLog } = require('../utils/auditLog');

const router = express.Router();

router.use(verifyAdminAuth);

const ALLOWED_RANGES = new Set([7, 30, 90]);

function parseDays(raw, fallback = 30) {
  const days = parseInt(raw, 10);
  if (ALLOWED_RANGES.has(days)) return days;
  return fallback;
}

function countByKey(rows, key, value) {
  const match = rows.find((row) => row[key] === value);
  return match ? Number(match.count) : 0;
}

function fillDailySeries(rows, days) {
  const map = new Map(
    rows.map((row) => [String(row.day).slice(0, 10), Number(row.count)])
  );
  const series = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    series.push({ date: key, count: map.get(key) || 0 });
  }
  return series;
}

function csvEscape(value) {
  if (value == null) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers, rows) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

/**
 * GET /api/admin/reports/overview
 */
router.get('/overview', async (req, res) => {
  try {
    const [
      usersAgg,
      listingsAgg,
      eventsAgg,
      offersByStatus,
      bannersAgg,
    ] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE is_active = TRUE)::int AS active,
           COUNT(*) FILTER (WHERE is_active = FALSE)::int AS disabled,
           COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS new_today,
           COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days')::int AS new_this_week,
           COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP))::int AS new_this_month
         FROM users`
      ),
      pool.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = $2)::int AS pending,
           COUNT(*) FILTER (WHERE status = $3)::int AS resubmitted,
           COUNT(*) FILTER (WHERE status = $8)::int AS updated,
           COUNT(*) FILTER (WHERE status = $4)::int AS approved,
           COUNT(*) FILTER (WHERE status = $5)::int AS declined,
           COUNT(*) FILTER (WHERE status = $6)::int AS sold,
           COUNT(*) FILTER (WHERE status = $7)::int AS hidden,
           COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS created_today,
           COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days')::int AS created_this_week,
           COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP))::int AS created_this_month,
           COUNT(DISTINCT root_listing_id)::int AS logical_listings,
           -- Durable revision volume (survives later approve/decline of the tip)
           COUNT(*) FILTER (
             WHERE previous_listing_id IS NOT NULL OR revision_number > 1
           )::int AS resubmissions_received,
           COUNT(*) FILTER (
             WHERE (previous_listing_id IS NOT NULL OR revision_number > 1)
               AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)
           )::int AS resubmissions_received_this_month,
           COUNT(*) FILTER (
             WHERE status = $5
               AND COALESCE(approved_or_rejected_at, created_at) >= date_trunc('month', CURRENT_TIMESTAMP)
           )::int AS declined_this_month,
           COUNT(*) FILTER (
             WHERE status = $4
               AND COALESCE(approved_or_rejected_at, created_at) >= date_trunc('month', CURRENT_TIMESTAMP)
           )::int AS approved_this_month,
           ROUND(
             CASE
               WHEN COUNT(DISTINCT root_listing_id) = 0 THEN 0
               ELSE COUNT(*)::numeric / COUNT(DISTINCT root_listing_id)::numeric
             END,
             2
           ) AS avg_revisions_per_listing
         FROM listings
         WHERE status <> $1`,
        [
          LISTING_STATUS.DELETED,
          LISTING_STATUS.PENDING,
          LISTING_STATUS.RESUBMITTED,
          LISTING_STATUS.APPROVED,
          LISTING_STATUS.DECLINED,
          LISTING_STATUS.SOLD,
          LISTING_STATUS.HIDDEN,
          LISTING_STATUS.UPDATED,
        ]
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE event_type = 'resubmitted')::int AS resubmissions_received,
           COUNT(*) FILTER (
             WHERE event_type = 'resubmitted'
               AND occurred_at >= date_trunc('month', CURRENT_TIMESTAMP)
               AND occurred_at < date_trunc('month', CURRENT_TIMESTAMP) + INTERVAL '1 month'
           )::int AS resubmissions_received_this_month,
           COUNT(*) FILTER (WHERE event_type = 'updated')::int AS updates_received,
           COUNT(*) FILTER (
             WHERE event_type = 'updated'
               AND occurred_at >= date_trunc('month', CURRENT_TIMESTAMP)
               AND occurred_at < date_trunc('month', CURRENT_TIMESTAMP) + INTERVAL '1 month'
           )::int AS updates_received_this_month
         FROM listing_moderation_events`
      ),
      pool.query(
        `SELECT status, COUNT(*)::int AS count
         FROM offers
         GROUP BY status`
      ),
      pool.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (
             WHERE is_active = TRUE
               AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
               AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP)
           )::int AS active,
           COUNT(*) FILTER (
             WHERE is_active = TRUE
               AND starts_at IS NOT NULL
               AND starts_at > CURRENT_TIMESTAMP
           )::int AS scheduled,
           COUNT(*) FILTER (
             WHERE is_active = TRUE
               AND ends_at IS NOT NULL
               AND ends_at <= CURRENT_TIMESTAMP
           )::int AS expired,
           COUNT(*) FILTER (WHERE is_active = FALSE)::int AS disabled
         FROM banners`
      ),
    ]);

    const listingCreated = listingsAgg.rows[0];
    const eventCounts = eventsAgg.rows[0];
    const offerRows = offersByStatus.rows;
    const banners = bannersAgg.rows[0];
    const users = usersAgg.rows[0];

    res.json({
      users: {
        total: users.total,
        active: users.active,
        disabled: users.disabled,
        newToday: users.new_today,
        newThisWeek: users.new_this_week,
        newThisMonth: users.new_this_month,
      },
      listings: {
        total: listingCreated.total,
        pending: listingCreated.pending,
        // Current queues: rows still awaiting review
        resubmitted: listingCreated.resubmitted,
        updated: listingCreated.updated,
        approved: listingCreated.approved,
        declined: listingCreated.declined,
        sold: listingCreated.sold,
        hidden: listingCreated.hidden,
        createdToday: listingCreated.created_today,
        createdThisWeek: listingCreated.created_this_week,
        createdThisMonth: listingCreated.created_this_month,
        logicalListings: listingCreated.logical_listings,
        // Durable revision metrics (do not drop when a tip is later approved)
        revisionSnapshots: listingCreated.resubmissions_received,
        resubmissionsReceived: eventCounts.resubmissions_received,
        resubmissionsReceivedThisMonth: eventCounts.resubmissions_received_this_month,
        updatesReceived: eventCounts.updates_received,
        updatesReceivedThisMonth: eventCounts.updates_received_this_month,
        declinedThisMonth: listingCreated.declined_this_month,
        approvedThisMonth: listingCreated.approved_this_month,
        avgRevisionsPerListing: Number(listingCreated.avg_revisions_per_listing),
      },
      offers: {
        total: offerRows.reduce((sum, row) => sum + Number(row.count), 0),
        pending: countByKey(offerRows, 'status', 'pending'),
        accepted: countByKey(offerRows, 'status', 'accepted'),
        rejected: countByKey(offerRows, 'status', 'rejected'),
      },
      banners: {
        total: banners.total,
        active: banners.active,
        scheduled: banners.scheduled,
        expired: banners.expired,
        disabled: banners.disabled,
      },
    });
  } catch (error) {
    console.error('Error building reports overview:', error);
    res.status(500).json({ error: 'Failed to load reports overview' });
  }
});

/**
 * GET /api/admin/reports/charts?days=7|30|90
 */
router.get('/charts', async (req, res) => {
  try {
    const days = parseDays(req.query.days, 30);
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    const [
      userRegs,
      listingCreates,
      byBrand,
      byCondition,
      byStatus,
      avgPriceByBrand,
    ] = await Promise.all([
      pool.query(
        `SELECT DATE(created_at) AS day, COUNT(*)::int AS count
         FROM users
         WHERE created_at >= $1
         GROUP BY DATE(created_at)
         ORDER BY day ASC`,
        [since]
      ),
      pool.query(
        `SELECT DATE(created_at) AS day, COUNT(*)::int AS count
         FROM listings
         WHERE created_at >= $1
           AND status <> $2
         GROUP BY DATE(created_at)
         ORDER BY day ASC`,
        [since, LISTING_STATUS.DELETED]
      ),
      pool.query(
        `SELECT b.name AS label, COUNT(*)::int AS count
         FROM listings l
         JOIN models m ON m.id = l.model_id
         JOIN brands b ON b.id = m.brand_id
         WHERE l.created_at >= $1
           AND l.status <> $2
         GROUP BY b.name
         ORDER BY count DESC, b.name ASC
         LIMIT 10`,
        [since, LISTING_STATUS.DELETED]
      ),
      pool.query(
        `SELECT cond.name AS label, COUNT(*)::int AS count
         FROM listings l
         JOIN conditions cond ON cond.id = l.condition_id
         WHERE l.created_at >= $1
           AND l.status <> $2
         GROUP BY cond.name
         ORDER BY count DESC, cond.name ASC`,
        [since, LISTING_STATUS.DELETED]
      ),
      pool.query(
        `SELECT status AS label, COUNT(*)::int AS count
         FROM listings
         WHERE created_at >= $1
           AND status <> $2
         GROUP BY status
         ORDER BY count DESC`,
        [since, LISTING_STATUS.DELETED]
      ),
      pool.query(
        `SELECT b.name AS label, ROUND(AVG(l.price)::numeric, 2)::float AS value
         FROM listings l
         JOIN models m ON m.id = l.model_id
         JOIN brands b ON b.id = m.brand_id
         WHERE l.created_at >= $1
           AND l.status <> $2
         GROUP BY b.name
         ORDER BY value DESC, b.name ASC
         LIMIT 10`,
        [since, LISTING_STATUS.DELETED]
      ),
    ]);

    res.json({
      days,
      userRegistrations: fillDailySeries(userRegs.rows, days),
      listingsCreated: fillDailySeries(listingCreates.rows, days),
      listingsByBrand: byBrand.rows.map((row) => ({
        label: row.label,
        count: Number(row.count),
      })),
      listingsByCondition: byCondition.rows.map((row) => ({
        label: row.label,
        count: Number(row.count),
      })),
      listingStatusDistribution: byStatus.rows.map((row) => ({
        label: row.label,
        count: Number(row.count),
      })),
      averagePriceByBrand: avgPriceByBrand.rows.map((row) => ({
        label: row.label,
        value: Number(row.value),
      })),
    });
  } catch (error) {
    console.error('Error building reports charts:', error);
    res.status(500).json({ error: 'Failed to load report charts' });
  }
});

/**
 * GET /api/admin/reports/export?type=users|listings|offers
 */
router.get('/export', async (req, res) => {
  try {
    const type = String(req.query.type || '').trim().toLowerCase();

    if (!['users', 'listings', 'offers'].includes(type)) {
      return res.status(400).json({
        error: 'Invalid export type. Allowed: users, listings, offers',
      });
    }

    if (type === 'users') {
      const result = await pool.query(
        `SELECT
           id,
           first_name,
           last_name,
           phone_number,
           email,
           is_active,
           is_verified,
           created_at
         FROM users
         ORDER BY created_at DESC`
      );

      const headers = [
        'id',
        'first_name',
        'last_name',
        'phone_number',
        'email',
        'is_active',
        'is_verified',
        'created_at',
      ];
      const csv = toCsv(
        headers,
        result.rows.map((row) => ({
          id: row.id,
          first_name: row.first_name,
          last_name: row.last_name,
          phone_number: row.phone_number,
          email: row.email,
          is_active: row.is_active,
          is_verified: row.is_verified,
          created_at: row.created_at?.toISOString?.() || row.created_at,
        }))
      );

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="telefonak-users.csv"'
      );
      await writeAuditLog({
        adminId: req.admin.id,
        action: 'report.export',
        entityType: 'report',
        entityId: 'users',
        metadata: { type: 'users', rows: result.rows.length },
        req,
      });
      return res.send(csv);
    }

    if (type === 'listings') {
      const result = await pool.query(
        `SELECT
           l.id,
           l.status,
           l.price,
           l.battery_percentage,
           l.created_at,
           b.name AS brand_name,
           m.name AS model_name,
           u.first_name AS seller_first_name,
           u.last_name AS seller_last_name,
           u.phone_number AS seller_phone
         FROM listings l
         JOIN models m ON m.id = l.model_id
         JOIN brands b ON b.id = m.brand_id
         JOIN users u ON u.id = l.user_id
         WHERE l.status <> $1
         ORDER BY l.created_at DESC`,
        [LISTING_STATUS.DELETED]
      );

      const headers = [
        'id',
        'brand_name',
        'model_name',
        'price',
        'battery_percentage',
        'status',
        'seller_name',
        'seller_phone',
        'created_at',
      ];
      const csv = toCsv(
        headers,
        result.rows.map((row) => ({
          id: row.id,
          brand_name: row.brand_name,
          model_name: row.model_name,
          price: row.price,
          battery_percentage: row.battery_percentage,
          status: row.status,
          seller_name: `${row.seller_first_name || ''} ${row.seller_last_name || ''}`.trim(),
          seller_phone: row.seller_phone,
          created_at: row.created_at?.toISOString?.() || row.created_at,
        }))
      );

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="telefonak-listings.csv"'
      );
      await writeAuditLog({
        adminId: req.admin.id,
        action: 'report.export',
        entityType: 'report',
        entityId: 'listings',
        metadata: { type: 'listings', rows: result.rows.length },
        req,
      });
      return res.send(csv);
    }

    const result = await pool.query(
      `SELECT
         o.id,
         o.listing_id,
         o.offered_price,
         o.status,
         o.created_at,
         o.updated_at,
         buyer.first_name AS buyer_first_name,
         buyer.last_name AS buyer_last_name,
         buyer.phone_number AS buyer_phone,
         seller.first_name AS seller_first_name,
         seller.last_name AS seller_last_name,
         seller.phone_number AS seller_phone
       FROM offers o
       JOIN users buyer ON buyer.id = o.buyer_id
       JOIN users seller ON seller.id = o.seller_id
       ORDER BY o.created_at DESC`
    );

    const headers = [
      'id',
      'listing_id',
      'offered_price',
      'status',
      'buyer_name',
      'buyer_phone',
      'seller_name',
      'seller_phone',
      'created_at',
      'updated_at',
    ];
    const csv = toCsv(
      headers,
      result.rows.map((row) => ({
        id: row.id,
        listing_id: row.listing_id,
        offered_price: row.offered_price,
        status: row.status,
        buyer_name: `${row.buyer_first_name || ''} ${row.buyer_last_name || ''}`.trim(),
        buyer_phone: row.buyer_phone,
        seller_name: `${row.seller_first_name || ''} ${row.seller_last_name || ''}`.trim(),
        seller_phone: row.seller_phone,
        created_at: row.created_at?.toISOString?.() || row.created_at,
        updated_at: row.updated_at?.toISOString?.() || row.updated_at,
      }))
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="telefonak-offers.csv"'
    );
    await writeAuditLog({
      adminId: req.admin.id,
      action: 'report.export',
      entityType: 'report',
      entityId: 'offers',
      metadata: { type: 'offers', rows: result.rows.length },
      req,
    });
    return res.send(csv);
  } catch (error) {
    console.error('Error exporting report CSV:', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

module.exports = router;
