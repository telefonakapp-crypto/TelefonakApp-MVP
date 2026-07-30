/**
 * Shared listing moderation write used by Admin Web (verifyAdminAuth / admins).
 */
const pool = require('../config/database');
const {
  getListingDeviceName,
  notifyListingApproved,
  notifyListingRejected,
} = require('./notifications');
const { LISTING_STATUS, TERMINAL_LISTING_STATUSES } = require('./listingStatus');
const { writeAuditLog } = require('./auditLog');

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {{
 *   status: string,
 *   message: string,
 *   requireReason?: boolean,
 * }} options
 */
async function moderateListing(req, res, { status, message, requireReason = false }) {
  const { id } = req.params;
  const rawReason = req.body?.reason;
  const reason = typeof rawReason === 'string' ? rawReason.trim() : '';

  if (requireReason && !reason) {
    return res.status(400).json({ error: 'A decline reason is required' });
  }

  try {
    const current = await pool.query('SELECT status FROM listings WHERE id = $1', [id]);

    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (TERMINAL_LISTING_STATUSES.includes(current.rows[0].status)) {
      return res.status(409).json({
        error: `A ${current.rows[0].status} listing can no longer be moderated`,
      });
    }

    // Persist reason on decline; clear it when approving (or other non-decline).
    const declineReason =
      status === LISTING_STATUS.DECLINED ? reason || null : null;

    const result = await pool.query(
      `UPDATE listings
       SET status = $1,
           decline_reason = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND status <> ALL($4::text[])
       RETURNING *`,
      [status, declineReason, id, TERMINAL_LISTING_STATUSES]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Listing status changed, please try again' });
    }

    const listing = result.rows[0];
    const notify =
      status === LISTING_STATUS.APPROVED ? notifyListingApproved : notifyListingRejected;

    await notify(pool, {
      userId: listing.user_id,
      listingId: listing.id,
      deviceName: await getListingDeviceName(pool, listing.id),
      reason: reason || undefined,
    });

    // Admin Web audit only (verifyAdminAuth sets req.adminId).
    if (req.adminId) {
      await writeAuditLog({
        adminId: req.adminId,
        action:
          status === LISTING_STATUS.APPROVED
            ? 'listing.approve'
            : 'listing.decline',
        entityType: 'listing',
        entityId: listing.id,
        metadata: {
          previous_status: current.rows[0].status,
          new_status: listing.status,
          reason: reason || null,
        },
        req,
      });
    }

    res.json({ message, listing });
  } catch (error) {
    console.error(`Error setting listing status to ${status}:`, error);
    res.status(500).json({
      error: `Failed to ${status === LISTING_STATUS.APPROVED ? 'approve' : 'decline'} listing`,
    });
  }
}

module.exports = { moderateListing };
