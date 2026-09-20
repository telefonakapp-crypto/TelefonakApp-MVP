'use strict';

/**
 * TFK-M2 — in-memory IP rate limiting + phone canonicalization.
 * Isolated: no HTTP server, no database, no OTP/user writes.
 */
const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { MemoryStore } = rateLimit;
const { clientIpKey } = require('./rateLimitIdentity');
const { normalizePhoneNumber } = require('./phone');

const BACKEND_ROOT = path.resolve(__dirname, '..');

function mockReq(ip, headers = {}) {
  return {
    ip,
    headers,
    socket: { remoteAddress: ip },
    app: { get: () => false },
    originalUrl: '/test',
  };
}

function applyLimiter(limiter, req) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      headersSent: false,
      writableEnded: false,
      status(code) {
        this.statusCode = code;
        return this;
      },
      send(body) {
        this.body = body;
        this.writableEnded = true;
        resolve({ allowed: false, status: this.statusCode, body });
      },
      setHeader() {
        return this;
      },
      set() {
        return this;
      },
    };
    Promise.resolve(
      limiter(req, res, () => resolve({ allowed: true, status: 200 }))
    ).catch(reject);
  });
}

function makeLimiter({ windowMs, max, store }) {
  return rateLimit({
    windowMs,
    max,
    store,
    keyGenerator: clientIpKey,
    validate: false,
    standardHeaders: false,
    legacyHeaders: false,
    message: { error: 'limited' },
  });
}

describe('TFK-M2 phone canonicalization (OTP identifier)', () => {
  it('F. equivalent Jordanian formats map to the same number', () => {
    const canonical = '0791234567';
    assert.equal(normalizePhoneNumber('0791234567'), canonical);
    assert.equal(normalizePhoneNumber('+962791234567'), canonical);
    assert.equal(normalizePhoneNumber('962791234567'), canonical);
    assert.equal(normalizePhoneNumber('00962791234567'), canonical);
    assert.equal(normalizePhoneNumber('791234567'), canonical);
  });

  it('issueOtp and consumeOtp canonicalize the phone before locking/counting', () => {
    const src = fs.readFileSync(path.join(BACKEND_ROOT, 'utils', 'otp.js'), 'utf8');
    assert.match(src, /normalizePhoneNumber\(phoneNumber\)/);
    assert.equal((src.match(/canonicalPhone/g) || []).length >= 2, true);
  });
});

describe('TFK-M2 IP identity', () => {
  it('G. IPv4-mapped IPv6 matches IPv4', () => {
    assert.equal(clientIpKey(mockReq('::ffff:192.0.2.10')), clientIpKey(mockReq('192.0.2.10')));
  });

  it('G. IPv6 addresses in the same /56 share a key', () => {
    const a = clientIpKey(mockReq('2001:db8:1234:5600::1'));
    const b = clientIpKey(mockReq('2001:db8:1234:5600::99'));
    assert.equal(a, b);
    assert.match(a, /^ip:/);
  });

  it('X-Forwarded-For does not change the key (req.ip / socket only)', () => {
    const without = clientIpKey(mockReq('203.0.113.5'));
    const withHeader = clientIpKey(
      mockReq('203.0.113.5', { 'x-forwarded-for': '198.51.100.1, 192.0.2.1' })
    );
    assert.equal(without, withHeader);
    assert.equal(withHeader.includes('198.51.100.1'), false);
  });

  it('H. malformed / empty IPs share a single bucket (no unique garbage keys)', () => {
    assert.equal(clientIpKey(mockReq('')), 'ip:unknown');
    assert.equal(clientIpKey(mockReq(undefined)), 'ip:unknown');
    assert.equal(clientIpKey(mockReq('not-an-ip')), 'ip:invalid');
    assert.equal(clientIpKey(mockReq('%%%')), 'ip:invalid');
  });
});

