'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { api } = require('../lib/harness');

describe('10 — Rate limiting', () => {
  it('OTP request limiter returns 429 after burst from same IP', async () => {
    // Use a disposable Jordanian-format number that is unlikely to be a real user.
    const phone = '0799111222';
    const statuses = [];

    for (let i = 0; i < 6; i += 1) {
      const res = await api('POST', '/auth/request-otp', {
        body: { phone_number: phone },
      });
      statuses.push(res.status);
    }

    assert.ok(
      statuses.includes(429),
      `expected at least one 429 in ${JSON.stringify(statuses)}`
    );
  });

  it('unauthenticated upload limiter still requires auth first (401 before rate limit)', async () => {
    const form = new FormData();
    form.append('images', new Blob([Buffer.from('x')], { type: 'image/jpeg' }), 'x.jpg');
    const res = await api('POST', '/upload/listing-images', { formData: form });
    assert.equal(res.status, 401);
  });
});
