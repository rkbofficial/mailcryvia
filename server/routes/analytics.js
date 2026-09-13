const express = require('express');
const { sendCsv } = require('../utils/csv');
const { redactSensitive } = require('../utils/secrets');
const router = express.Router();

// GET /api/analytics/overview
router.get('/overview', (req, res) => {
  try {
    const db = req.app.locals.db;
    const uid = req.user.id;

    const totalContacts = db.prepare('SELECT COUNT(*) as count FROM contacts WHERE user_id = ?').get(uid).count;
    const campaignsSent = db.prepare("SELECT COUNT(*) as count FROM campaigns WHERE status = 'sent' AND user_id = ?").get(uid).count;

    const sendStats = db.prepare(`
      SELECT
        COUNT(*) as total_sends,
        SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as total_opened,
        SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as total_clicked
      FROM sends
      WHERE status = 'sent'
      AND (campaign_id IN (SELECT id FROM campaigns WHERE user_id = ?)
        OR automation_id IN (SELECT id FROM automations WHERE user_id = ?))
    `).get(uid, uid);

    const avgOpenRate = sendStats.total_sends > 0
      ? ((sendStats.total_opened / sendStats.total_sends) * 100).toFixed(1)
      : '0.0';
    const avgCTR = sendStats.total_sends > 0
      ? ((sendStats.total_clicked / sendStats.total_sends) * 100).toFixed(1)
      : '0.0';

    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const campaignsThisMonth = db.prepare(
      "SELECT COUNT(*) as count FROM campaigns WHERE status='sent' AND sent_at >= ? AND user_id = ?"
    ).get(monthStart.toISOString(), uid).count;

    const contactStatus = db.prepare(
      "SELECT status, COUNT(*) as count FROM contacts WHERE user_id = ? GROUP BY status"
    ).all(uid);
    const subscribedContacts   = contactStatus.find(r => r.status === 'subscribed')?.count   || 0;
    const unsubscribedContacts = contactStatus.find(r => r.status === 'unsubscribed')?.count || 0;

    const bounced = db.prepare(`
      SELECT COUNT(*) as c FROM sends
      WHERE status = 'failed'
      AND (campaign_id IN (SELECT id FROM campaigns WHERE user_id = ?)
        OR automation_id IN (SELECT id FROM automations WHERE user_id = ?))
    `).get(uid, uid).c;

    const unsubscribed = db.prepare(`
      SELECT COUNT(*) as c FROM sends
      WHERE unsubscribed_at IS NOT NULL
      AND (campaign_id IN (SELECT id FROM campaigns WHERE user_id = ?)
        OR automation_id IN (SELECT id FROM automations WHERE user_id = ?))
    `).get(uid, uid).c;

    const deliveryRate = sendStats.total_sends > 0
      ? ((sendStats.total_sends / (sendStats.total_sends + bounced)) * 100).toFixed(1)
      : '100.0';

    res.json({
      totalContacts,
      subscribedContacts,
      unsubscribedContacts,
      campaignsSent,
      campaignsThisMonth,
      avgOpenRate: parseFloat(avgOpenRate),
      avgCTR: parseFloat(avgCTR),
      totalSends: sendStats.total_sends,
      totalOpened: sendStats.total_opened,
      totalClicked: sendStats.total_clicked,
      totalBounced: bounced,
      totalUnsubscribed: unsubscribed,
      deliveryRate: parseFloat(deliveryRate),
    });
  } catch (err) {
    console.error('Overview error:', redactSensitive(err));
    res.status(500).json({ error: 'Failed to fetch analytics overview' });
  }
});

// GET /api/analytics/export
router.get('/export', (req, res) => {
  try {
    const db = req.app.locals.db;
    const uid = req.user.id;
    const campaigns = db.prepare(`
      SELECT c.id, c.name, c.subject, c.status, l.name as list_name,
        c.created_at, c.scheduled_at, c.sent_at,
        COUNT(s.id) as total_sends,
        SUM(CASE WHEN s.status = 'sent' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN s.opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
        SUM(CASE WHEN s.clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked,
        SUM(CASE WHEN s.status = 'failed' THEN 1 ELSE 0 END) as bounced,
        SUM(CASE WHEN s.unsubscribed_at IS NOT NULL THEN 1 ELSE 0 END) as unsubscribed
      FROM campaigns c
      LEFT JOIN lists l ON l.id = c.list_id
      LEFT JOIN sends s ON s.campaign_id = c.id
      WHERE c.user_id = ?
      GROUP BY c.id
      ORDER BY COALESCE(c.sent_at, c.created_at) DESC
    `).all(uid);

    const rows = campaigns.map((campaign) => {
      const delivered = Number(campaign.delivered || 0);
      const opened = Number(campaign.opened || 0);
      const clicked = Number(campaign.clicked || 0);
      const bounced = Number(campaign.bounced || 0);
      const unsubscribed = Number(campaign.unsubscribed || 0);

      return {
        ...campaign,
        total_sends: Number(campaign.total_sends || 0),
        delivered,
        opened,
        clicked,
        bounced,
        unsubscribed,
        open_rate: delivered ? `${((opened / delivered) * 100).toFixed(2)}%` : '0.00%',
        click_rate: delivered ? `${((clicked / delivered) * 100).toFixed(2)}%` : '0.00%',
        bounce_rate: delivered ? `${((bounced / delivered) * 100).toFixed(2)}%` : '0.00%',
        unsubscribe_rate: delivered ? `${((unsubscribed / delivered) * 100).toFixed(2)}%` : '0.00%'
      };
    });

    sendCsv(res, 'analytics-export.csv', [
      'id', 'name', 'subject', 'status', 'list_name', 'created_at',
      'scheduled_at', 'sent_at', 'total_sends', 'delivered', 'opened',
      'clicked', 'bounced', 'unsubscribed', 'open_rate', 'click_rate',
      'bounce_rate', 'unsubscribe_rate'
    ], rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export analytics' });
  }
});

// GET /api/analytics/campaign/:id
router.get('/campaign/:id', (req, res) => {
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

    const events = db.prepare(`
      SELECT e.*, s.contact_id FROM events e
      JOIN sends s ON s.id = e.send_id
      WHERE s.campaign_id = ?
      ORDER BY e.created_at DESC
      LIMIT 100
    `).all(req.params.id);

    res.json({ campaign, stats, events });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch campaign analytics' });
  }
});

