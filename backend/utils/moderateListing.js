/**
 * Shared listing moderation write used by Admin Web (verifyAdminAuth / admins).
 *
 * Allowed transitions:
 *   pending | resubmitted | updated → approved
 *   pending | resubmitted | updated → declined
 *   approved → declined   (policy revoke; same row, no revision)
 *
 * Declined / sold / deleted snapshots cannot be moderated.
 */
const pool = require('../config/database');
const {
  getListingDeviceName,
  notifyListingApproved,
  notifyListingRejected,
  notifyListingDeclinedFromApproved,
} = require('./notifications');
const {
  LISTING_STATUS,
  TERMINAL_LISTING_STATUSES,
} = require('./listingStatus');
const { writeAuditLog } = require('./auditLog');
const { recordListingModerationEvent, EVENT_TYPE } = require('./listingModerationEvents');
const { startAuctionIfBidListing, LISTING_SALE_TYPE } = require('./listingAuctions');

function allowedSourceStatusesFor(targetStatus) {
  if (targetStatus === LISTING_STATUS.APPROVED) {
    return [
      LISTING_STATUS.PENDING,
      LISTING_STATUS.RESUBMITTED,
      LISTING_STATUS.UPDATED,
    ];
  }
  if (targetStatus === LISTING_STATUS.DECLINED) {
    return [
      LISTING_STATUS.PENDING,
      LISTING_STATUS.RESUBMITTED,
      LISTING_STATUS.UPDATED,
      LISTING_STATUS.APPROVED,
    ];
  }
  return [];
}

function canModerateTo(currentStatus, targetStatus) {
  return allowedSourceStatusesFor(targetStatus).includes(currentStatus);
}

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
    const current = await pool.query(
      'SELECT status, sale_type FROM listings WHERE id = $1',
      [id]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const currentStatus = current.rows[0].status;

    if (TERMINAL_LISTING_STATUSES.includes(currentStatus)) {
      return res.status(409).json({
        error: `A ${currentStatus} listing can no longer be moderated`,
      });
    }

    // Declined snapshots are immutable history — never approve/reopen them.
    if (currentStatus === LISTING_STATUS.DECLINED) {
      return res.status(409).json({
        error: 'A declined listing is an immutable snapshot and cannot be moderated',
      });
    }

    if (!canModerateTo(currentStatus, status)) {
      if (status === LISTING_STATUS.APPROVED) {
        return res.status(409).json({
          error: `Only pending, resubmitted, or updated listings can be approved (current: ${currentStatus})`,
        });
      }
      return res.status(409).json({
        error: `Only pending, resubmitted, updated, or approved listings can be declined (current: ${currentStatus})`,
      });
    }

    // Persist reason on decline; clear it when approving (or other non-decline).
    const declineReason =
      status === LISTING_STATUS.DECLINED ? reason || null : null;

    const moderatorId = req.adminId || null;
    const allowedSources = allowedSourceStatusesFor(status);
    const currentSaleType = current.rows[0].sale_type || LISTING_SALE_TYPE.NORMAL;

    const updateSql = `UPDATE listings
       SET status = $1,
           decline_reason = $2,
           approved_or_rejected_at = CURRENT_TIMESTAMP,
           moderated_by_admin_id = $3,
           resubmitted_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND status = ANY($5::text[])
       RETURNING *`;
    const updateParams = [status, declineReason, moderatorId, id, allowedSources];

    let listing;
    if (status === LISTING_STATUS.APPROVED && currentSaleType === LISTING_SALE_TYPE.BID) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(updateSql, updateParams);
        if (result.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Listing status changed, please try again' });
        }
        listing = result.rows[0];
        await startAuctionIfBidListing(client, {
          listingId: listing.id,
          saleType: listing.sale_type,
        });
        await client.query('COMMIT');
      } catch (txError) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // ignore rollback errors
        }
        throw txError;
      } finally {
        client.release();
      }
    } else {
      const result = await pool.query(updateSql, updateParams);
      if (result.rows.length === 0) {
        return res.status(409).json({ error: 'Listing status changed, please try again' });
      }
      listing = result.rows[0];
    }
    const decliningApproved =
      status === LISTING_STATUS.DECLINED &&
      currentStatus === LISTING_STATUS.APPROVED;

    try {
      await recordListingModerationEvent(pool, {
        eventType:
          status === LISTING_STATUS.APPROVED ? EVENT_TYPE.APPROVED : EVENT_TYPE.DECLINED,
        listingId: listing.id,
        previousListingId: listing.previous_listing_id || null,
        rootListingId: listing.root_listing_id || listing.id,
        userId: listing.user_id,
        previousStatus: currentStatus,
        newStatus: listing.status,
        price: listing.price,
        declineReason: declineReason,
        moderatedByAdminId: moderatorId,
      });
    } catch (eventError) {
      console.error('Failed to record listing moderation event:', eventError.message);
    }

    if (status === LISTING_STATUS.APPROVED) {
      await notifyListingApproved(pool, {
        userId: listing.user_id,
        listingId: listing.id,
        deviceName: await getListingDeviceName(pool, listing.id),
      });
    } else if (decliningApproved) {
      await notifyListingDeclinedFromApproved(pool, {
        userId: listing.user_id,
        listingId: listing.id,
        reason: reason || undefined,
      });
    } else {
      await notifyListingRejected(pool, {
        userId: listing.user_id,
        listingId: listing.id,
        deviceName: await getListingDeviceName(pool, listing.id),
        reason: reason || undefined,
      });
    }

    // Admin Web audit only (verifyAdminAuth sets req.adminId).
    if (req.adminId) {
      let action;
      if (status === LISTING_STATUS.APPROVED) {
        action = 'listing.approve';
      } else if (decliningApproved) {
        action = 'DECLINE_APPROVED_LISTING';
      } else {
        action = 'listing.decline';
      }

      await writeAuditLog({
        adminId: req.adminId,
        action,
        entityType: 'listing',
        entityId: listing.id,
        metadata: {
          previous_status: currentStatus,
          new_status: listing.status,
          reason: reason || null,
        },
        req,
      });
    }

    res.json({ message, listing });
  } catch (error) {
    console.error(`Error setting listing status to ${status}:`, error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({
      error: `Failed to ${status === LISTING_STATUS.APPROVED ? 'approve' : 'decline'} listing`,
    });
  }
}

module.exports = { moderateListing };
