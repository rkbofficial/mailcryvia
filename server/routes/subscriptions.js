const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { broadcast } = require('../utils/sse');
const { logActivity } = require('../utils/activityLog');
const { redactSensitive } = require('../utils/secrets');
const { sanitizeText } = require('../utils/sanitize');
const router = express.Router();

const CYCLE_MONTHS = { monthly: 1, biannual: 6, yearly: 12 };
const CYCLE_DISCOUNT = { monthly: 0, biannual: 10, yearly: 20 };
const paymentRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many payment requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

function getRazorpayKeys(db) {
  try {
    const { decrypt } = require('../utils/crypto');
    const keyId = db?.prepare("SELECT value FROM settings WHERE key = 'razorpay_key_id'").get()?.value
                  || process.env.RAZORPAY_KEY_ID || '';
    const secretEnc = db?.prepare("SELECT value FROM settings WHERE key = 'razorpay_key_secret'").get()?.value;
    const keySecret = secretEnc ? decrypt(secretEnc) : (process.env.RAZORPAY_KEY_SECRET || '');
    return { keyId, keySecret };
  } catch (_) {
    return { keyId: process.env.RAZORPAY_KEY_ID || '', keySecret: process.env.RAZORPAY_KEY_SECRET || '' };
  }
}

function getRazorpay(db) {
  const { keyId, keySecret } = getRazorpayKeys(db);
  if (!keyId || !keySecret) return null;
  try {
    const Razorpay = require('razorpay');
    return new Razorpay({ key_id: keyId, key_secret: keySecret });
  } catch (_) { return null; }
}

function normalizeCycle(value) {
  return CYCLE_MONTHS[value] ? value : 'monthly';
}

function calcTotal(priceInr, billingCycle) {
  const cycle = normalizeCycle(billingCycle);
  const months = CYCLE_MONTHS[cycle];
  const discount = CYCLE_DISCOUNT[cycle];
  const monthly = Math.round(Number(priceInr || 0) * (1 - discount / 100));
  return { billingCycle: cycle, months, monthly, total: Math.max(0, monthly * months) };
}

function parseFeatures(plan) {
  return plan ? { ...plan, features: JSON.parse(plan.features || '[]') } : null;
}

