/**
 * Admin role values stored on admins.role.
 * Super-admin-only management lives in routes/adminAdmins.js.
 *
 * Authorization uses the database role loaded by verifyAdminAuth, never the
 * client-supplied JWT `role` claim. Unknown / missing / invalid roles grant
 * no permissions (fail-closed).
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

/**
 * Privileged write permissions. Authenticated admins with a known role may
 * still read dashboard/listings/users/reports/etc.; these keys gate mutations.
 */
const PERMISSIONS = Object.freeze({
  LISTINGS_MODERATE: 'listings.moderate',
  USERS_WRITE: 'users.write',
  BANNERS_WRITE: 'banners.write',
  SETTINGS_WRITE: 'settings.write',
  ADMINS_MANAGE: 'admins.manage',
  UPLOAD_WRITE: 'upload.write',
});

const ROLE_PERMISSIONS = Object.freeze({
  [ADMIN_ROLES.SUPER_ADMIN]: Object.freeze([
    PERMISSIONS.LISTINGS_MODERATE,
    PERMISSIONS.USERS_WRITE,
    PERMISSIONS.BANNERS_WRITE,
    PERMISSIONS.SETTINGS_WRITE,
    PERMISSIONS.ADMINS_MANAGE,
    PERMISSIONS.UPLOAD_WRITE,
  ]),
  [ADMIN_ROLES.MODERATOR]: Object.freeze([
    PERMISSIONS.LISTINGS_MODERATE,
    PERMISSIONS.USERS_WRITE,
  ]),
  [ADMIN_ROLES.MARKETING]: Object.freeze([
    PERMISSIONS.BANNERS_WRITE,
    PERMISSIONS.UPLOAD_WRITE,
  ]),
  [ADMIN_ROLES.SUPPORT]: Object.freeze([]),
  [ADMIN_ROLES.VIEWER]: Object.freeze([]),
});

function isKnownAdminRole(role) {
  return typeof role === 'string' && ADMIN_ROLE_VALUES.includes(role);
}

function getPermissionsForRole(role) {
  if (!isKnownAdminRole(role)) return [];
  return [...ROLE_PERMISSIONS[role]];
}

function hasPermission(role, permission) {
  if (!permission || !isKnownAdminRole(role)) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

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

/** Session admin including server-computed permissions (login /me). */
function toSessionAdmin(row) {
  const admin = toPublicAdmin(row);
  if (!admin) return null;
  return {
    ...admin,
    permissions: getPermissionsForRole(admin.role),
  };
}

module.exports = {
  ADMIN_ROLES,
  ADMIN_ROLE_VALUES,
  DEFAULT_ADMIN_ROLE,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  isKnownAdminRole,
  getPermissionsForRole,
  hasPermission,
  toPublicAdmin,
  toSessionAdmin,
};
