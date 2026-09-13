const express = require('express');
const { redactSensitive } = require('../utils/secrets');
const router = express.Router();

// GET /api/plans — public
router.get('/', (req, res) => {
  try {
    const db = req.app.locals.db;
    const plans = db.prepare(`
      SELECT id, name, slug, price_inr, recipients_per_day, max_contacts,
             max_campaigns_per_month, max_email_integrations, features, sort_order
      FROM plans WHERE is_active = 1 ORDER BY sort_order ASC
    `).all();
    res.json(plans.map(p => ({ ...p, features: JSON.parse(p.features || '[]') })));
  } catch (err) {
    console.error('GET /plans error:', redactSensitive(err));
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

module.exports = router;