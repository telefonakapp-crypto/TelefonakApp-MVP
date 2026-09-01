const fs = require('fs');
const path = require('path');

/**
 * Allowed self-serve "Delete Account" reasons (stored as deactivation_reason).
 */
const DEACTIVATION_REASONS = Object.freeze([
  'no_longer_useful',
  'sold_phone',
  'need_a_break',
  'not_using_anymore',
]);

const ADMIN_DEACTIVATION_REASON = 'disabled_by_admin';

const UPLOADS_DIR = path.join(__dirname, '../uploads');

/** Best-effort removal of listing-* files under /uploads. */
function deleteLocalListingImageFile(imageUrl) {
  try {
    if (!imageUrl || typeof imageUrl !== 'string') return;
    let pathname = imageUrl;
    try {
      pathname = new URL(imageUrl).pathname;
    } catch {
      // Relative paths like /uploads/... are fine as-is
    }
    const filename = path.basename(pathname);
    if (!filename.startsWith('listing-')) return;
    const filePath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn('[deactivateUser] Could not delete listing image file:', err.message);
  }
}

/**
 * Permanently remove all marketplace history for a user.
 * Keeps the users row. Soft-deleted / sold / hidden listings are hard-deleted
 * so they cannot reappear after reactivation (e.g. in "Deleted Listings").
 *
 * @param {import('pg').PoolClient} client
 * @param {number} userId
 */
async function purgeUserMarketplaceData(client, userId) {
  // Collect image URLs before rows are removed so we can unlink disk files.
  const images = await client.query(
    `SELECT li.image_url
     FROM listing_images li
     JOIN listings l ON l.id = li.listing_id
     WHERE l.user_id = $1`,
    [userId]
  );
  for (const row of images.rows) {
    deleteLocalListingImageFile(row.image_url);
  }

  // Offers as buyer or seller (also cascade when listings are deleted below).
  await client.query(
    `DELETE FROM offers WHERE buyer_id = $1 OR seller_id = $1`,
    [userId]
  );

  // Favorites owned by the user, and favorites on any of their listings.
  await client.query(
    `DELETE FROM favorites
     WHERE user_id = $1
        OR listing_id IN (SELECT id FROM listings WHERE user_id = $1)`,
    [userId]
  );

  // View cooldown / analytics rows attributed to this user.
  await client.query(`DELETE FROM listing_views WHERE user_id = $1`, [userId]);

  // Customer notification center rows.
  await client.query(`DELETE FROM notifications WHERE user_id = $1`, [userId]);

  // Hard-delete ALL listings for this user (any status: approved, hidden, sold,
  // pending, declined, deleted, …). Cascades listing_images, remaining
  // favorites/offers/views tied to those listing ids.
  await client.query(`DELETE FROM listings WHERE user_id = $1`, [userId]);
}

/**
 * Deactivate a marketplace user and wipe marketplace activity.
 * Keeps the users row (phone identity) for audit / later reactivation.
 *
 * @param {import('pg').Pool} pool
 * @param {{ userId: number, reason: string }} params
 * @returns {Promise<{ ok: true, user: object } | { ok: false, status: number, error: string }>}
 */
async function deactivateUser(pool, { userId, reason }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT id, phone_number, is_active, first_name, last_name
       FROM users WHERE id = $1 FOR UPDATE`,
      [userId]
    );

    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false, status: 404, error: 'User not found' };
    }

    if (existing.rows[0].is_active === false) {
      await client.query('ROLLBACK');
      return { ok: false, status: 409, error: 'Account is already deactivated' };
    }

    const phoneNumber = existing.rows[0].phone_number;

    await purgeUserMarketplaceData(client, userId);

    // Drop outstanding OTP codes for this phone (auth / phone-change).
    await client.query(`DELETE FROM otp_codes WHERE phone_number = $1`, [phoneNumber]);

    const updated = await client.query(
      `UPDATE users
       SET is_active = FALSE,
           deactivated_at = CURRENT_TIMESTAMP,
           deactivation_reason = $2,
           pending_phone_number = NULL,
           pending_phone_expires_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, phone_number, first_name, last_name, is_active,
                 deactivated_at, deactivation_reason, created_at, updated_at`,
      [userId, reason]
    );

    await client.query('COMMIT');
    return { ok: true, user: updated.rows[0] };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Reactivate a previously deactivated user during registration.
 * Re-purges any leftover marketplace rows so reactivation is always a clean slate
 * (covers accounts deactivated before hard-delete was introduced).
 */
async function reactivateUser(client, {
  phoneNumber,
  firstName,
  lastName,
  gender,
  email,
  dateOfBirth,
  city,
}) {
  const locked = await client.query(
    `SELECT id FROM users WHERE phone_number = $1 FOR UPDATE`,
    [phoneNumber]
  );
  if (locked.rows.length === 0) {
    return null;
  }

  const userId = locked.rows[0].id;
  await purgeUserMarketplaceData(client, userId);

  const result = await client.query(
    `UPDATE users
     SET first_name = $1,
         last_name = $2,
         gender = $3,
         email = $4,
         date_of_birth = $5,
         city = $6,
         is_verified = TRUE,
         is_active = TRUE,
         deactivated_at = NULL,
         deactivation_reason = NULL,
         pending_phone_number = NULL,
         pending_phone_expires_at = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $7
     RETURNING *`,
    [firstName, lastName, gender, email, dateOfBirth, city, userId]
  );
  return result.rows[0] || null;
}

module.exports = {
  DEACTIVATION_REASONS,
  ADMIN_DEACTIVATION_REASON,
  deactivateUser,
  reactivateUser,
  purgeUserMarketplaceData,
};
