const express = require('express');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const rateLimit = require('express-rate-limit');
const { sanitizeText } = require('../utils/sanitize');
const { signAuthToken, setAuthCookie, getTokenFromRequest, revokeAuthToken, clearAuthCookie } = require('../utils/authToken');
const { anonymizeUserData } = require('../utils/privacy');

const router = express.Router();

const passwordChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many password attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name || '',
    role: user.role || 'user',
    plan_id: user.plan_id || 1,
    plan_expires_at: user.plan_expires_at || null,
    created_at: user.created_at,
  };
}

router.get('/me', (req, res) => {
  try {
    const db = req.app.locals.db;
    const user = db.prepare('SELECT id, email, name, role, plan_id, plan_expires_at, created_at FROM users WHERE id = ? AND deleted_at IS NULL').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(publicUser(user));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.put('/me', passwordChangeLimiter, (req, res) => {
  try {
    const db = req.app.locals.db;
    const { email, current_password } = req.body;

    if (!email || !validator.isEmail(email)) return res.status(400).json({ error: 'A valid email is required' });
    if (!current_password) return res.status(400).json({ error: 'Current password is required' });

    const user = db.prepare('SELECT id, email, name, role, plan_id, plan_expires_at, password_hash FROM users WHERE id = ? AND deleted_at IS NULL').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!bcrypt.compareSync(current_password, user.password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const normalizedEmail = validator.normalizeEmail(email);
    const duplicate = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(normalizedEmail, req.user.id);
    if (duplicate) return res.status(409).json({ error: 'Another user already uses this email' });

    db.prepare('UPDATE users SET email = ? WHERE id = ?').run(normalizedEmail, req.user.id);
    const updated = db.prepare('SELECT id, email, name, role, plan_id, plan_expires_at, created_at FROM users WHERE id = ?').get(req.user.id);
    const oldToken = getTokenFromRequest(req);
    if (oldToken) revokeAuthToken(oldToken);
    setAuthCookie(res, signAuthToken(updated));
    res.json({ user: publicUser(updated) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/me', passwordChangeLimiter, (req, res) => {
  try {
    const db = req.app.locals.db;
    const { current_password } = req.body;
    if (!current_password) return res.status(400).json({ error: 'Current password is required' });

    const user = db.prepare('SELECT id, email, name, role, plan_id, plan_expires_at, password_hash FROM users WHERE id = ? AND deleted_at IS NULL').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!bcrypt.compareSync(current_password, user.password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    if (user.role === 'admin') {
      const adminCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='admin' AND deleted_at IS NULL").get().c;
      if (adminCount <= 1) return res.status(400).json({ error: 'Cannot delete the only admin account' });
    }

    anonymizeUserData(db, req.user.id, user.email);
    const token = getTokenFromRequest(req);
    if (token) revokeAuthToken(token, db);
    clearAuthCookie(res);
    res.json({ message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;