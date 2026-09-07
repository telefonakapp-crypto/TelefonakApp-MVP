'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  api,
  pool,
  customerToken,
  adminToken,
  tinyJpegBuffer,
  loadFixtures,
  deleteListingsByIds,
} = require('../lib/harness');
const {
  ADMIN_ROLES,
  PERMISSIONS,
  hasPermission,
  getPermissionsForRole,
  isKnownAdminRole,
} = require('../../utils/adminAuth');

function tokenFor(admin, roleOverride) {
  return adminToken({
    adminId: admin.id,
    email: admin.email,
    role: roleOverride || admin.role,
  });
}

describe('07 — Admin RBAC', () => {
  describe('permission helper (fail-closed)', () => {
    it('unknown / missing / invalid roles have no permissions', () => {
      assert.equal(isKnownAdminRole(undefined), false);
      assert.equal(isKnownAdminRole(null), false);
      assert.equal(isKnownAdminRole(''), false);
      assert.equal(isKnownAdminRole('admin'), false);
      assert.deepEqual(getPermissionsForRole(undefined), []);
      assert.deepEqual(getPermissionsForRole('not-a-role'), []);
      assert.equal(hasPermission(undefined, PERMISSIONS.LISTINGS_MODERATE), false);
      assert.equal(hasPermission('', PERMISSIONS.LISTINGS_MODERATE), false);
      assert.equal(hasPermission('not-a-role', PERMISSIONS.LISTINGS_MODERATE), false);
      assert.equal(hasPermission(ADMIN_ROLES.VIEWER, undefined), false);
    });

    it('viewer cannot perform privileged writes', () => {
      assert.equal(hasPermission(ADMIN_ROLES.VIEWER, PERMISSIONS.LISTINGS_MODERATE), false);
      assert.equal(hasPermission(ADMIN_ROLES.VIEWER, PERMISSIONS.USERS_WRITE), false);
      assert.equal(hasPermission(ADMIN_ROLES.VIEWER, PERMISSIONS.BANNERS_WRITE), false);
      assert.equal(hasPermission(ADMIN_ROLES.VIEWER, PERMISSIONS.SETTINGS_WRITE), false);
      assert.equal(hasPermission(ADMIN_ROLES.VIEWER, PERMISSIONS.ADMINS_MANAGE), false);
      assert.equal(hasPermission(ADMIN_ROLES.VIEWER, PERMISSIONS.UPLOAD_WRITE), false);
    });

    it('moderator can moderate listings and users, not banners/settings/admins', () => {
      assert.equal(hasPermission(ADMIN_ROLES.MODERATOR, PERMISSIONS.LISTINGS_MODERATE), true);
      assert.equal(hasPermission(ADMIN_ROLES.MODERATOR, PERMISSIONS.USERS_WRITE), true);
      assert.equal(hasPermission(ADMIN_ROLES.MODERATOR, PERMISSIONS.BANNERS_WRITE), false);
      assert.equal(hasPermission(ADMIN_ROLES.MODERATOR, PERMISSIONS.SETTINGS_WRITE), false);
      assert.equal(hasPermission(ADMIN_ROLES.MODERATOR, PERMISSIONS.ADMINS_MANAGE), false);
    });

    it('marketing can write banners, not moderate listings or users', () => {
      assert.equal(hasPermission(ADMIN_ROLES.MARKETING, PERMISSIONS.BANNERS_WRITE), true);
      assert.equal(hasPermission(ADMIN_ROLES.MARKETING, PERMISSIONS.UPLOAD_WRITE), true);
      assert.equal(hasPermission(ADMIN_ROLES.MARKETING, PERMISSIONS.LISTINGS_MODERATE), false);
      assert.equal(hasPermission(ADMIN_ROLES.MARKETING, PERMISSIONS.USERS_WRITE), false);
    });

    it('support has no write permissions', () => {
      assert.equal(hasPermission(ADMIN_ROLES.SUPPORT, PERMISSIONS.LISTINGS_MODERATE), false);
      assert.equal(hasPermission(ADMIN_ROLES.SUPPORT, PERMISSIONS.USERS_WRITE), false);
      assert.equal(hasPermission(ADMIN_ROLES.SUPPORT, PERMISSIONS.BANNERS_WRITE), false);
    });

    it('super_admin has every privileged permission', () => {
      for (const permission of Object.values(PERMISSIONS)) {
        assert.equal(hasPermission(ADMIN_ROLES.SUPER_ADMIN, permission), true);
      }
    });
  });

  describe('API authorization', () => {
    let fx;
    let viewer;
    let moderator;
    let marketing;
    let support;
    let superAdmin;
    let createdAdminIds = [];
    let createdListingIds = [];
    let createdBannerIds = [];

    async function insertAdmin(role, { isActive = true } = {}) {
      const email = `rbac-${role}-${Date.now()}-${Math.random().toString(16).slice(2)}@telefonak.test`;
      const result = await pool.query(
        `INSERT INTO admins (full_name, email, password_hash, role, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, role, full_name, is_active`,
        [`RBAC ${role}`, email, 'not-a-login-hash', role, isActive]
      );
      createdAdminIds.push(result.rows[0].id);
      return result.rows[0];
    }

    async function insertPendingListing() {
      assert.ok(fx.catalog && fx.owner, 'Need catalog and owner fixtures');
      const ids = await pool.query(
        `SELECT
           ms.model_id,
           ms.id AS model_storage_id,
           mc.id AS model_color_id,
           mc.color_id,
           m.category_id
         FROM model_storages ms
         JOIN model_colors mc ON mc.id = $2 AND mc.model_id = ms.model_id
         JOIN models m ON m.id = ms.model_id
         WHERE ms.id = $1`,
        [fx.catalog.model_storage_id, fx.catalog.model_color_id]
      );
      assert.equal(ids.rows.length, 1, 'catalog junction rows must exist');
      const row = ids.rows[0];
      const inserted = await pool.query(
        `INSERT INTO listings (
           user_id, model_id, storage_id, color_id,
           model_storage_id, model_color_id,
           sim_configuration_id, condition_id, price, status, category_id
         ) VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, 50, 'pending', $8)
         RETURNING id`,
        [
          fx.owner.id,
          row.model_id,
          row.color_id,
          row.model_storage_id,
          row.model_color_id,
          fx.catalog.sim_configuration_id,
          fx.catalog.condition_id,
          row.category_id,
        ]
      );
      createdListingIds.push(inserted.rows[0].id);
      return inserted.rows[0].id;
    }

    before(async () => {
      fx = await loadFixtures();
      viewer = await insertAdmin(ADMIN_ROLES.VIEWER);
      moderator = await insertAdmin(ADMIN_ROLES.MODERATOR);
      marketing = await insertAdmin(ADMIN_ROLES.MARKETING);
      support = await insertAdmin(ADMIN_ROLES.SUPPORT);
      superAdmin = await insertAdmin(ADMIN_ROLES.SUPER_ADMIN);
    });

    after(async () => {
      await deleteListingsByIds(createdListingIds);
      if (createdBannerIds.length > 0) {
        await pool.query('DELETE FROM banners WHERE id = ANY($1::int[])', [createdBannerIds]);
      }
      if (createdAdminIds.length > 0) {
        await pool.query('DELETE FROM admins WHERE id = ANY($1::int[])', [createdAdminIds]);
      }
    });

    it('unauthenticated user → protected admin endpoint → 401', async () => {
      const res = await api('GET', '/admin/dashboard');
      assert.equal(res.status, 401);
    });

    it('customer JWT on admin endpoint → 401 (invalid admin authentication)', async () => {
      if (!fx.owner) return;
      const token = customerToken(fx.owner.id, fx.owner.phone_number);
      const res = await api('POST', `/admin/listings/${fx.listing?.id || 1}/approve`, {
        token,
      });
      assert.equal(res.status, 401);
    });

    it('customer cannot access admin moderation history', async () => {
      if (!fx.owner) return;
      const token = customerToken(fx.owner.id, fx.owner.phone_number);
      const res = await api('GET', '/admin/moderation-history?type=resubmitted', { token });
      assert.equal(res.status, 401);
    });

    it('customer cannot access admin audit logs', async () => {
      if (!fx.owner) return;
      const token = customerToken(fx.owner.id, fx.owner.phone_number);
      const res = await api('GET', '/admin/audit-logs', { token });
      assert.equal(res.status, 401);
    });

    it('viewer → allowed read endpoint → success', async () => {
      const token = tokenFor(viewer);
      const dash = await api('GET', '/admin/dashboard', { token });
      assert.equal(dash.status, 200);
      const listings = await api('GET', '/admin/listings?status=all&limit=5', { token });
      assert.equal(listings.status, 200);
      const me = await api('GET', '/admin/auth/me', { token });
      assert.equal(me.status, 200);
      assert.equal(me.data.admin.role, 'viewer');
      assert.deepEqual(me.data.admin.permissions, []);
    });

    it('viewer → listing approve → 403', async () => {
      const listingId = fx.listing?.id || 1;
      const res = await api('POST', `/admin/listings/${listingId}/approve`, {
        token: tokenFor(viewer),
      });
      assert.equal(res.status, 403);
    });

    it('viewer → listing decline → 403', async () => {
      const listingId = fx.listing?.id || 1;
      const res = await api('POST', `/admin/listings/${listingId}/decline`, {
        token: tokenFor(viewer),
        body: { reason: 'bypass attempt' },
      });
      assert.equal(res.status, 403);
    });

    it('viewer → delete listing → 403', async () => {
      const listingId = fx.listing?.id || 1;
      const res = await api('POST', `/admin/listings/${listingId}/delete`, {
        token: tokenFor(viewer),
      });
      assert.equal(res.status, 403);
    });

    it('viewer → suspend/enable user → 403', async () => {
      if (!fx.owner) return;
      const res = await api('PUT', `/admin/users/${fx.owner.id}/status`, {
        token: tokenFor(viewer),
        body: { is_active: false },
      });
      assert.equal(res.status, 403);
    });

    it('viewer → change admin role → 403', async () => {
      const res = await api('PUT', `/admin/admins/${moderator.id}`, {
        token: tokenFor(viewer),
        body: {
          full_name: moderator.full_name,
          email: moderator.email,
          role: 'super_admin',
          is_active: true,
        },
      });
      assert.equal(res.status, 403);
    });

    it('viewer JWT claiming super_admin still uses the database role → 403', async () => {
      const listingId = fx.listing?.id || 1;
      const res = await api('POST', `/admin/listings/${listingId}/approve`, {
        token: tokenFor(viewer, 'super_admin'),
      });
      assert.equal(res.status, 403);
    });

    it('support → listing moderation → 403', async () => {
      const listingId = fx.listing?.id || 1;
      const res = await api('POST', `/admin/listings/${listingId}/approve`, {
        token: tokenFor(support),
      });
      assert.equal(res.status, 403);
    });

    it('marketing → listing moderation → 403', async () => {
      const listingId = fx.listing?.id || 1;
      const res = await api('POST', `/admin/listings/${listingId}/approve`, {
        token: tokenFor(marketing),
      });
      assert.equal(res.status, 403);
    });

    it('marketing may hit banner write validation (not 403)', async () => {
      const res = await api('POST', '/admin/banners', {
        token: tokenFor(marketing),
        body: {},
      });
      assert.equal(res.status, 400);
    });

    it('viewer → create banner → 403', async () => {
      const res = await api('POST', '/admin/banners', {
        token: tokenFor(viewer),
        body: { title: 'x', image_url: 'https://example.com/x.jpg' },
      });
      assert.equal(res.status, 403);
    });

    it('viewer → update settings → 403', async () => {
      const res = await api('PUT', '/admin/settings', {
        token: tokenFor(viewer),
        body: { settings: { marketplace_name: 'Hacked' } },
      });
      assert.equal(res.status, 403);
    });

    it('moderator → permitted listing approve → success', async () => {
      const listingId = await insertPendingListing();
      const res = await api('POST', `/admin/listings/${listingId}/approve`, {
        token: tokenFor(moderator),
      });
      assert.equal(res.status, 200);
      const row = await pool.query('SELECT status FROM listings WHERE id = $1', [listingId]);
      assert.equal(row.rows[0].status, 'approved');
    });

    it('moderator → permitted user status update → success', async () => {
      if (!fx.owner) return;
      const current = await pool.query('SELECT is_active FROM users WHERE id = $1', [
        fx.owner.id,
      ]);
      const res = await api('PUT', `/admin/users/${fx.owner.id}/status`, {
        token: tokenFor(moderator),
        body: { is_active: current.rows[0].is_active !== false },
      });
      assert.equal(res.status, 200);
    });

    it('super_admin can change a role and the new role is enforced immediately', async () => {
      const target = await insertAdmin(ADMIN_ROLES.MODERATOR);
      const listingId = await insertPendingListing();

      const before = await api('POST', `/admin/listings/${listingId}/approve`, {
        token: tokenFor(target),
      });
      assert.equal(before.status, 200);

      const listingId2 = await insertPendingListing();
      const demote = await api('PUT', `/admin/admins/${target.id}`, {
        token: tokenFor(superAdmin),
        body: {
          full_name: target.full_name,
          email: target.email,
          role: 'viewer',
          is_active: true,
        },
      });
      assert.equal(demote.status, 200);
      assert.equal(demote.data.admin.role, 'viewer');

      const after = await api('POST', `/admin/listings/${listingId2}/approve`, {
        token: tokenFor(target),
      });
      assert.equal(after.status, 403);
    });

    it('viewer promoted to moderator gains listing moderation on the next request', async () => {
      const target = await insertAdmin(ADMIN_ROLES.VIEWER);
      const listingId = await insertPendingListing();
      const before = await api('POST', `/admin/listings/${listingId}/approve`, {
        token: tokenFor(target),
      });
      assert.equal(before.status, 403);

      const promote = await api('PUT', `/admin/admins/${target.id}`, {
        token: tokenFor(superAdmin),
        body: {
          full_name: target.full_name,
          email: target.email,
          role: 'moderator',
          is_active: true,
        },
      });
      assert.equal(promote.status, 200);
      assert.equal(promote.data.admin.role, 'moderator');

      const after = await api('POST', `/admin/listings/${listingId}/approve`, {
        token: tokenFor(target),
      });
      assert.equal(after.status, 200);
    });

    it('JWT role=viewer cannot downgrade a database super_admin', async () => {
      const listingId = await insertPendingListing();
      const res = await api('POST', `/admin/listings/${listingId}/approve`, {
        token: tokenFor(superAdmin, 'viewer'),
      });
      assert.equal(res.status, 200);
    });

    it('inactive moderator cannot access admin APIs', async () => {
      const inactive = await insertAdmin(ADMIN_ROLES.MODERATOR, { isActive: false });
      const dash = await api('GET', '/admin/dashboard', { token: tokenFor(inactive) });
      assert.equal(dash.status, 403);
      const listingId = fx.listing?.id || 1;
      const approve = await api('POST', `/admin/listings/${listingId}/approve`, {
        token: tokenFor(inactive),
      });
      assert.equal(approve.status, 403);
    });

    it('inactive super_admin cannot retain privileged access', async () => {
      const inactive = await insertAdmin(ADMIN_ROLES.SUPER_ADMIN, { isActive: false });
      const dash = await api('GET', '/admin/dashboard', { token: tokenFor(inactive) });
      assert.equal(dash.status, 403);
      const listingId = fx.listing?.id || 1;
      const approve = await api('POST', `/admin/listings/${listingId}/approve`, {
        token: tokenFor(inactive),
      });
      assert.equal(approve.status, 403);
      const settings = await api('PUT', '/admin/settings', {
        token: tokenFor(inactive),
        body: { settings: { marketplace_name: 'Hacked' } },
      });
      assert.equal(settings.status, 403);
    });

    it('viewer → upload image → 403', async () => {
      const form = new FormData();
      form.append(
        'image',
        new Blob([tinyJpegBuffer()], { type: 'image/jpeg' }),
        'rbac.jpg'
      );
      const res = await api('POST', '/admin/upload/image', {
        token: tokenFor(viewer),
        formData: form,
      });
      assert.equal(res.status, 403);
    });

    it('moderator → banner mutation → 403', async () => {
      const create = await api('POST', '/admin/banners', {
        token: tokenFor(moderator),
        body: { title: 'RBAC moderator banner', image_url: 'https://example.com/x.jpg' },
      });
      assert.equal(create.status, 403);
    });

    it('marketing → banner create → 201 and viewer cannot update/delete it', async () => {
      const created = await api('POST', '/admin/banners', {
        token: tokenFor(marketing),
        body: {
          title: `RBAC marketing banner ${Date.now()}`,
          image_url: 'https://example.com/rbac-banner.jpg',
        },
      });
      assert.equal(created.status, 201);
      const bannerId = created.data?.banner?.id;
      assert.ok(bannerId);
      createdBannerIds.push(bannerId);

      const viewerPut = await api('PUT', `/admin/banners/${bannerId}`, {
        token: tokenFor(viewer),
        body: { title: 'Hacked' },
      });
      assert.equal(viewerPut.status, 403);

      const viewerDelete = await api('DELETE', `/admin/banners/${bannerId}`, {
        token: tokenFor(viewer),
      });
      assert.equal(viewerDelete.status, 403);

      const marketingDelete = await api('DELETE', `/admin/banners/${bannerId}`, {
        token: tokenFor(marketing),
      });
      assert.equal(marketingDelete.status, 200);
    });

    it('support cannot mutate users, banners, settings, or admins', async () => {
      const listingId = fx.listing?.id || 1;
      const approve = await api('POST', `/admin/listings/${listingId}/approve`, {
        token: tokenFor(support),
      });
      assert.equal(approve.status, 403);

      if (fx.owner) {
        const userStatus = await api('PUT', `/admin/users/${fx.owner.id}/status`, {
          token: tokenFor(support),
          body: { is_active: true },
        });
        assert.equal(userStatus.status, 403);
      }

      const banner = await api('POST', '/admin/banners', {
        token: tokenFor(support),
        body: { title: 'x', image_url: 'https://example.com/x.jpg' },
      });
      assert.equal(banner.status, 403);

      const settings = await api('PUT', '/admin/settings', {
        token: tokenFor(support),
        body: { settings: { marketplace_name: 'Hacked' } },
      });
      assert.equal(settings.status, 403);

      const admins = await api('POST', '/admin/admins', {
        token: tokenFor(support),
        body: {
          full_name: 'Hacker',
          email: `rbac-support-create-${Date.now()}@telefonak.test`,
          password: 'password1',
          role: 'super_admin',
        },
      });
      assert.equal(admins.status, 403);
    });

    it('viewer cannot create, reset, or delete admin accounts', async () => {
      const create = await api('POST', '/admin/admins', {
        token: tokenFor(viewer),
        body: {
          full_name: 'Hacker',
          email: `rbac-viewer-create-${Date.now()}@telefonak.test`,
          password: 'password1',
          role: 'super_admin',
        },
      });
      assert.equal(create.status, 403);

      const reset = await api('POST', `/admin/admins/${moderator.id}/reset-password`, {
        token: tokenFor(viewer),
        body: { password: 'password1' },
      });
      assert.equal(reset.status, 403);

      const remove = await api('DELETE', `/admin/admins/${moderator.id}`, {
        token: tokenFor(viewer),
      });
      assert.equal(remove.status, 403);
    });

    it('super_admin cannot assign a role outside the allowed enum', async () => {
      const res = await api('POST', '/admin/admins', {
        token: tokenFor(superAdmin),
        body: {
          full_name: 'Invalid Role',
          email: `rbac-invalid-role-${Date.now()}@telefonak.test`,
          password: 'password1',
          role: 'god',
        },
      });
      assert.equal(res.status, 400);
    });

    it('super_admin can update settings with a no-op write', async () => {
      const current = await api('GET', '/admin/settings', { token: tokenFor(superAdmin) });
      assert.equal(current.status, 200);
      const name = current.data?.settings?.marketplace_name;
      assert.ok(typeof name === 'string');
      const res = await api('PUT', '/admin/settings', {
        token: tokenFor(superAdmin),
        body: { settings: { marketplace_name: name } },
      });
      assert.equal(res.status, 200);
    });

    it('marketing → listing moderation remains 403 after a successful banner write path', async () => {
      const listingId = fx.listing?.id || 1;
      const res = await api('POST', `/admin/listings/${listingId}/delete`, {
        token: tokenFor(marketing),
      });
      assert.equal(res.status, 403);
    });
  });
});
