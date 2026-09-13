const express = require('express');
const rateLimit = require('express-rate-limit');
const { encrypt, decrypt } = require('../utils/crypto');
const { createTransporter, getSmtpSettings } = require('../utils/email');
const { getDefaultAppBaseUrl, normalizeAppBaseUrl } = require('../utils/appBaseUrl');
const { broadcast } = require('../utils/sse');
const adminOnly = require('../middleware/adminOnly');
const { redactSensitive } = require('../utils/secrets');
const { sanitizeEmail } = require('../utils/sanitize');
const validator = require('validator');
const router = express.Router();

const testEmailLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many test email attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const allowedSettings = new Set([
  'smtp_host',
  'smtp_port',
  'smtp_username',
  'smtp_password',
  'smtp_tls',
  'default_from_name',
  'default_from_email',
  'app_base_url',
  'imap_host',
  'imap_port',
  'imap_username',
  'imap_password',
  'imap_tls',
  'razorpay_key_id',
  'razorpay_key_secret',
  'payments_enabled',
  'upi_id',
  'payment_instructions',
  'bank_name',
  'bank_account',
  'bank_ifsc',
  'payment_methods_enabled',
]);

const ENCRYPTED_KEYS = new Set(['smtp_password', 'imap_password', 'razorpay_key_secret']);

// GET /api/settings
router.get('/', adminOnly, (req, res) => {
  try {
    const db = req.app.locals.db;
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    rows.forEach(r => {
      if (ENCRYPTED_KEYS.has(r.key)) {
        settings[`${r.key}_saved`] = Boolean(r.value);
        settings[r.key] = '';
      } else {
        settings[r.key] = r.value;
      }
    });
    settings.app_base_url = settings.app_base_url || getDefaultAppBaseUrl();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/settings
router.put('/', adminOnly, (req, res) => {
  try {
    const db = req.app.locals.db;
    const settings = req.body;

    const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?');
    const txn = db.transaction(() => {
      for (const [key, value] of Object.entries(settings)) {
        if (!allowedSettings.has(key)) continue;

        let val = value;
        if (ENCRYPTED_KEYS.has(key)) {
          if (!value || value.trim() === '') continue;
          val = encrypt(value);
        }
        if (key === 'app_base_url' && value) {
          val = normalizeAppBaseUrl(value);
        }
        upsert.run(key, val, val);
      }
    });
    txn();
    broadcast('settings');
    res.json({ message: 'Settings saved' });
  } catch (err) {
    console.error('Save settings error:', redactSensitive(err));
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// POST /api/settings/test-email
router.post('/test-email', adminOnly, testEmailLimiter, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const settings = getSmtpSettings(db);
    const transporter = createTransporter(settings);

    const testTo = sanitizeEmail(req.body.to || settings.smtp_username || req.user.email);
    if (!validator.isEmail(testTo)) return res.status(400).json({ error: 'Valid recipient email is required' });
    await transporter.sendMail({
      from: `"${settings.default_from_name || 'MailcryVia'}" <${settings.default_from_email || settings.smtp_username}>`,
      to: testTo,
      subject: 'MailcryVia Test Email',
      html: '<h1>It works!</h1><p>Your SMTP configuration is correct. You can now send campaigns with MailcryVia.</p>'
    });

    res.json({ message: `Test email sent to ${testTo}` });
  } catch (err) {
    console.error('Test email error:', redactSensitive(err));
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

// GET /api/settings/payment-status — check if payment gateway is configured
router.get('/payment-status', (req, res) => {
  try {
    const db = req.app.locals.db;
    const { decrypt } = require('../utils/crypto');
    const keyId = db.prepare("SELECT value FROM settings WHERE key = 'razorpay_key_id'").get()?.value
                  || process.env.RAZORPAY_KEY_ID || '';
    const secretRow = db.prepare("SELECT value FROM settings WHERE key = 'razorpay_key_secret'").get()?.value;
    const hasSecret = Boolean(secretRow || process.env.RAZORPAY_KEY_SECRET);
    const isConfigured = Boolean(keyId && hasSecret);
    const isLive = keyId.startsWith('rzp_live_');
    const paymentsEnabledRow = db.prepare("SELECT value FROM settings WHERE key = 'payments_enabled'").get()?.value;
    const paymentsEnabled = paymentsEnabledRow !== 'false';
    res.json({ configured: isConfigured, mode: isLive ? 'live' : 'test', payments_enabled: paymentsEnabled });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

// POST /api/settings/test-payment — verify razorpay keys work
// Accepts { key_id, key_secret } in body to test unsaved keys; falls back to DB/env.
router.post('/test-payment', adminOnly, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { decrypt } = require('../utils/crypto');

    // Prefer keys sent directly from the form (pre-save test)
    let keyId     = (req.body.key_id     || '').trim();
    let keySecret = (req.body.key_secret || '').trim();

    // Fall back to DB then env
    if (!keyId) {
      keyId = db.prepare("SELECT value FROM settings WHERE key = 'razorpay_key_id'").get()?.value
              || process.env.RAZORPAY_KEY_ID || '';
    }
    if (!keySecret) {
      const secretEnc = db.prepare("SELECT value FROM settings WHERE key = 'razorpay_key_secret'").get()?.value;
      keySecret = secretEnc ? decrypt(secretEnc) : (process.env.RAZORPAY_KEY_SECRET || '');
    }

    if (!keyId || !keySecret) {
      return res.status(400).json({ error: 'Enter both Key ID and Key Secret before testing' });
    }

    const Razorpay = require('razorpay');
    const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
    // Create a tiny ₹1 order to verify credentials
    await rzp.orders.create({ amount: 100, currency: 'INR', receipt: 'test_' + Date.now() });
    const mode = keyId.startsWith('rzp_live_') ? 'Live' : 'Test';
    res.json({ success: true, message: `Razorpay ${mode} keys verified successfully` });
  } catch (err) {
    console.error('Razorpay verification error:', redactSensitive(err));
    res.status(400).json({ error: 'Razorpay verification failed' });
  }
});

// GET /api/settings/payment-info — public payment info for users (UPI, bank, instructions)
router.get('/payment-info', (req, res) => {
  try {
    const db = req.app.locals.db;
    const keys = ['upi_id', 'payment_instructions', 'bank_name', 'bank_account', 'bank_ifsc', 'payment_methods_enabled'];
    const rows = db.prepare(`SELECT key, value FROM settings WHERE key IN (${keys.map(() => '?').join(',')})`).all(...keys);
    const info = {};
    rows.forEach(r => { info[r.key] = r.value; });
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payment info' });
  }
});

// PUT /api/settings/password — change admin password
router.put('/password', (req, res) => {
  try {
    const db = req.app.locals.db;
    const bcrypt = require('bcryptjs');
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const user = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!bcrypt.compareSync(current_password, user.password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newHash = bcrypt.hashSync(new_password, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
