'use strict';

/**
 * SEC-002 — Listing image references must be owned Telefonak uploads.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  api,
  customerToken,
  tinyJpegBuffer,
  loadFixtures,
  deleteListingsByIds,
} = require('../lib/harness');

async function uploadOne(token) {
  const form = new FormData();
  form.append(
    'images',
    new Blob([tinyJpegBuffer()], { type: 'image/jpeg' }),
    'owned.jpg'
  );
  const res = await api('POST', '/upload/listing-images', { token, formData: form });
  assert.equal(res.status, 200, 'upload fixture should succeed');
  assert.ok(res.data?.image_urls?.[0]);
  return res.data.image_urls[0];
}

function listingPayload(fx, imageUrls) {
  assert.ok(fx.catalog, 'Need catalog fixture for listing create');
  return {
    model_id: fx.catalog.model_id,
    model_storage_id: fx.catalog.model_storage_id,
    model_color_id: fx.catalog.model_color_id,
    sim_configuration_id: fx.catalog.sim_configuration_id,
    condition_id: fx.catalog.condition_id,
    price: 199,
    description: 'SEC-002 security test listing',
    images: imageUrls,
  };
}

describe('11 — Listing image references (SEC-002)', () => {
  let fx;
  let ownerToken;
  let strangerToken;
  const createdListingIds = [];

  function trackListing(res) {
    const id = res.data?.listing?.id;
    if (id) createdListingIds.push(id);
    return res;
  }

  before(async () => {
    fx = await loadFixtures();
    ownerToken = customerToken(fx.owner.id, fx.owner.phone_number);
    strangerToken = customerToken(fx.stranger.id, fx.stranger.phone_number);
  });

  after(async () => {
    await deleteListingsByIds(createdListingIds);
  });

  it('owner can create listing with own uploaded image', async () => {
    const url = await uploadOne(ownerToken);
    const res = trackListing(await api('POST', '/listings', {
      token: ownerToken,
      body: listingPayload(fx, [url]),
    }));
    assert.ok([200, 201].includes(res.status), `unexpected status ${res.status}`);
    assert.ok(res.data?.listing?.id);
  });

  it('rejects external image URL on create', async () => {
    const res = await api('POST', '/listings', {
      token: ownerToken,
      body: listingPayload(fx, ['https://example.com/image.jpg']),
    });
    assert.equal(res.status, 400);
  });

  it('rejects fabricated internal /uploads path', async () => {
    const res = await api('POST', '/listings', {
      token: ownerToken,
      body: listingPayload(fx, [
        'http://127.0.0.1:3000/uploads/listing-9999999999999-999999999.jpg',
      ]),
    });
    assert.equal(res.status, 400);
  });

  it('rejects path-traversal image reference', async () => {
    const res = await api('POST', '/listings', {
      token: ownerToken,
      body: listingPayload(fx, [
        'http://127.0.0.1:3000/uploads/../../etc/passwd.jpg',
      ]),
    });
    assert.equal(res.status, 400);
  });

  it('rejects another user uploaded image reference', async () => {
    const ownerUrl = await uploadOne(ownerToken);
    const res = await api('POST', '/listings', {
      token: strangerToken,
      body: listingPayload(fx, [ownerUrl]),
    });
    assert.equal(res.status, 400);
  });

  it('accepts 1, 5, and 10 owned images; rejects 11', async () => {
    const one = await uploadOne(ownerToken);
    const res1 = trackListing(await api('POST', '/listings', {
      token: ownerToken,
      body: listingPayload(fx, [one]),
    }));
    assert.ok([200, 201].includes(res1.status));

    const fiveUploads = [];
    for (let i = 0; i < 5; i++) {
      fiveUploads.push(await uploadOne(ownerToken));
    }
    const res5 = trackListing(await api('POST', '/listings', {
      token: ownerToken,
      body: listingPayload(fx, fiveUploads),
    }));
    assert.ok([200, 201].includes(res5.status));

    const tenUploads = [];
    for (let i = 0; i < 10; i++) {
      tenUploads.push(await uploadOne(ownerToken));
    }
    const res10 = trackListing(await api('POST', '/listings', {
      token: ownerToken,
      body: listingPayload(fx, tenUploads),
    }));
    assert.ok([200, 201].includes(res10.status));

    const eleven = [...tenUploads, await uploadOne(ownerToken)];
    const res11 = await api('POST', '/listings', {
      token: ownerToken,
      body: listingPayload(fx, eleven),
    });
    assert.equal(res11.status, 400);
  });

  it('edit rejects attaching another users image to own listing', async () => {
    if (!fx.listing || fx.listing.user_id !== fx.owner.id) return;
    const strangerUrl = await uploadOne(strangerToken);
    const existing = await api('GET', `/listings/${fx.listing.id}`, {
      token: ownerToken,
    });
    if (existing.status !== 200) return;

    const body = {
      model_id: existing.data.listing.model_id,
      model_storage_id: existing.data.listing.model_storage_id,
      model_color_id: existing.data.listing.model_color_id,
      sim_configuration_id: existing.data.listing.sim_configuration_id,
      condition_id: existing.data.listing.condition_id,
      price: existing.data.listing.price,
      description: existing.data.listing.description || 'edit security test',
      images: [strangerUrl],
    };

    const res = await api('PUT', `/listings/${fx.listing.id}`, {
      token: ownerToken,
      body,
    });
    assert.equal(res.status, 400);
  });
});