describe('TFK-M2 isolated IP limiters', () => {
  const otpRequestStore = new MemoryStore();
  const otpVerifyStore = new MemoryStore();
  const adminLoginStore = new MemoryStore();

  const otpRequestLimiter = makeLimiter({
    windowMs: 60 * 1000,
    max: 3,
    store: otpRequestStore,
  });
  const otpVerifyLimiter = makeLimiter({
    windowMs: 60 * 1000,
    max: 3,
    store: otpVerifyStore,
  });
  const adminLoginLimiter = makeLimiter({
    windowMs: 60 * 1000,
    max: 3,
    store: adminLoginStore,
  });

  after(() => {
    otpRequestStore.shutdown();
    otpVerifyStore.shutdown();
    adminLoginStore.shutdown();
  });

  it('A. OTP request limiter blocks the 4th hit from the same IP', async () => {
    const ip = '203.0.113.10';
    const results = [];
    for (let i = 0; i < 4; i += 1) {
      results.push(await applyLimiter(otpRequestLimiter, mockReq(ip)));
    }
    assert.equal(results[0].allowed, true);
    assert.equal(results[1].allowed, true);
    assert.equal(results[2].allowed, true);
    assert.equal(results[3].allowed, false);
    assert.equal(results[3].status, 429);
  });

  it('B. OTP verification limiter is independent of OTP request counters', async () => {
    const ip = '203.0.113.10';
    const first = await applyLimiter(otpVerifyLimiter, mockReq(ip));
    assert.equal(first.allowed, true);
    const second = await applyLimiter(otpVerifyLimiter, mockReq(ip));
    assert.equal(second.allowed, true);
    const third = await applyLimiter(otpVerifyLimiter, mockReq(ip));
    assert.equal(third.allowed, true);
    const fourth = await applyLimiter(otpVerifyLimiter, mockReq(ip));
    assert.equal(fourth.allowed, false);
    assert.equal(fourth.status, 429);
  });

  it('C. Admin login limiter is independent of OTP limiters', async () => {
    const ip = '203.0.113.10';
    assert.equal((await applyLimiter(adminLoginLimiter, mockReq(ip))).allowed, true);
    assert.equal((await applyLimiter(adminLoginLimiter, mockReq(ip))).allowed, true);
    assert.equal((await applyLimiter(adminLoginLimiter, mockReq(ip))).allowed, true);
    const blocked = await applyLimiter(adminLoginLimiter, mockReq(ip));
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.status, 429);
  });

  it('E. separate IPs do not share counters', async () => {
    const other = await applyLimiter(otpRequestLimiter, mockReq('203.0.113.99'));
    assert.equal(other.allowed, true);
  });
});

describe('TFK-M2 MemoryStore expiration and cleanup', () => {
  it('D. counters expire after the window', async () => {
    const store = new MemoryStore();
    store.init({ windowMs: 40 });
    after(() => store.shutdown());
    assert.equal((await store.increment('ip:a')).totalHits, 1);
    assert.equal((await store.increment('ip:a')).totalHits, 2);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal((await store.increment('ip:a')).totalHits, 1);
  });

  it('I/J. expired unique keys are dropped (not retained unbounded)', async () => {
    const store = new MemoryStore();
    store.init({ windowMs: 60 * 1000 });
    after(() => store.shutdown());
    for (let i = 0; i < 250; i += 1) {
      await store.increment(`ip:flood-${i}`);
    }
    assert.ok(store.current.size >= 250);
    store.clearExpired();
    store.clearExpired();
    assert.equal(store.current.size, 0);
    assert.equal(store.previous.size, 0);
    assert.equal(await store.get('ip:flood-0'), undefined);
  });
});

describe('TFK-M2 production limiter source contract', () => {
  it('documents single-instance MemoryStore and separate OTP/admin stores', () => {
    const src = fs.readFileSync(path.join(BACKEND_ROOT, 'middleware', 'rateLimits.js'), 'utf8');
    assert.match(src, /process-local/);
    assert.match(src, /single backend instance/);
    assert.match(src, /Redis/);
    assert.match(src, /otpRequestStore/);
    assert.match(src, /otpVerifyStore/);
    assert.match(src, /adminLoginStore/);
    assert.match(src, /keyGenerator: clientIpKey/);
  });

  it('does not read X-Forwarded-For when building the IP key', () => {
    const src = fs.readFileSync(
      path.join(BACKEND_ROOT, 'utils', 'rateLimitIdentity.js'),
      'utf8'
    );
    assert.equal(/headers\s*\[.x-forwarded-for.\]/i.test(src), false);
    assert.match(src, /req\.ip/);
  });
});
