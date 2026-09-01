const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { verifyCustomerToken } = require('../utils/customerAuth');

/**
 * Attaches the decoded JWT to req.user, or rejects with 401.
 * When the token includes userId, also rejects disabled marketplace accounts (403).
 *
 * @param {{ requireUserId?: boolean }} [options]
 */
function makeVerifyToken(options = {}) {
  const { requireUserId = false } = options;

  return async function verifyToken(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      const decoded = verifyCustomerToken(token);

      // Staff tokens must not authenticate as marketplace customers.
      if (decoded.adminId || decoded.typ === 'admin') {
        return res.status(401).json({ error: 'Invalid token' });
      }

      if (requireUserId && !decoded.userId) {
        return res.status(401).json({ error: 'User ID not found in token' });
      }

      if (decoded.userId) {
        const result = await pool.query(
          'SELECT is_active FROM users WHERE id = $1',
          [decoded.userId]
        );

        if (result.rows.length === 0) {
          return res.status(401).json({ error: 'User not found' });
        }

        if (result.rows[0].is_active === false) {
          return res.status(403).json({ error: 'Account is disabled' });
        }
      }

      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

const verifyToken = makeVerifyToken();
verifyToken.requireUserId = makeVerifyToken({ requireUserId: true });

module.exports = verifyToken;
