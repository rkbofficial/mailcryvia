const express = require('express');
const rateLimit = require('express-rate-limit');
const { syncIntegrationInbox } = require('../utils/imap');
const nodemailer = require('nodemailer');
const validator = require('validator');
const { decrypt } = require('../utils/crypto');
const { broadcast } = require('../utils/sse');
const { redactSensitive } = require('../utils/secrets');
const { sanitizeText, sanitizeEmail, sanitizeHtml } = require('../utils/sanitize');
const { smtpTlsOptions } = require('../utils/email');
const router = express.Router();

const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many message attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

function getIntegration(db, integrationId, userId) {
  return db.prepare('SELECT * FROM email_integrations WHERE id = ? AND user_id = ?').get(integrationId, userId);
}

function buildTransporter(integration) {
  const pass = decrypt(integration.smtp_password);
  const port = parseInt(integration.smtp_port, 10);
  const secure = integration.smtp_tls === 'true' ? (port === 465) : false;
  return nodemailer.createTransport({
    host: integration.smtp_host,
    port,
    secure,
    auth: { user: integration.smtp_username, pass },
    tls: smtpTlsOptions(),
    connectionTimeout: 15000,
  });
}

function normalizeRecipient(value) {
  const email = sanitizeEmail(value);
  if (!email || !validator.isEmail(email)) {
    const err = new Error('Valid recipient email is required');
    err.status = 400;
    throw err;
  }
  return email;
}

function routeError(res, err, fallback) {
  res.status(err.status || 500).json({ error: err.status ? err.message : fallback });
}

// POST /api/inbox/compose
router.post('/compose', messageLimiter, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const integrationId = parseInt(req.body.integration_id, 10);
    const to = normalizeRecipient(req.body.to);
    const subject = sanitizeText(req.body.subject, 255);
    const htmlContent = sanitizeHtml(req.body.html_content || '');
    if (!integrationId) return res.status(400).json({ error: 'integration_id is required' });
    if (!subject) return res.status(400).json({ error: 'Subject is required' });
    if (!htmlContent) return res.status(400).json({ error: 'Email content is required' });

    const integration = getIntegration(db, integrationId, req.user.id);
    if (!integration) return res.status(404).json({ error: 'Integration not found' });

    const transporter = buildTransporter(integration);
    await transporter.sendMail({
      from: `"${integration.from_name}" <${integration.from_email}>`,
      to,
      subject,
      html: htmlContent
    });

    res.json({ message: 'Email sent successfully' });
  } catch (err) {
    console.error('Compose error:', redactSensitive(err));
    routeError(res, err, 'Failed to send email');
  }
});

// POST /api/inbox/sync?integration_id=X
router.post('/sync', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const integrationId = parseInt(req.query.integration_id || req.body.integration_id, 10);
    if (!integrationId) return res.status(400).json({ error: 'integration_id is required' });

    const integration = getIntegration(db, integrationId, req.user.id);
    if (!integration) return res.status(404).json({ error: 'Integration not found' });
    if (!integration.imap_host) return res.status(400).json({ error: 'IMAP not configured for this sender' });

    const result = await syncIntegrationInbox(db, integrationId);
    if (result.error) return res.status(400).json({ error: 'Sync failed' });
    if (result.newMessages > 0) broadcast('inbox');
    res.json({ message: 'Sync complete', newMessages: result.newMessages });
  } catch (err) {
    console.error('Inbox sync error:', redactSensitive(err));
    res.status(500).json({ error: 'Failed to sync inbox' });
  }
});

// GET /api/inbox?integration_id=X
router.get('/', (req, res) => {
  try {
    const db = req.app.locals.db;
    const integrationId = parseInt(req.query.integration_id, 10);
    if (!integrationId) return res.status(400).json({ error: 'integration_id is required' });

    const integration = getIntegration(db, integrationId, req.user.id);
    if (!integration) return res.status(404).json({ error: 'Integration not found' });

    const messages = db.prepare(
      'SELECT id, message_id, from_name, from_email, subject, date, is_read, text_content FROM inbox_messages WHERE integration_id = ? ORDER BY date DESC'
    ).all(integrationId);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// GET /api/inbox/:id
router.get('/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const msg = db.prepare(`
      SELECT m.id, m.integration_id, m.message_id, m.from_name, m.from_email, m.to_email, m.subject,
             m.date, m.is_read, m.text_content, m.html_content, m.created_at
      FROM inbox_messages m
      JOIN email_integrations ei ON ei.id = m.integration_id
      WHERE m.id = ? AND ei.user_id = ?
    `).get(parseInt(req.params.id, 10), req.user.id);
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    if (!msg.is_read) {
      db.prepare('UPDATE inbox_messages SET is_read = 1 WHERE id = ?').run(msg.id);
      msg.is_read = 1;
    }
    res.json(msg);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch message' });
  }
});

// POST /api/inbox/:id/reply
router.post('/:id/reply', messageLimiter, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const htmlContent = sanitizeHtml(req.body.html_content || '');
    if (!htmlContent) return res.status(400).json({ error: 'Reply content required' });

    const msg = db.prepare(`
      SELECT m.* FROM inbox_messages m
      JOIN email_integrations ei ON ei.id = m.integration_id
      WHERE m.id = ? AND ei.user_id = ?
    `).get(parseInt(req.params.id, 10), req.user.id);
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    const intId = parseInt(req.body.integration_id || msg.integration_id, 10);
    const integration = getIntegration(db, intId, req.user.id);
    if (!integration) return res.status(404).json({ error: 'Integration not found' });

    const transporter = buildTransporter(integration);
    await transporter.sendMail({
      from: `"${integration.from_name}" <${integration.from_email}>`,
      to: msg.from_email,
      subject: `Re: ${(msg.subject || '').replace(/^Re:\s*/i, '')}`,
      html: htmlContent,
      inReplyTo: msg.message_id,
      references: [msg.message_id]
    });

    res.json({ message: 'Reply sent successfully' });
  } catch (err) {
    console.error('Reply error:', redactSensitive(err));
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

// DELETE /api/inbox/:id
router.delete('/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const msg = db.prepare(`
      SELECT m.id FROM inbox_messages m
      JOIN email_integrations ei ON ei.id = m.integration_id
      WHERE m.id = ? AND ei.user_id = ?
    `).get(parseInt(req.params.id, 10), req.user.id);
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    db.prepare('DELETE FROM inbox_messages WHERE id = ?').run(msg.id);
    broadcast('inbox');
    res.json({ message: 'Message deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

module.exports = router;