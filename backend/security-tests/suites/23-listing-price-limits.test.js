'use strict';

/**
 * Listing price must respect live Admin Settings (min_listing_price / max_listing_price).
 */
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
const { ADMIN_ROLES } = require('../../utils/adminAuth');

async function uploadOne(token) {
  const form = new FormData();
  form.append(
    'images',
    new Blob([tinyJpegBuffer()], { type: 'image/jpeg' }),
    'price-limit.jpg'
  );
  const res = await api('POST', '/upload/listing-images', { token, formData: form });
  assert.equal(res.status, 200, `upload failed ${res.status}`);
  return res.data.image_urls[0];
}

describe('23 — Listing price limits', () => {
  let fx;
  let ownerToken;
  let superToken;
  let ownedImageUrl;
  let phonesCategoryId;
  let originalMin;
  let originalMax;
  let existingOverLimitSnapshot = [];
  const createdListingIds = [];
  const createdAdminIds = [];

  function track(res) {
    const id = res.data?.listing?.id;
    if (id) createdListingIds.push(id);
    return res;
  }

  function phonePayload(overrides = {}) {
    return {
      model_id: fx.catalog.model_id,
      model_storage_id: fx.catalog.model_storage_id,
      model_color_id: fx.catalog.model_color_id,
      sim_configuration_id: fx.catalog.sim_configuration_id,
      condition_id: fx.catalog.condition_id,
      price: 250,
      description: 'Price-limit regression listing',
      images: [ownedImageUrl],
      ...overrides,
    };
  }

  async function createWithPrice(price) {
    return track(
      await api('POST', '/listings', {
        token: ownerToken,
        body: phonePayload({ price }),
      })
    );
  }

  async function setLimits(min, max) {
    const res = await api('PUT', '/admin/settings', {
      token: superToken,
      body: {
        settings: {
          min_listing_price: min,
          max_listing_price: max,
        },
      },
    });
    assert.equal(res.status, 200, `settings update failed ${res.status} ${JSON.stringify(res.data)}`);
  }

  before(async () => {
    fx = await loadFixtures();
    assert.ok(fx.catalog && fx.owner, 'Need catalog and owner fixtures');
    ownerToken = customerToken(fx.owner.id, fx.owner.phone_number);

    const admin = await pool.query(
      `INSERT INTO admins (full_name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id, email, role`,
      [
        'Price limit test super',
        `price-limit-${Date.now()}@telefonak.test`,
        'not-a-login-hash',
        ADMIN_ROLES.SUPER_ADMIN,
      ]
    );
    createdAdminIds.push(admin.rows[0].id);
    superToken = adminToken({
      adminId: admin.rows[0].id,
      email: admin.rows[0].email,
      role: admin.rows[0].role,
    });

    const current = await pool.query(
      `SELECT key, value FROM settings WHERE key IN ('min_listing_price', 'max_listing_price')`
    );
    originalMin = current.rows.find((row) => row.key === 'min_listing_price')?.value || '1';
    originalMax = current.rows.find((row) => row.key === 'max_listing_price')?.value || '5000';

    const over = await pool.query(
      `SELECT id, price::text AS price
       FROM listings
       WHERE price > $1
       ORDER BY id`,
      [Number(originalMax)]
    );
    existingOverLimitSnapshot = over.rows;

    ownedImageUrl = await uploadOne(ownerToken);
    const cats = await pool.query(
      `SELECT id FROM categories WHERE slug = 'phones' LIMIT 1`
    );
    phonesCategoryId = cats.rows[0]?.id || null;

    await setLimits(1, 5000);
  });

  after(async () => {
    await deleteListingsByIds(createdListingIds);
    await pool.query(
      `UPDATE settings SET value = $1 WHERE key = 'min_listing_price'`,
      [String(originalMin)]
    );
    await pool.query(
      `UPDATE settings SET value = $1 WHERE key = 'max_listing_price'`,
      [String(originalMax)]
    );
    if (createdAdminIds.length > 0) {
      await pool.query('DELETE FROM admins WHERE id = ANY($1::int[])', [createdAdminIds]);
    }
  });

  it('price exactly at max 5000 → success', async () => {
    const res = await createWithPrice(5000);
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal(Number(res.data.listing.price), 5000);
  });

  it('price 5000.00 → success', async () => {
    const res = await createWithPrice(5000.0);
    assert.equal(res.status, 200, JSON.stringify(res.data));
  });

  it('price 5000.01 → rejected', async () => {
    const res = await createWithPrice(5000.01);
    assert.equal(res.status, 400);
    assert.match(String(res.data?.error || ''), /cannot exceed/i);
  });

  it('price 5001 → rejected', async () => {
    const res = await createWithPrice(5001);
    assert.equal(res.status, 400);
  });

  it('very high price 9876 → rejected', async () => {
    const res = await createWithPrice(9876);
    assert.equal(res.status, 400);
    assert.match(String(res.data?.error || ''), /5,000/);
  });

  it('zero price → rejected', async () => {
    const res = await createWithPrice(0);
    assert.equal(res.status, 400);
  });

  it('negative price → rejected', async () => {
    const res = await createWithPrice(-1);
    assert.equal(res.status, 400);
  });

  it('missing price → rejected', async () => {
    const body = phonePayload();
    delete body.price;
    const res = await api('POST', '/listings', { token: ownerToken, body });
    assert.equal(res.status, 400);
  });

  it('null price → rejected', async () => {
    const res = await createWithPrice(null);
    assert.equal(res.status, 400);
  });

  it('NaN / Infinity → rejected', async () => {
    const nan = await createWithPrice(Number.NaN);
    assert.equal(nan.status, 400);
    const inf = await createWithPrice(Number.POSITIVE_INFINITY);
    assert.equal(inf.status, 400);
  });

  it('string "5001" cannot bypass the max', async () => {
    const res = await createWithPrice('5001');
    assert.equal(res.status, 400);
  });

  it('string "5000" at max is accepted', async () => {
    const res = await createWithPrice('5000');
    assert.equal(res.status, 200, JSON.stringify(res.data));
  });

  it('custom listing path also enforces the max', async () => {
    if (!phonesCategoryId) return;
    const res = track(
      await api('POST', '/listings', {
        token: ownerToken,
        body: {
          listing_source: 'custom',
          category_id: phonesCategoryId,
          custom_brand_name: 'PriceLimitBrand',
          custom_model_name: 'PriceLimitPhone',
          custom_storage: '128 GB',
          custom_color_name: 'Black',
          custom_sim_configuration: 'Dual SIM',
          condition_id: fx.catalog.condition_id,
          price: 9876,
          description: 'Custom over-limit',
          images: [ownedImageUrl],
        },
      })
    );
    assert.equal(res.status, 400);
  });

  it('listing price update cannot exceed the configured maximum', async () => {
    const created = await createWithPrice(4000);
    assert.equal(created.status, 200, JSON.stringify(created.data));
    const listingId = created.data.listing.id;
    const over = await api('PUT', `/listings/${listingId}`, {
      token: ownerToken,
      body: phonePayload({ price: 6000 }),
    });
    assert.equal(over.status, 400);
    const ok = await api('PUT', `/listings/${listingId}`, {
      token: ownerToken,
      body: phonePayload({ price: 4500 }),
    });
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
    assert.equal(Number(ok.data.listing.price), 4500);
  });

  it('changing admin max to 7500 is applied immediately', async () => {
    await setLimits(1, 7500);
    const ok = await createWithPrice(7500);
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
    const over = await createWithPrice(7500.01);
    assert.equal(over.status, 400);
  });

  it('changing admin max to 1000 is applied immediately', async () => {
    await setLimits(1, 1000);
    const ok = await createWithPrice(1000);
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
    const over = await createWithPrice(1000.01);
    assert.equal(over.status, 400);
  });

  it('admin cannot set a non-positive maximum listing price', async () => {
    const zero = await api('PUT', '/admin/settings', {
      token: superToken,
      body: { settings: { max_listing_price: 0 } },
    });
    assert.equal(zero.status, 400);
    const neg = await api('PUT', '/admin/settings', {
      token: superToken,
      body: { settings: { max_listing_price: -5 } },
    });
    assert.equal(neg.status, 400);
  });

  it('does not automatically mutate existing over-limit listings', async () => {
    await setLimits(1, 5000);
    const ids = existingOverLimitSnapshot.map((row) => row.id);
    if (ids.length === 0) {
      assert.equal(existingOverLimitSnapshot.length, 0);
      return;
    }
    const after = await pool.query(
      `SELECT id, price::text AS price FROM listings WHERE id = ANY($1::int[]) ORDER BY id`,
      [ids]
    );
    assert.deepEqual(after.rows, existingOverLimitSnapshot);
  });
});