router.get('/current', (req, res) => {
  try {
    const db = req.app.locals.db;
    const user = db.prepare('SELECT id, email, name, role, plan_id, plan_expires_at, created_at FROM users WHERE id = ?').get(req.user.id);
    const plan = db.prepare('SELECT id, name, slug, price_inr, recipients_per_day, max_contacts, max_campaigns_per_month, max_email_integrations, features FROM plans WHERE id = ?').get(user.plan_id || 1);
    const history = db.prepare(`
      SELECT s.id, s.plan_id, s.status, s.amount_paid, s.started_at, s.expires_at, s.created_at,
             s.razorpay_order_id, s.razorpay_payment_id, p.name as plan_name, p.price_inr
      FROM subscriptions s LEFT JOIN plans p ON s.plan_id = p.id
      WHERE s.user_id = ? ORDER BY s.created_at DESC LIMIT 10
    `).all(req.user.id);

    const today = new Date().toISOString().slice(0, 10);
    const dailyRow = db.prepare('SELECT count FROM daily_send_counts WHERE user_id = ? AND date = ?').get(req.user.id, today);

    res.json({ user, plan: parseFeatures(plan), history, dailySent: dailyRow?.count || 0 });
  } catch (err) {
    console.error('Subscription fetch error:', redactSensitive(err));
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

router.post('/create-order', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const planId = parseInt(req.body.plan_id, 10);
    const billingCycle = normalizeCycle(req.body.billing_cycle);
    const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND is_active = 1').get(planId);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (plan.price_inr === 0) return res.status(400).json({ error: 'Free plan does not require payment' });

    const razorpay = getRazorpay(db);
    if (!razorpay) return res.status(503).json({ error: 'Payment gateway not configured' });

    const { keyId } = getRazorpayKeys(db);
    const { months, total } = calcTotal(plan.price_inr, billingCycle);
    const order = await razorpay.orders.create({
      amount: total * 100,
      currency: 'INR',
      receipt: `sub_${req.user.id}_${Date.now()}`,
      notes: { user_id: String(req.user.id), plan_id: String(plan.id), billing_cycle: billingCycle, months: String(months) },
    });

    db.prepare(`
      INSERT INTO payment_orders (order_id, user_id, plan_id, billing_cycle, amount, status)
      VALUES (?, ?, ?, ?, ?, 'created')
      ON CONFLICT(order_id) DO UPDATE SET user_id=excluded.user_id, plan_id=excluded.plan_id, billing_cycle=excluded.billing_cycle, amount=excluded.amount, status='created'
    `).run(order.id, req.user.id, plan.id, billingCycle, total);

    res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
      plan: parseFeatures(plan),
      billing_cycle: billingCycle,
      months,
      total_amount: total,
    });
  } catch (err) {
    console.error('Create order error:', redactSensitive(err));
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

router.post('/verify', (req, res) => {
  try {
    const db = req.app.locals.db;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Payment verification details are required' });
    }

    const orderRecord = db.prepare(`
      SELECT order_id, user_id, plan_id, billing_cycle, amount, status FROM payment_orders WHERE order_id = ? AND user_id = ? AND status = 'created'
    `).get(razorpay_order_id, req.user.id);
    if (!orderRecord) return res.status(400).json({ error: 'Payment order not found or already processed' });

    const { keySecret } = getRazorpayKeys(db);
    if (!keySecret) return res.status(503).json({ error: 'Payment gateway not configured' });

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSig = crypto.createHmac('sha256', keySecret).update(body).digest('hex');
    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(orderRecord.plan_id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const { months, total } = calcTotal(plan.price_inr, orderRecord.billing_cycle);
    if (total !== orderRecord.amount) return res.status(400).json({ error: 'Payment amount mismatch' });

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + months);

    const txn = db.transaction(() => {
      db.prepare(`UPDATE payment_orders SET status='verified', razorpay_payment_id=?, verified_at=CURRENT_TIMESTAMP WHERE id=?`).run(razorpay_payment_id, orderRecord.id);
      db.prepare(`INSERT INTO subscriptions (user_id, plan_id, status, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount_paid, expires_at) VALUES (?,?,?,?,?,?,?,?)`)
        .run(req.user.id, plan.id, 'active', razorpay_order_id, razorpay_payment_id, null, total, expiresAt.toISOString());
      db.prepare('UPDATE users SET plan_id = ?, plan_expires_at = ? WHERE id = ?')
        .run(plan.id, expiresAt.toISOString(), req.user.id);
    });
    txn();

    const updatedUser = db.prepare('SELECT id, email, name, role, plan_id, plan_expires_at FROM users WHERE id = ?').get(req.user.id);
    logActivity(db, { type: 'payment_verified', detail: { user_id: updatedUser?.id, plan: plan.name, amount: total, billing_cycle: orderRecord.billing_cycle } });
    broadcast('billing');
    res.json({ success: true, user: updatedUser, plan: parseFeatures(plan) });
  } catch (err) {
    console.error('Verify payment error:', redactSensitive(err));
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

router.post('/request', paymentRequestLimiter, (req, res) => {
  try {
    const db = req.app.locals.db;
    const planId = parseInt(req.body.plan_id, 10);
    const billingCycle = normalizeCycle(req.body.billing_cycle);
    const { transaction_id, payment_method, note } = req.body;

    if (!planId) return res.status(400).json({ error: 'Plan is required' });
    if (!transaction_id || !String(transaction_id).trim()) return res.status(400).json({ error: 'Transaction ID / UTR number is required' });

    const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND is_active = 1').get(planId);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (plan.price_inr === 0) return res.status(400).json({ error: 'Free plan does not require payment' });

    const existing = db.prepare(`SELECT id FROM payment_requests WHERE user_id = ? AND plan_id = ? AND status = 'pending'`).get(req.user.id, planId);
    if (existing) return res.status(409).json({ error: 'You already have a pending request for this plan' });

    const { total } = calcTotal(plan.price_inr, billingCycle);
    const result = db.prepare(`
      INSERT INTO payment_requests (user_id, plan_id, billing_cycle, amount, transaction_id, payment_method, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, planId, billingCycle, total, sanitizeText(transaction_id, 120), sanitizeText(payment_method || 'upi', 40), sanitizeText(note || '', 1000));

    logActivity(db, { type: 'payment_submitted', detail: { user_id: req.user.id, plan: plan.name, amount: total, method: sanitizeText(payment_method || 'upi', 40), billing_cycle: billingCycle } });
    broadcast('billing');
    res.status(201).json({ success: true, request_id: result.lastInsertRowid, amount: total });
  } catch (err) {
    console.error('Payment request error:', redactSensitive(err));
    res.status(500).json({ error: 'Failed to submit payment request' });
  }
});

router.get('/my-requests', (req, res) => {
  try {
    const db = req.app.locals.db;
    const requests = db.prepare(`
      SELECT pr.id, pr.plan_id, pr.billing_cycle, pr.amount, pr.payment_method, pr.status, pr.created_at, pr.processed_at,
             p.name as plan_name, p.slug as plan_slug, p.price_inr
      FROM payment_requests pr
      JOIN plans p ON pr.plan_id = p.id
      WHERE pr.user_id = ?
      ORDER BY pr.created_at DESC
    `).all(req.user.id);
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payment requests' });
  }
});

router.post('/activate-free', (req, res) => {
  try {
    const db = req.app.locals.db;
    const freePlan = db.prepare("SELECT * FROM plans WHERE slug = 'free'").get();
    if (!freePlan) return res.status(404).json({ error: 'Free plan not found' });
    db.prepare('UPDATE users SET plan_id = ?, plan_expires_at = NULL WHERE id = ?').run(freePlan.id, req.user.id);
    const existing = db.prepare(`SELECT id FROM subscriptions WHERE user_id=? AND plan_id=? AND status='active'`).get(req.user.id, freePlan.id);
    if (!existing) {
      db.prepare(`INSERT INTO subscriptions (user_id, plan_id, status, amount_paid) VALUES (?,?,?,?)`)
        .run(req.user.id, freePlan.id, 'active', 0);
    }
    broadcast('billing');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to activate free plan' });
  }
});

module.exports = router;