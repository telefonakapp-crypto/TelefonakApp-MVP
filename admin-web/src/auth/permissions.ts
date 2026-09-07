import type { AdminRole } from '../types/auth';

/**
 * Keep in sync with backend/utils/adminAuth.js.
 * UI visibility only — the API is the authorization authority.
 */
export const PERMISSIONS = {
  LISTINGS_MODERATE: 'listings.moderate',
  USERS_WRITE: 'users.write',
  BANNERS_WRITE: 'banners.write',
  SETTINGS_WRITE: 'settings.write',
  ADMINS_MANAGE: 'admins.manage',
  UPLOAD_WRITE: 'upload.write',
} as const;

export type AdminPermission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  super_admin: [
    PERMISSIONS.LISTINGS_MODERATE,
    PERMISSIONS.USERS_WRITE,
    PERMISSIONS.BANNERS_WRITE,
    PERMISSIONS.SETTINGS_WRITE,
    PERMISSIONS.ADMINS_MANAGE,
    PERMISSIONS.UPLOAD_WRITE,
  ],
  moderator: [PERMISSIONS.LISTINGS_MODERATE, PERMISSIONS.USERS_WRITE],
  marketing: [PERMISSIONS.BANNERS_WRITE, PERMISSIONS.UPLOAD_WRITE],
  support: [],
  viewer: [],
};

export function getPermissionsForRole(role: string | null | undefined): AdminPermission[] {
  if (!role || !(role in ROLE_PERMISSIONS)) return [];
  return [...ROLE_PERMISSIONS[role as AdminRole]];
}

export function roleHasPermission(
  role: string | null | undefined,
  permission: string
): boolean {
  return getPermissionsForRole(role).includes(permission as AdminPermission);
}
