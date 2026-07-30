const jwt = require('jsonwebtoken');

/**
 * Attaches the decoded JWT to req.user, or rejects with 401.
 * Same contract the route files have always used.
 */
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = verifyToken;
