'use strict';

/**
 * Admin Web access JWT issue/verify helpers.
 * Independent from customer/mobile JWTs (utils/customerAuth.js).
 */

const jwt = require('jsonwebtoken');
const {
  getAdminJwtSecret,
  getAdminAccessTokenTtl,
  ADMIN_JWT_ISS,
  ADMIN_JWT_AUD,
} = require('../config/env');

function signAdminToken(admin) {
  return jwt.sign(
    {
      adminId: admin.id,
      email: admin.email,
      role: admin.role,
      typ: 'admin',
    },
    getAdminJwtSecret(),
    {
      expiresIn: getAdminAccessTokenTtl(),
      issuer: ADMIN_JWT_ISS,
      audience: ADMIN_JWT_AUD,
    }
  );
}

function verifyAdminAccessToken(token) {
  return jwt.verify(token, getAdminJwtSecret(), {
    issuer: ADMIN_JWT_ISS,
    audience: ADMIN_JWT_AUD,
    algorithms: ['HS256'],
  });
}

module.exports = {
  signAdminToken,
  verifyAdminAccessToken,
};
