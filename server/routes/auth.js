const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const { logActivity } = require('../utils/activityLog');
const { redactSensitive } = require('../utils/secrets');
const { signAuthToken, setAuthCookie, clearAuthCookie, getTokenFromRequest, revokeAuthToken, verifyAuthToken } = require('../utils/authToken');
const { sanitizeText } = require('../utils/sanitize');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts, please try again shortly' },
  standardHeaders: true,
  legacyHeaders: false,
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many signup attempts, please try again later' },
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
  };
}

function issueSession(res, user) {
  const token = signAuthToken(user);
  setAuthCookie(res, token);
}
function hasValidInitialSetupToken(req) {
  if (process.env.NODE_ENV !== 'production') return true;
  const expected = String(process.env.INITIAL_ADMIN_SETUP_TOKEN || '').trim();
  const provided = String(req.body.setup_token || req.get('x-initial-admin-setup-token') || '').trim();
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}


router.post('/signup', signupLimiter, (req, res) => {
  try {
    const db = req.app.locals.db;
    const { name, email, password } = req.body;

    const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND deleted_at IS NULL").get();
    if (adminCount.count === 0) {
      return res.status(403).json({ error: 'Initial admin setup is required before user signup' });
    }

    if (!name || sanitizeText(name, 120).length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters' });
    }
    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const normalEmail = validator.normalizeEmail(email);
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalEmail);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const displayName = sanitizeText(name, 120);
    const passwordHash = bcrypt.hashSync(password, 12);
    const result = db.prepare('INSERT INTO users (name, email, password_hash, role, plan_id) VALUES (?, ?, ?, ?, ?)').run(
      displayName, normalEmail, passwordHash, 'user', 1
    );
    const user = db.prepare('SELECT id, email, name, role, plan_id, plan_expires_at FROM users WHERE id = ?').get(result.lastInsertRowid);

    issueSession(res, user);
    logActivity(req.app.locals.db, { type: 'user_registered', detail: { user_id: user.id } });
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    console.error('Signup error:', redactSensitive(err));
    res.status(500).json({ error: 'Signup failed' });
  }
});

router.post('/register', (req, res) => {
  try {
    const db = req.app.locals.db;
    const { email, password } = req.body;

    const existingUser = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (existingUser.count > 0) {
      return res.status(403).json({ error: 'Registration is disabled. An admin account already exists.' });
    }
    if (!hasValidInitialSetupToken(req)) {
      return res.status(403).json({ error: 'Invalid initial admin setup token' });
    }

    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const normalEmail = validator.normalizeEmail(email);
    const passwordHash = bcrypt.hashSync(password, 12);
    const result = db.prepare('INSERT INTO users (email, password_hash, role, plan_id) VALUES (?, ?, ?, ?)').run(
      normalEmail, passwordHash, 'admin', 1
    );
    const user = db.prepare('SELECT id, email, name, role, plan_id, plan_expires_at FROM users WHERE id = ?').get(result.lastInsertRowid);

    issueSession(res, user);
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    console.error('Registration error:', redactSensitive(err));
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', loginLimiter, (req, res) => {
  try {
    const db = req.app.locals.db;
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT id, email, name, role, plan_id, plan_expires_at, password_hash FROM users WHERE email = ? AND deleted_at IS NULL').get(validator.normalizeEmail(email));
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    issueSession(res, user);
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error('Login error:', redactSensitive(err));
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', (req, res) => {
  const token = getTokenFromRequest(req);
  if (token) revokeAuthToken(token, req.app.locals.db);
  clearAuthCookie(res);
  res.json({ success: true });
});

router.get('/session', (req, res) => {
  try {
    const token = getTokenFromRequest(req);
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const decoded = verifyAuthToken(token, req.app.locals.db);
    const user = req.app.locals.db
      .prepare('SELECT id, email, name, role, plan_id, plan_expires_at FROM users WHERE id = ? AND deleted_at IS NULL')
      .get(decoded.id);
    if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

    res.json({ user: publicUser(user) });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
});

router.get('/check', (req, res) => {
  const db = req.app.locals.db;
  const existingUser = db.prepare('SELECT COUNT(*) as count FROM users').get();
  res.json({ needsRegistration: existingUser.count === 0 });
});

module.exports = router;