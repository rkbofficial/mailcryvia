const express = require('express');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const validator = require('validator');
const { encrypt, decrypt } = require('../utils/crypto');
const { broadcast } = require('../utils/sse');
const { redactSensitive } = require('../utils/secrets');
const { sanitizeText, sanitizeEmail } = require('../utils/sanitize');
const { smtpTlsOptions } = require('../utils/email');
const router = express.Router();

const testEmailLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many test email attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

function getPlanLimit(db, userId) {
  const row = db.prepare(`
    SELECT p.max_email_integrations
    FROM users u JOIN plans p ON p.id = u.plan_id
    WHERE u.id = ?
  `).get(userId);
  return row?.max_email_integrations ?? 1;
}

function safeRow(row) {
  if (!row) return null;
  const { smtp_password, imap_password, user_id, ...rest } = row;
  return { ...rest, smtp_password_saved: Boolean(smtp_password), imap_password_saved: Boolean(imap_password) };
}

function normalizePort(value, fallback) {
  const parsed = parseInt(value || fallback, 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : fallback;
}

function normalizeIntegrationInput(body, existing = {}) {
  const fromEmail = sanitizeEmail(body.from_email ?? existing.from_email);
  if (!validator.isEmail(fromEmail)) {
    const err = new Error('Valid From Email is required');
    err.status = 400;
    throw err;
  }

  return {
    name: sanitizeText(body.name ?? existing.name, 160),
    from_name: sanitizeText(body.from_name ?? existing.from_name, 160),
    from_email: fromEmail,
    smtp_host: sanitizeText(body.smtp_host ?? existing.smtp_host, 255),
    smtp_port: normalizePort(body.smtp_port ?? existing.smtp_port, 587),
    smtp_username: sanitizeText(body.smtp_username ?? existing.smtp_username, 320),
    smtp_tls: body.smtp_tls !== undefined ? String(body.smtp_tls) : (existing.smtp_tls || 'false'),
    imap_host: body.imap_host !== undefined ? (sanitizeText(body.imap_host, 255) || null) : (existing.imap_host || null),
    imap_port: normalizePort(body.imap_port ?? existing.imap_port, 993),
    imap_username: body.imap_username !== undefined ? (sanitizeText(body.imap_username, 320) || null) : (existing.imap_username || null),
    imap_tls: body.imap_tls !== undefined ? String(body.imap_tls) : (existing.imap_tls || 'true'),
  };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createIntegrationTransport(row) {
  const pass = decrypt(row.smtp_password);
  const port = parseInt(row.smtp_port, 10);
  const secure = row.smtp_tls === 'true' ? (port === 465) : false;
  return nodemailer.createTransport({
    host: row.smtp_host,
    port,
    secure,
    auth: { user: row.smtp_username, pass },
    tls: smtpTlsOptions(),
    connectionTimeout: 10000,
  });
}

function routeError(res, err, fallback) {
  res.status(err.status || 500).json({ error: err.status ? err.message : fallback });
}

// GET /api/email-integrations
router.get('/', (req, res) => {
  try {
    const db = req.app.locals.db;
    const rows = db.prepare('SELECT * FROM email_integrations WHERE user_id = ? ORDER BY is_default DESC, created_at ASC').all(req.user.id);
    const limit = getPlanLimit(db, req.user.id);
    res.json({ integrations: rows.map(safeRow), limit, used: rows.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch email integrations' });
  }
});

// POST /api/email-integrations
router.post('/', (req, res) => {
  try {
    const db = req.app.locals.db;
    const input = normalizeIntegrationInput(req.body);
    const smtpPassword = sanitizeText(req.body.smtp_password, 1000);
    const imapPassword = sanitizeText(req.body.imap_password, 1000);

    if (!input.name) return res.status(400).json({ error: 'Name is required' });
    if (!input.from_name) return res.status(400).json({ error: 'From Name is required' });
    if (!input.smtp_host) return res.status(400).json({ error: 'SMTP Host is required' });
    if (!input.smtp_username) return res.status(400).json({ error: 'SMTP Username is required' });
    if (!smtpPassword) return res.status(400).json({ error: 'SMTP Password is required' });

    const limit = getPlanLimit(db, req.user.id);
    const current = db.prepare('SELECT COUNT(*) as c FROM email_integrations WHERE user_id = ?').get(req.user.id).c;
    if (limit !== -1 && current >= limit) {
      return res.status(403).json({ error: `Your plan allows up to ${limit} email sender${limit === 1 ? '' : 's'}. Upgrade to add more.` });
    }

    const result = db.prepare(`
      INSERT INTO email_integrations (user_id, name, from_name, from_email, smtp_host, smtp_port, smtp_username, smtp_password, smtp_tls,
        imap_host, imap_port, imap_username, imap_password, imap_tls, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      input.name,
      input.from_name,
      input.from_email,
      input.smtp_host,
      input.smtp_port,
      input.smtp_username,
      encrypt(smtpPassword),
      input.smtp_tls,
      input.imap_host,
      input.imap_port,
      input.imap_username,
      imapPassword ? encrypt(imapPassword) : null,
      input.imap_tls,
      current === 0 ? 1 : 0
    );

    const created = db.prepare('SELECT * FROM email_integrations WHERE id = ? AND user_id = ?').get(result.lastInsertRowid, req.user.id);
    broadcast('inbox');
    res.status(201).json(safeRow(created));
  } catch (err) {
    console.error('Create integration error:', redactSensitive(err));
    routeError(res, err, 'Failed to create email integration');
  }
});

// PUT /api/email-integrations/:id
router.put('/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const existing = db.prepare('SELECT * FROM email_integrations WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Integration not found' });

    const input = normalizeIntegrationInput(req.body, existing);
    const smtpPassword = sanitizeText(req.body.smtp_password, 1000);
    const imapPassword = sanitizeText(req.body.imap_password, 1000);

    db.prepare(`
      UPDATE email_integrations
      SET name=?, from_name=?, from_email=?, smtp_host=?, smtp_port=?, smtp_username=?, smtp_password=?, smtp_tls=?,
          imap_host=?, imap_port=?, imap_username=?, imap_password=?, imap_tls=?
      WHERE id=? AND user_id=?
    `).run(
      input.name,
      input.from_name,
      input.from_email,
      input.smtp_host,
      input.smtp_port,
      input.smtp_username,
      smtpPassword ? encrypt(smtpPassword) : existing.smtp_password,
      input.smtp_tls,
      input.imap_host,
      input.imap_port,
      input.imap_username,
      imapPassword ? encrypt(imapPassword) : existing.imap_password,
      input.imap_tls,
      req.params.id,
      req.user.id
    );

    const updated = db.prepare('SELECT * FROM email_integrations WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    broadcast('inbox');
    res.json(safeRow(updated));
  } catch (err) {
    console.error('Update integration error:', redactSensitive(err));
    routeError(res, err, 'Failed to update email integration');
  }
});

// DELETE /api/email-integrations/:id
router.delete('/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const existing = db.prepare('SELECT * FROM email_integrations WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Integration not found' });

    db.prepare('DELETE FROM email_integrations WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);

    if (existing.is_default) {
      const next = db.prepare('SELECT id FROM email_integrations WHERE user_id = ? ORDER BY created_at ASC LIMIT 1').get(req.user.id);
      if (next) db.prepare('UPDATE email_integrations SET is_default = 1 WHERE id = ? AND user_id = ?').run(next.id, req.user.id);
    }

    broadcast('inbox');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete email integration' });
  }
});

// PUT /api/email-integrations/:id/default
router.put('/:id/default', (req, res) => {
  try {
    const db = req.app.locals.db;
    const existing = db.prepare('SELECT * FROM email_integrations WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Integration not found' });

    db.prepare('UPDATE email_integrations SET is_default = 0 WHERE user_id = ?').run(req.user.id);
    db.prepare('UPDATE email_integrations SET is_default = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    broadcast('inbox');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to set default' });
  }
});

// POST /api/email-integrations/:id/verify
router.post('/:id/verify', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const row = db.prepare('SELECT * FROM email_integrations WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: 'Integration not found' });

    await createIntegrationTransport(row).verify();

    db.prepare('UPDATE email_integrations SET is_verified = 1 WHERE id = ? AND user_id = ?').run(row.id, req.user.id);
    res.json({ success: true, message: 'SMTP connection verified successfully' });
  } catch (err) {
    console.error('Verify integration error:', redactSensitive(err));
    res.status(400).json({ error: 'Connection failed' });
  }
});

// POST /api/email-integrations/:id/send-test
router.post('/:id/send-test', testEmailLimiter, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const row = db.prepare('SELECT * FROM email_integrations WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: 'Integration not found' });

    const to = sanitizeEmail(req.body.to);
    if (!to || !validator.isEmail(to)) return res.status(400).json({ error: 'Valid recipient email is required' });

    await createIntegrationTransport(row).sendMail({
      from: `"${row.from_name}" <${row.from_email}>`,
      to,
      subject: 'MailcryVia Test Email',
      html: `<h2>It works!</h2><p>This is a test from your <strong>${escapeHtml(row.name)}</strong> sender integration in MailcryVia.</p>`,
    });

    db.prepare('UPDATE email_integrations SET is_verified = 1 WHERE id = ? AND user_id = ?').run(row.id, req.user.id);
    res.json({ success: true, message: 'Test email sent' });
  } catch (err) {
    console.error('Send test integration error:', redactSensitive(err));
    res.status(400).json({ error: 'Send failed' });
  }
});

module.exports = router;