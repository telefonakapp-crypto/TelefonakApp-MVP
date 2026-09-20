'use strict';

/**
 * Explicit customer-facing users columns.
 *
 * Used instead of SELECT * / RETURNING * so a future sensitive column on
 * `users` is not loaded or returned unless a specific query asks for it.
 *
 * Intentionally omitted: pending_phone_number, pending_phone_expires_at,
 * deactivation_reason, deactivated_at, push_notifications_enabled.
 * Those are loaded only by the trusted paths that need them.
 */
const CUSTOMER_USER_COLUMNS = [
  'id',
  'phone_number',
  'first_name',
  'last_name',
  'gender',
  'email',
  'date_of_birth',
  'city',
  'is_verified',
  'is_active',
  'created_at',
  'updated_at',
];

const CUSTOMER_USER_COLUMNS_SQL = CUSTOMER_USER_COLUMNS.join(', ');

module.exports = {
  CUSTOMER_USER_COLUMNS,
  CUSTOMER_USER_COLUMNS_SQL,
};
