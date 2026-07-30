/**
 * Admin role values stored on admins.role.
 * Super-admin-only management lives in routes/adminAdmins.js.
 */
const ADMIN_ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  MODERATOR: 'moderator',
  MARKETING: 'marketing',
  SUPPORT: 'support',
  VIEWER: 'viewer',
});

const ADMIN_ROLE_VALUES = Object.freeze(Object.values(ADMIN_ROLES));

const DEFAULT_ADMIN_ROLE = ADMIN_ROLES.VIEWER;

/** Public admin shape — never includes password_hash. */
function toPublicAdmin(row) {
  if (!row) return null;
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    role: row.role,
    is_active: row.is_active,
    last_login: row.last_login,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    updated_by: row.updated_by,
  };
}

module.exports = {
  ADMIN_ROLES,
  ADMIN_ROLE_VALUES,
  DEFAULT_ADMIN_ROLE,
  toPublicAdmin,
};
