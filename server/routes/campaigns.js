const express = require('express');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const { sendCampaignEmail } = require('../utils/email');
const { sendCsv } = require('../utils/csv');
const { broadcast } = require('../utils/sse');
const { redactSensitive } = require('../utils/secrets');
const { sanitizeText, sanitizeEmail, sanitizeHtml } = require('../utils/sanitize');

const router = express.Router();

const sendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many send attempts, please try again later' },
});

function publicCampaign(row) {
  if (!row) return null;
  const { user_id, ...safe } = row;
  return safe;
}

function normalizeNullableId(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function requireOwnedList(db, value, userId) {
  const id = normalizeNullableId(value);
  if (id === undefined || id === null) return id;
  const row = db.prepare('SELECT id FROM lists WHERE id = ? AND user_id = ?').get(id, userId);
  if (!row) {
    const err = new Error('List not found');
    err.status = 404;
    throw err;
  }
  return id;
}

function requireOwnedIntegration(db, value, userId) {
  const id = normalizeNullableId(value);
  if (id === undefined || id === null) return id;
  const row = db.prepare('SELECT id FROM email_integrations WHERE id = ? AND user_id = ?').get(id, userId);
  if (!row) {
    const err = new Error('Email integration not found');
    err.status = 404;
    throw err;
  }
  return id;
}

function normalizeOptionalEmail(value) {
  if (value === undefined || value === null || value === '') return null;
  const email = sanitizeEmail(value);
  if (!validator.isEmail(email)) {
    const err = new Error('Valid email is required');
    err.status = 400;
    throw err;
  }
  return email;
}

function normalizeCampaignInput(body, existing = null) {
  const name = body.name !== undefined ? sanitizeText(body.name, 160) : existing?.name;
  const subject = body.subject !== undefined ? sanitizeText(body.subject, 255) : existing?.subject;
  const html = body.html_content !== undefined ? sanitizeHtml(body.html_content) : existing?.html_content;
  if (!name || !subject || !html) {
    const err = new Error('Name, subject, and HTML content are required');
    err.status = 400;
    throw err;
  }

  return {
    name,
    subject,
    from_name: body.from_name !== undefined ? (sanitizeText(body.from_name, 160) || null) : existing?.from_name || null,
    from_email: body.from_email !== undefined ? normalizeOptionalEmail(body.from_email) : existing?.from_email || null,
    reply_to: body.reply_to !== undefined ? normalizeOptionalEmail(body.reply_to) : existing?.reply_to || null,
    html_content: html,
  };
}

function sendRouteError(res, err, fallback = 'Request failed') {
  res.status(err.status || 500).json({ error: err.status ? err.message : fallback });
}

// GET /api/campaigns
router.get('/', (req, res) => {
  try {
    const db = req.app.locals.db;
    const campaigns = db.prepare(`
      SELECT c.*, l.name as list_name,
        (SELECT COUNT(*) FROM sends WHERE campaign_id = c.id) as total_sends,
        (SELECT COUNT(*) FROM sends WHERE campaign_id = c.id AND status = 'sent') as delivered,
        (SELECT COUNT(*) FROM sends WHERE campaign_id = c.id AND opened_at IS NOT NULL) as opened,
        (SELECT COUNT(*) FROM sends WHERE campaign_id = c.id AND clicked_at IS NOT NULL) as clicked,
        (SELECT COUNT(*) FROM sends WHERE campaign_id = c.id AND status = 'failed') as bounced,
        (SELECT COUNT(*) FROM sends WHERE campaign_id = c.id AND unsubscribed_at IS NOT NULL) as unsubscribed
      FROM campaigns c
      LEFT JOIN lists l ON l.id = c.list_id AND l.user_id = c.user_id
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC
    `).all(req.user.id).map(publicCampaign);
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// GET /api/campaigns/export
router.get('/export', (req, res) => {
  try {
    const db = req.app.locals.db;
    const campaigns = db.prepare(`
      SELECT c.id, c.name, c.subject, c.status, c.from_name, c.from_email, c.reply_to,
        l.name as list_name, c.created_at, c.scheduled_at, c.sent_at,
        COUNT(s.id) as total_sends,
        SUM(CASE WHEN s.status = 'sent' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN s.opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
        SUM(CASE WHEN s.clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked,
        SUM(CASE WHEN s.status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN s.unsubscribed_at IS NOT NULL THEN 1 ELSE 0 END) as unsubscribed
      FROM campaigns c
      LEFT JOIN lists l ON l.id = c.list_id AND l.user_id = c.user_id
      LEFT JOIN sends s ON s.campaign_id = c.id
      WHERE c.user_id = ?
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `).all(req.user.id);

    const rows = campaigns.map((campaign) => {
      const delivered = Number(campaign.delivered || 0);
      const opened = Number(campaign.opened || 0);
      const clicked = Number(campaign.clicked || 0);

      return {
        ...campaign,
        total_sends: Number(campaign.total_sends || 0),
        delivered,
        opened,
        clicked,
        failed: Number(campaign.failed || 0),
        unsubscribed: Number(campaign.unsubscribed || 0),
        open_rate: delivered ? `${((opened / delivered) * 100).toFixed(2)}%` : '0.00%',
        click_rate: delivered ? `${((clicked / delivered) * 100).toFixed(2)}%` : '0.00%'
      };
    });

    sendCsv(res, 'campaigns-export.csv', [
      'id', 'name', 'subject', 'status', 'from_name', 'from_email', 'reply_to',
      'list_name', 'created_at', 'scheduled_at', 'sent_at', 'total_sends',
      'delivered', 'opened', 'clicked', 'failed', 'unsubscribed', 'open_rate', 'click_rate'
    ], rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export campaigns' });
  }
});

// POST /api/campaigns
router.post('/', (req, res) => {
  try {
    const db = req.app.locals.db;
    const input = normalizeCampaignInput(req.body);
    const listId = requireOwnedList(db, req.body.list_id, req.user.id);
    const integrationId = requireOwnedIntegration(db, req.body.email_integration_id, req.user.id);

    const result = db.prepare(
      'INSERT INTO campaigns (user_id, name, subject, from_name, from_email, reply_to, html_content, list_id, email_integration_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(req.user.id, input.name, input.subject, input.from_name, input.from_email, input.reply_to, input.html_content, listId || null, integrationId || null);
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(result.lastInsertRowid, req.user.id);
    broadcast('campaigns');
    res.status(201).json(publicCampaign(campaign));
  } catch (err) {
    sendRouteError(res, err, 'Failed to create campaign');
  }
});

// PUT /api/campaigns/:id
router.put('/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const existing = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Campaign not found' });

    const input = normalizeCampaignInput(req.body, existing);
    const listId = req.body.list_id !== undefined ? requireOwnedList(db, req.body.list_id, req.user.id) : existing.list_id;
    const integrationId = req.body.email_integration_id !== undefined
      ? requireOwnedIntegration(db, req.body.email_integration_id, req.user.id)
      : existing.email_integration_id;

    db.prepare(`
      UPDATE campaigns SET name=?, subject=?, from_name=?, from_email=?, reply_to=?, html_content=?, list_id=?, email_integration_id=? WHERE id=? AND user_id=?
    `).run(
      input.name,
      input.subject,
      input.from_name,
      input.from_email,
      input.reply_to,
      input.html_content,
      listId || null,
      integrationId || null,
      req.params.id,
      req.user.id
    );
    const updated = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    broadcast('campaigns');
    res.json(publicCampaign(updated));
  } catch (err) {
    sendRouteError(res, err, 'Failed to update campaign');
  }
});

// DELETE /api/campaigns/:id
router.delete('/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const existing = db.prepare('SELECT id FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Campaign not found' });

    const deleteCampaign = db.transaction(() => {
      db.prepare('DELETE FROM events WHERE send_id IN (SELECT id FROM sends WHERE campaign_id = ?)').run(req.params.id);
      db.prepare('DELETE FROM sends WHERE campaign_id = ?').run(req.params.id);
      db.prepare('DELETE FROM campaigns WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    });

    deleteCampaign();
    broadcast('campaigns');
    res.json({ message: 'Campaign deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

// POST /api/campaigns/:id/send
router.post('/:id/send', sendLimiter, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    if (campaign.status === 'sent') return res.status(400).json({ error: 'Campaign already sent' });
    if (!campaign.list_id) return res.status(400).json({ error: 'Campaign has no list assigned' });

    const list = db.prepare('SELECT id FROM lists WHERE id = ? AND user_id = ?').get(campaign.list_id, req.user.id);
    if (!list) return res.status(400).json({ error: 'Campaign list is not available' });
    if (campaign.email_integration_id) {
      const integration = db.prepare('SELECT id FROM email_integrations WHERE id = ? AND user_id = ?').get(campaign.email_integration_id, req.user.id);
      if (!integration) return res.status(400).json({ error: 'Campaign email sender is not available' });
    }

    const userPlan = db.prepare('SELECT p.recipients_per_day FROM users u JOIN plans p ON p.id = u.plan_id WHERE u.id = ?').get(req.user.id);
    const dailyLimit = userPlan?.recipients_per_day ?? 200;
    if (dailyLimit !== -1) {
      const today = new Date().toISOString().slice(0, 10);
      const dailyRow = db.prepare('SELECT count FROM daily_send_counts WHERE user_id = ? AND date = ?').get(req.user.id, today);
      const dailySent = dailyRow?.count || 0;
      const contactCount = db.prepare(`
        SELECT COUNT(*) as c
        FROM contacts c
        JOIN list_contacts lc ON lc.contact_id = c.id
        WHERE lc.list_id = ? AND c.user_id = ? AND c.status = 'subscribed'
      `).get(campaign.list_id, req.user.id).c;
      if (dailySent + contactCount > dailyLimit) {
        return res.status(429).json({ error: `Daily send limit of ${dailyLimit} reached. You've sent ${dailySent} emails today. Upgrade your plan for more sends.` });
      }
    }

    db.prepare("UPDATE campaigns SET status = 'sending' WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
    const result = await sendCampaignEmail(db, parseInt(req.params.id, 10));
    if (result.sent > 0) {
      const today = new Date().toISOString().slice(0, 10);
      db.prepare('INSERT INTO daily_send_counts (user_id, date, count) VALUES (?, ?, ?) ON CONFLICT(user_id, date) DO UPDATE SET count = count + ?')
        .run(req.user.id, today, result.sent, result.sent);
    }
    broadcast('campaigns');
    res.json({ message: 'Campaign sent', ...result });
  } catch (err) {
    console.error('Send campaign error:', redactSensitive(err));
    res.status(500).json({ error: 'Failed to send campaign' });
  }
});

// POST /api/campaigns/:id/schedule
router.post('/:id/schedule', (req, res) => {
  try {
    const db = req.app.locals.db;
    const { scheduled_at } = req.body;
    if (!scheduled_at) return res.status(400).json({ error: 'scheduled_at is required' });

    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    if (!campaign.list_id) return res.status(400).json({ error: 'Campaign has no list assigned' });
    const list = db.prepare('SELECT id FROM lists WHERE id = ? AND user_id = ?').get(campaign.list_id, req.user.id);
    if (!list) return res.status(400).json({ error: 'Campaign list is not available' });

    db.prepare("UPDATE campaigns SET status = 'scheduled', scheduled_at = ? WHERE id = ? AND user_id = ?").run(sanitizeText(scheduled_at, 80), req.params.id, req.user.id);
    const updated = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    broadcast('campaigns');
    res.json(publicCampaign(updated));
  } catch (err) {
    res.status(500).json({ error: 'Failed to schedule campaign' });
  }
});

// POST /api/campaigns/:id/duplicate
router.post('/:id/duplicate', (req, res) => {
  try {
    const db = req.app.locals.db;
    const original = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!original) return res.status(404).json({ error: 'Campaign not found' });

    const result = db.prepare(
      'INSERT INTO campaigns (user_id, name, subject, from_name, from_email, reply_to, html_content, list_id, email_integration_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      req.user.id, `${original.name} (Copy)`, original.subject, original.from_name,
      original.from_email, original.reply_to, original.html_content, original.list_id, original.email_integration_id, 'draft'
    );
    const dup = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(result.lastInsertRowid, req.user.id);
    broadcast('campaigns');
    res.status(201).json(publicCampaign(dup));
  } catch (err) {
    res.status(500).json({ error: 'Failed to duplicate campaign' });
  }
});

// GET /api/campaigns/:id/stats
router.get('/:id/stats', (req, res) => {
  try {
    const db = req.app.locals.db;
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_sends,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
        SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as bounced,
        SUM(CASE WHEN unsubscribed_at IS NOT NULL THEN 1 ELSE 0 END) as unsubscribed
      FROM sends WHERE campaign_id = ?
    `).get(req.params.id);

    const sends = db.prepare(`
      SELECT s.id, s.campaign_id, s.contact_id, s.status, s.sent_at, s.opened_at, s.clicked_at, s.unsubscribed_at,
             c.email as contact_email, c.first_name, c.last_name
      FROM sends s
      JOIN contacts c ON c.id = s.contact_id
      WHERE s.campaign_id = ? AND c.user_id = ?
      ORDER BY s.sent_at DESC
    `).all(req.params.id, req.user.id);

    res.json({ campaign: publicCampaign(campaign), stats, sends });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch campaign stats' });
  }
});

module.exports = router;