const { getTokenFromRequest, verifyAuthToken } = require('../utils/authToken');

function authMiddleware(req, res, next) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = verifyAuthToken(token, req.app.locals.db);
    const db = req.app.locals.db;

    if (db) {
      const user = db.prepare('SELECT id, email, role, plan_id, name FROM users WHERE id = ? AND deleted_at IS NULL').get(decoded.id);
      if (!user) {
        return res.status(401).json({ error: 'Invalid or expired session' });
      }
      req.user = user;
    } else {
      req.user = { id: decoded.id, role: decoded.role || 'user' };
    }

    req.authToken = token;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

module.exports = authMiddleware;