// GET /api/analytics/automations — all automations with aggregated send stats
router.get('/automations', (req, res) => {
  try {
    const db = req.app.locals.db;
    const uid = req.user.id;
    const automations = db.prepare(`
      SELECT a.id, a.name, a.trigger_type, a.delay_days, a.active,
        t.name as template_name, l.name as list_name,
        (SELECT COUNT(*) FROM sends WHERE automation_id = a.id) as total_sent,
        (SELECT COUNT(*) FROM sends WHERE automation_id = a.id AND status = 'sent') as delivered,
        (SELECT COUNT(*) FROM sends WHERE automation_id = a.id AND opened_at IS NOT NULL) as opened,
        (SELECT COUNT(*) FROM sends WHERE automation_id = a.id AND clicked_at IS NOT NULL) as clicked,
        (SELECT COUNT(*) FROM sends WHERE automation_id = a.id AND status = 'failed') as bounced,
        (SELECT COUNT(*) FROM sends WHERE automation_id = a.id AND unsubscribed_at IS NOT NULL) as unsubscribed
      FROM automations a
      LEFT JOIN templates t ON t.id = a.template_id
      LEFT JOIN lists l ON l.id = a.list_id
      WHERE a.user_id = ?
      ORDER BY a.created_at DESC
    `).all(uid);
    res.json(automations);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch automation analytics' });
  }
});

// GET /api/analytics/automation/:id — detailed stats for one automation
router.get('/automation/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const automation = db.prepare(`
      SELECT a.*, t.name as template_name, l.name as list_name
      FROM automations a
      LEFT JOIN templates t ON t.id = a.template_id
      LEFT JOIN lists l ON l.id = a.list_id
      WHERE a.id = ? AND a.user_id = ?
    `).get(req.params.id, req.user.id);
    if (!automation) return res.status(404).json({ error: 'Automation not found' });

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_sent,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
        SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as bounced,
        SUM(CASE WHEN unsubscribed_at IS NOT NULL THEN 1 ELSE 0 END) as unsubscribed
      FROM sends WHERE automation_id = ?
    `).get(req.params.id);

    const sends = db.prepare(`
      SELECT s.id, s.automation_id, s.contact_id, s.status, s.sent_at, s.opened_at, s.clicked_at, s.unsubscribed_at, c.email as contact_email, c.first_name, c.last_name
      FROM sends s
      JOIN contacts c ON c.id = s.contact_id
      WHERE s.automation_id = ?
      ORDER BY s.sent_at DESC
    `).all(req.params.id);

    res.json({ automation, stats, sends });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch automation analytics' });
  }
});

// GET /api/analytics/campaigns — all campaigns with stats
router.get('/campaigns', (req, res) => {
  try {
    const db = req.app.locals.db;
    const uid = req.user.id;
    const campaigns = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM sends WHERE campaign_id = c.id) as total_sends,
        (SELECT COUNT(*) FROM sends WHERE campaign_id = c.id AND status = 'sent') as delivered,
        (SELECT COUNT(*) FROM sends WHERE campaign_id = c.id AND opened_at IS NOT NULL) as opened,
        (SELECT COUNT(*) FROM sends WHERE campaign_id = c.id AND clicked_at IS NOT NULL) as clicked,
        (SELECT COUNT(*) FROM sends WHERE campaign_id = c.id AND status = 'failed') as bounced,
        (SELECT COUNT(*) FROM sends WHERE campaign_id = c.id AND unsubscribed_at IS NOT NULL) as unsubscribed
      FROM campaigns c
      WHERE c.user_id = ? AND c.status = 'sent'
      ORDER BY c.sent_at DESC
    `).all(uid);
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch campaign analytics' });
  }
});

module.exports = router;
