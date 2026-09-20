'use strict';

/**
 * Identifiers used by the in-memory IP rate limiters.
 *
 * Phone-number budgets live in utils/otp.js (Postgres), not here.
 * IP keys use Express `req.ip` only. Client-supplied X-Forwarded-For is
 * ignored unless the process has `trust proxy` enabled (TRUST_PROXY=1).
 */

const net = require('net');
const { ipKeyGenerator } = require('express-rate-limit');

/** Same default as express-rate-limit v8 — groups IPv6 clients on a /56. */
const IPV6_SUBNET = 56;

function rawRequestIp(req) {
  const raw = req && (req.ip || req.socket?.remoteAddress);
  if (raw == null) return '';
  return String(raw).trim();
}

/**
 * Canonical IP key for rate limiting.
 * Missing or malformed addresses share one bucket (`ip:unknown` / `ip:invalid`)
 * so they cannot create unbounded unique keys.
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
function clientIpKey(req) {
  const raw = rawRequestIp(req).replace(/^::ffff:/i, '');
  if (!raw) return 'ip:unknown';
  if (!net.isIP(raw)) return 'ip:invalid';
  return `ip:${ipKeyGenerator(raw, IPV6_SUBNET)}`;
}

module.exports = {
  IPV6_SUBNET,
  clientIpKey,
};
