const express = require('express');
const bcrypt  = require('bcryptjs');
const validator = require('validator');
const rateLimit = require('express-rate-limit');
const router  = express.Router();
const adminOnly = require('../middleware/adminOnly');
const { broadcast } = require('../utils/sse');
const { logActivity } = require('../utils/activityLog');
const { redactSensitive } = require('../utils/secrets');
const { sanitizeText, sanitizeEmail, asPositiveInt } = require('../utils/sanitize');
const { anonymizeUserData } = require('../utils/privacy');

router.use(adminOnly);

const CYCLE_MONTHS = { monthly: 1, biannual: 6, yearly: 12 };
const CYCLE_DISCOUNT = { monthly: 0, biannual: 10, yearly: 20 };
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many password reset attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

function normalizeCycle(value) {
  return CYCLE_MONTHS[value] ? value : 'monthly';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function calcTotal(priceInr, billingCycle) {
  const cycle = normalizeCycle(billingCycle);
  const months = CYCLE_MONTHS[cycle];
  const discount = CYCLE_DISCOUNT[cycle];
  const monthly = Math.round(Number(priceInr || 0) * (1 - discount / 100));
  return { billingCycle: cycle, months, total: Math.max(0, monthly * months) };
}

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  try {
    const db    = req.app.locals.db;
    const today = new Date().toISOString().slice(0, 10);
    const wkAgo = new Date(Date.now() - 7  * 86400000).toISOString().slice(0, 10);
    const moAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    const totalUsers     = db.prepare('SELECT COUNT(*) as c FROM users WHERE deleted_at IS NULL').get().c;
    const totalContacts  = db.prepare('SELECT COUNT(*) as c FROM contacts').get().c;
    const totalLists     = db.prepare('SELECT COUNT(*) as c FROM lists').get().c;
    const totalTemplates = db.prepare('SELECT COUNT(*) as c FROM templates').get().c;
    const totalCampaigns = db.prepare('SELECT COUNT(*) as c FROM campaigns').get().c;
    const activeAutomations = db.prepare("SELECT COUNT(*) as c FROM automations WHERE active=1").get().c;

    const totalRevenue   = db.prepare("SELECT COALESCE(SUM(amount_paid),0) as t FROM subscriptions WHERE amount_paid>0").get().t;
    const paidUsers      = db.prepare("SELECT COUNT(DISTINCT user_id) as c FROM subscriptions WHERE amount_paid>0").get().c;
    // Active paid subs: distinct users with a paid, non-expired subscription
    const activeSubs     = db.prepare("SELECT COUNT(DISTINCT user_id) as c FROM subscriptions WHERE status='active' AND amount_paid>0 AND expires_at > datetime('now')").get().c;
    // MRR: users on a paid plan with a future expiry AND with at least one real paid subscription
    const mrr            = db.prepare(`
      SELECT COALESCE(SUM(p.price_inr),0) as t
      FROM users u JOIN plans p ON u.plan_id=p.id
      WHERE p.price_inr>0 AND u.deleted_at IS NULL
        AND u.plan_expires_at IS NOT NULL AND u.plan_expires_at > CURRENT_TIMESTAMP
        AND EXISTS (
          SELECT 1 FROM subscriptions s
          WHERE s.user_id=u.id AND s.amount_paid>0
            AND s.status='active' AND s.expires_at > datetime('now')
        )
    `).get().t;
    const planBreakdown  = db.prepare('SELECT p.name,p.slug,COUNT(u.id) as count FROM plans p LEFT JOIN users u ON u.plan_id=p.id AND u.deleted_at IS NULL GROUP BY p.id ORDER BY p.sort_order').all();
    const recentSubs     = db.prepare(`
      SELECT s.id,s.status,s.amount_paid,s.created_at,
             u.email, p.name as plan_name, p.slug as plan_slug
      FROM subscriptions s
      JOIN users u ON s.user_id=u.id
      JOIN plans p ON s.plan_id=p.id
      WHERE s.amount_paid > 0
      ORDER BY s.created_at DESC LIMIT 10
    `).all();

    const newUsersToday = db.prepare("SELECT COUNT(*) as c FROM users WHERE deleted_at IS NULL AND date(created_at)>=?").get(today).c;
    const newUsersWeek  = db.prepare("SELECT COUNT(*) as c FROM users WHERE deleted_at IS NULL AND date(created_at)>=?").get(wkAgo).c;
    const newUsersMonth = db.prepare("SELECT COUNT(*) as c FROM users WHERE deleted_at IS NULL AND date(created_at)>=?").get(moAgo).c;

    // Email send stats: separate delivered vs failed vs pending
    let emailsDelivered = 0, emailsFailed = 0, emailsPending = 0;
    try {
      emailsDelivered = db.prepare("SELECT COUNT(*) as c FROM sends WHERE status='sent'").get().c;
      emailsFailed    = db.prepare("SELECT COUNT(*) as c FROM sends WHERE status='failed'").get().c;
      emailsPending   = db.prepare("SELECT COUNT(*) as c FROM sends WHERE status='pending'").get().c;
    } catch (e) {}
    const totalEmailsSent = emailsDelivered;

    res.json({
      totalUsers, totalContacts, totalLists, totalTemplates, totalCampaigns, activeAutomations,
      totalRevenue, paidUsers, activeSubs, mrr,
      planBreakdown, recentSubs,
      newUsersToday, newUsersWeek, newUsersMonth,
      totalEmailsSent, emailsDelivered, emailsFailed, emailsPending,
    });
  } catch (err) {
    console.error(redactSensitive(err));
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── GET /api/admin/revenue ────────────────────────────────────────────────────
router.get('/revenue', (req, res) => {
  try {
    const db = req.app.locals.db;

    const monthlyRevenue = db.prepare(`
      SELECT strftime('%Y-%m',created_at) as month,
             COALESCE(SUM(amount_paid),0) as revenue,
             COUNT(*) as transactions
      FROM subscriptions WHERE amount_paid>0
      GROUP BY strftime('%Y-%m',created_at)
      ORDER BY month DESC LIMIT 12
    `).all().reverse();

    const revenueByPlan = db.prepare(`
      SELECT p.name,p.slug,COALESCE(SUM(s.amount_paid),0) as total,COUNT(s.id) as count
      FROM subscriptions s JOIN plans p ON s.plan_id=p.id
      WHERE s.amount_paid>0
      GROUP BY s.plan_id ORDER BY total DESC
    `).all();

    const mrr = db.prepare(`
      SELECT COALESCE(SUM(p.price_inr),0) as t
      FROM users u JOIN plans p ON u.plan_id=p.id
      WHERE p.price_inr>0 AND u.deleted_at IS NULL
        AND u.plan_expires_at IS NOT NULL AND u.plan_expires_at > CURRENT_TIMESTAMP
        AND EXISTS (
          SELECT 1 FROM subscriptions s
          WHERE s.user_id=u.id AND s.amount_paid>0
            AND s.status='active' AND s.expires_at > datetime('now')
        )
    `).get().t;

    const userGrowth = db.prepare(`
      SELECT strftime('%Y-%m',created_at) as month, COUNT(*) as count
      FROM users GROUP BY strftime('%Y-%m',created_at)
      ORDER BY month DESC LIMIT 12
    `).all().reverse();

    const avgRow = db.prepare("SELECT COALESCE(AVG(amount_paid),0) as avg FROM subscriptions WHERE amount_paid>0").get();

    res.json({ monthlyRevenue, revenueByPlan, mrr, arr: mrr * 12, userGrowth,
               avgTransaction: Math.round(avgRow.avg || 0) });
  } catch (err) {
    console.error(redactSensitive(err));
    res.status(500).json({ error: 'Failed to fetch revenue' });
  }
});

// ── GET /api/admin/subscriptions ──────────────────────────────────────────────
router.get('/subscriptions', (req, res) => {
  try {
    const db     = req.app.locals.db;
    const page   = asPositiveInt(req.query.page, 1, { min: 1, max: 100000 });
    const limit  = asPositiveInt(req.query.limit, 30, { min: 1, max: 100 });
    const status = req.query.status || '';
    const offset = (page - 1) * limit;

    let where, params;
    if (status === 'upcoming') {
      // Active subs expiring within next 30 days
      const in30 = new Date(Date.now() + 30 * 86400000).toISOString();
      where  = "WHERE s.status='active' AND s.expires_at IS NOT NULL AND s.expires_at <= ?";
      params = [in30];
    } else if (status) {
      where  = 'WHERE s.status=?';
      params = [status];
    } else {
      where  = '';
      params = [];
    }

    const total = db.prepare(`SELECT COUNT(*) as c FROM subscriptions s ${where}`).get(...params).c;
    const subscriptions = db.prepare(`
      SELECT s.id,s.status,s.amount_paid,s.started_at,s.expires_at,s.created_at,
             s.razorpay_payment_id,
             u.email,u.name,
             p.name as plan_name,p.slug as plan_slug
      FROM subscriptions s
      JOIN users u ON s.user_id=u.id
      JOIN plans p ON s.plan_id=p.id
      ${where}
      ORDER BY s.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    res.json({ subscriptions, total, page, limit });
  } catch (err) {
    console.error(redactSensitive(err));
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// ── GET /api/admin/users ──────────────────────────────────────────────────────
router.get('/users', (req, res) => {
  try {
    const db     = req.app.locals.db;
    const page   = asPositiveInt(req.query.page, 1, { min: 1, max: 100000 });
    const limit  = asPositiveInt(req.query.limit, 20, { min: 1, max: 100 });
    const q      = sanitizeText(req.query.q || '', 120);
    const offset = (page - 1) * limit;

    const showDeleted = req.query.show_deleted === 'true';
    const baseWhere = showDeleted ? '' : 'AND u.deleted_at IS NULL';
    const where  = q ? `WHERE (u.email LIKE ? OR u.name LIKE ?) ${baseWhere}` : (showDeleted ? '' : 'WHERE u.deleted_at IS NULL');
    const params = q ? [`%${q}%`, `%${q}%`] : [];

    const total = db.prepare(`SELECT COUNT(*) as c FROM users u ${where}`).get(...params).c;
    const users = db.prepare(`
      SELECT u.id,u.email,u.name,u.role,u.plan_id,u.plan_expires_at,u.created_at,u.deleted_at,
             p.name as plan_name,p.slug as plan_slug,p.price_inr,
             (SELECT COUNT(*) FROM subscriptions s WHERE s.user_id=u.id AND s.amount_paid>0) as paid_subs
      FROM users u LEFT JOIN plans p ON u.plan_id=p.id
      ${where}
      ORDER BY u.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    res.json({ users, total, page, limit });
  } catch (err) {
    console.error(redactSensitive(err));
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ── GET /api/admin/users/:id ──────────────────────────────────────────────────
router.get('/users/:id', (req, res) => {
  try {
    const db   = req.app.locals.db;
    const user = db.prepare(`
      SELECT u.*,p.name as plan_name,p.slug as plan_slug
      FROM users u LEFT JOIN plans p ON u.plan_id=p.id WHERE u.id=?
    `).get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const subs = db.prepare('SELECT s.id, s.plan_id, s.status, s.razorpay_order_id, s.razorpay_payment_id, s.amount_paid, s.started_at, s.expires_at, s.created_at, p.name as plan_name FROM subscriptions s JOIN plans p ON s.plan_id=p.id WHERE s.user_id=? ORDER BY s.created_at DESC').all(req.params.id);
    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser, subscriptions: subs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ── PUT /api/admin/users/:id ──────────────────────────────────────────────────
router.put('/users/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const { name, role, plan_id } = req.body;
    if (role !== undefined && !['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (role && role !== 'admin') {
      const target = db.prepare('SELECT role FROM users WHERE id=?').get(req.params.id);
      if (target?.role === 'admin') {
        const adminCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='admin'").get().c;
        if (adminCount <= 1) return res.status(400).json({ error: 'Cannot demote the only admin' });
      }
    }

    const updates = [], vals = [];
    if (name    !== undefined) { updates.push('name=?');    vals.push(sanitizeText(name, 160)); }
    if (role    !== undefined) { updates.push('role=?');    vals.push(role); }
    if (plan_id !== undefined) {
      const safePlanId = parseInt(plan_id, 10);
      if (!Number.isInteger(safePlanId) || safePlanId < 1 || !db.prepare('SELECT id FROM plans WHERE id=?').get(safePlanId)) {
        return res.status(400).json({ error: 'Invalid plan' });
      }
      const currentUser = db.prepare('SELECT plan_id FROM users WHERE id=?').get(req.params.id);
      updates.push('plan_id=?'); vals.push(safePlanId);
      // If plan changed directly (no payment flow), clear expiry so it isn't counted in MRR
      if (!currentUser || safePlanId !== currentUser.plan_id) {
        updates.push('plan_expires_at=?'); vals.push(null);
      }
    }
    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(req.params.id);
    db.prepare(`UPDATE users SET ${updates.join(',')} WHERE id=?`).run(...vals);
    const updTarget = db.prepare('SELECT email FROM users WHERE id=?').get(req.params.id);
    logActivity(db, { type: 'user_updated', actorEmail: req.user.email, targetEmail: updTarget?.email, detail: { changes: Object.fromEntries(updates.map((u, i) => [u.split('=')[0], vals[i]])) } });
    broadcast('admin');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ── PUT /api/admin/users/:id/reset-password ───────────────────────────────────
router.put('/users/:id/reset-password', passwordResetLimiter, (req, res) => {
  try {
    const db = req.app.locals.db;
    const { password } = req.body;
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const hash = bcrypt.hashSync(password, 12);
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, req.params.id);
    broadcast('admin');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ── POST /api/admin/users ─────────────────────────────────────────────────────
router.post('/users', (req, res) => {
  try {
    const db = req.app.locals.db;
    const { email, password, name, role = 'user', plan_id = 1 } = req.body;
    const normalEmail = sanitizeEmail(email);
    const displayName = sanitizeText(name || '', 160);
    if (!normalEmail || !password) return res.status(400).json({ error: 'Email and password are required' });
    if (!validator.isEmail(normalEmail)) return res.status(400).json({ error: 'Valid email is required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const safeRole = role === 'admin' ? 'admin' : 'user';
    const planId = parseInt(plan_id, 10) || 1;
    const hash   = bcrypt.hashSync(password, 12);
    const result = db.prepare('INSERT INTO users (email,password_hash,name,role,plan_id) VALUES (?,?,?,?,?)').run(normalEmail, hash, displayName, safeRole, planId);
    logActivity(db, { type: 'user_created', actorEmail: req.user.email, targetEmail: normalEmail, detail: { role: safeRole, plan_id: planId } });
    broadcast('admin');
    res.json({ id: result.lastInsertRowid, email: normalEmail, name: displayName, role: safeRole, plan_id: planId });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// ── DELETE /api/admin/users/:id ───────────────────────────────────────────────
router.delete('/users/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
    const delTarget = db.prepare('SELECT email FROM users WHERE id=?').get(req.params.id);
    anonymizeUserData(db, parseInt(req.params.id, 10), delTarget?.email);
    logActivity(db, { type: 'user_deleted', actorEmail: req.user.email, targetEmail: delTarget?.email });
    broadcast('admin');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ── GET /api/admin/users/:id/history — full account timeline ──────────────────
router.get('/users/:id/history', (req, res) => {
  try {
    const db   = req.app.locals.db;
    const user = db.prepare(`
      SELECT u.id,u.email,u.name,u.role,u.plan_id,u.plan_expires_at,u.created_at,u.deleted_at,
             p.name as plan_name, p.slug as plan_slug
      FROM users u LEFT JOIN plans p ON u.plan_id=p.id
      WHERE u.id=?
    `).get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const subscriptions = db.prepare(`
      SELECT s.*, p.name as plan_name, p.slug as plan_slug
      FROM subscriptions s LEFT JOIN plans p ON s.plan_id=p.id
      WHERE s.user_id=? ORDER BY s.created_at DESC
    `).all(req.params.id);

    const paymentRequests = db.prepare(`
      SELECT pr.*, p.name as plan_name, p.slug as plan_slug
      FROM payment_requests pr LEFT JOIN plans p ON pr.plan_id=p.id
      WHERE pr.user_id=? ORDER BY pr.created_at DESC
    `).all(req.params.id);

    res.json({ user, subscriptions, paymentRequests });
  } catch (err) {
    console.error(redactSensitive(err));
    res.status(500).json({ error: 'Failed to fetch user history' });
  }
});

// ── GET /api/admin/plans ──────────────────────────────────────────────────────
router.get('/plans', (req, res) => {
  try {
    const db    = req.app.locals.db;
    const plans = db.prepare('SELECT * FROM plans ORDER BY sort_order ASC').all();
    res.json(plans.map(p => ({ ...p, features: JSON.parse(p.features || '[]') })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// ── PUT /api/admin/plans/:id ──────────────────────────────────────────────────
router.put('/plans/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const { price_inr, recipients_per_day, max_contacts, max_campaigns_per_month, max_email_integrations, features, is_active } = req.body;

    const updates = [], vals = [];
    if (price_inr                !== undefined) { updates.push('price_inr=?');                vals.push(parseInt(price_inr) || 0); }
    if (recipients_per_day       !== undefined) { updates.push('recipients_per_day=?');       vals.push(parseInt(recipients_per_day) || -1); }
    if (max_contacts             !== undefined) { updates.push('max_contacts=?');             vals.push(parseInt(max_contacts) || -1); }
    if (max_campaigns_per_month  !== undefined) { updates.push('max_campaigns_per_month=?');  vals.push(parseInt(max_campaigns_per_month) || -1); }
    if (max_email_integrations   !== undefined) { updates.push('max_email_integrations=?');   vals.push(parseInt(max_email_integrations) || -1); }
    if (features                 !== undefined) { updates.push('features=?');                 vals.push(JSON.stringify(features)); }
    if (is_active                !== undefined) { updates.push('is_active=?');                vals.push(is_active ? 1 : 0); }

    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(req.params.id);
    db.prepare(`UPDATE plans SET ${updates.join(',')} WHERE id=?`).run(...vals);
    broadcast('admin');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

// ── GET /api/admin/payment-requests ──────────────────────────────────────────
router.get('/payment-requests', (req, res) => {
  try {
    const db     = req.app.locals.db;
    const page   = asPositiveInt(req.query.page, 1, { min: 1, max: 100000 });
    const limit  = asPositiveInt(req.query.limit, 30, { min: 1, max: 100 });
    const status = req.query.status || '';
    const offset = (page - 1) * limit;

    const where  = status ? 'WHERE pr.status=?' : '';
    const params = status ? [status] : [];

    const total = db.prepare(`SELECT COUNT(*) as c FROM payment_requests pr ${where}`).get(...params).c;
    const requests = db.prepare(`
      SELECT pr.*,
             u.email, u.name as user_name,
             p.name as plan_name, p.slug as plan_slug
      FROM payment_requests pr
      JOIN users u ON pr.user_id=u.id
      JOIN plans p ON pr.plan_id=p.id
      ${where}
      ORDER BY pr.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const pendingCount = db.prepare("SELECT COUNT(*) as c FROM payment_requests WHERE status='pending'").get().c;
    res.json({ requests, total, page, limit, pendingCount });
  } catch (err) {
    console.error(redactSensitive(err));
    res.status(500).json({ error: 'Failed to fetch payment requests' });
  }
});

// ── PUT /api/admin/payment-requests/:id/approve ───────────────────────────────
router.put('/payment-requests/:id/approve', (req, res) => {
  try {
    const db      = req.app.locals.db;
    const request = db.prepare('SELECT * FROM payment_requests WHERE id=?').get(req.params.id);
    if (!request)                      return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending')  return res.status(400).json({ error: 'Request already processed' });

    const plan = db.prepare('SELECT * FROM plans WHERE id=?').get(request.plan_id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const { billingCycle, months, total } = calcTotal(plan.price_inr, request.billing_cycle);
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + months);

    const txn = db.transaction(() => {
      db.prepare(`UPDATE payment_requests SET status='approved', amount=?, billing_cycle=?, processed_at=CURRENT_TIMESTAMP WHERE id=?`).run(total, billingCycle, request.id);
      db.prepare(`INSERT INTO subscriptions (user_id,plan_id,status,amount_paid,started_at,expires_at) VALUES (?,?,'active',?,CURRENT_TIMESTAMP,?)`).run(request.user_id, plan.id, total, expiresAt.toISOString());
      db.prepare('UPDATE users SET plan_id=?,plan_expires_at=? WHERE id=?').run(plan.id, expiresAt.toISOString(), request.user_id);
    });
    txn();
    logActivity(db, { type: 'payment_approved', detail: { user_id: request.user_id, plan: plan.name, amount: total, billing_cycle: billingCycle } });
    broadcast('admin');
    broadcast('billing');
    res.json({ success: true });
  } catch (err) {
    console.error(redactSensitive(err));
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

// ── PUT /api/admin/payment-requests/:id/reject ────────────────────────────────
router.put('/payment-requests/:id/reject', (req, res) => {
  try {
    const db      = req.app.locals.db;
    const { admin_note } = req.body;
    const request = db.prepare('SELECT * FROM payment_requests WHERE id=?').get(req.params.id);
    if (!request)                     return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'Request already processed' });

    db.prepare(`UPDATE payment_requests SET status='rejected',admin_note=?,processed_at=CURRENT_TIMESTAMP WHERE id=?`).run(admin_note || '', request.id);
    const rejPlan = db.prepare('SELECT name FROM plans WHERE id=?').get(request.plan_id);
    logActivity(db, { type: 'payment_rejected', detail: { user_id: request.user_id, plan: rejPlan?.name, amount: request.amount } });
    broadcast('admin');
    broadcast('billing');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

// ── POST /api/admin/payment-requests/:id/remind — send payment reminder ──────
router.post('/payment-requests/:id/remind', async (req, res) => {
  try {
    const db      = req.app.locals.db;
    const request = db.prepare(`
      SELECT pr.*, u.email, u.name as user_name, p.name as plan_name
      FROM payment_requests pr
      JOIN users u ON pr.user_id=u.id
      JOIN plans p ON pr.plan_id=p.id
      WHERE pr.id=?
    `).get(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });

    const { createTransporter, getSmtpSettings } = require('../utils/email');
    const smtp = getSmtpSettings(db);
    if (!smtp) return res.status(503).json({ error: 'SMTP not configured — set up email settings first' });

    const transporter = createTransporter(smtp);
    await transporter.sendMail({
      from:    `"MailcryVia" <${smtp.from_email || smtp.smtp_username}>`,
      to:      request.email,
      subject: `Payment Reminder — ${sanitizeText(request.plan_name, 120)} Plan`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px 24px;background:#0f0f1a;color:#e5e7eb;border-radius:16px">
          <h2 style="color:#8b5cf6;margin:0 0 8px">Payment Reminder</h2>
          <p style="color:#9ca3af;margin:0 0 24px;font-size:14px">Hi ${escapeHtml(request.user_name || request.email)},</p>
          <p style="font-size:15px;line-height:1.6">Your payment for the <strong style="color:#fff">${escapeHtml(request.plan_name)} Plan</strong> is pending verification.</p>
          <div style="background:#1c1c2e;border:1px solid rgba(139,92,246,0.2);border-radius:12px;padding:20px;margin:24px 0">
            <p style="margin:0 0 8px;font-size:13px;color:#9ca3af">Amount: <strong style="color:#8b5cf6">₹${(request.amount || 0).toLocaleString('en-IN')}</strong></p>
            <p style="margin:0 0 8px;font-size:13px;color:#9ca3af">Method: <strong style="color:#e5e7eb">${escapeHtml((request.payment_method || 'UPI').toUpperCase())}</strong></p>
            ${request.transaction_id ? `<p style="margin:0;font-size:13px;color:#9ca3af">Transaction ID: <strong style="color:#e5e7eb;font-family:monospace">${escapeHtml(request.transaction_id)}</strong></p>` : ''}
          </div>
          <p style="font-size:14px;color:#9ca3af;line-height:1.6">If you have already made the payment, please ensure the transaction ID is correct. Our team will verify and activate your plan shortly.</p>
          <p style="font-size:13px;color:#6b7280;margin-top:32px">— MailcryVia Team</p>
        </div>
      `,
    });

    db.prepare('UPDATE payment_requests SET reminder_sent_at=CURRENT_TIMESTAMP WHERE id=?').run(request.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Reminder error:', redactSensitive(err));
    res.status(500).json({ error: 'Failed to send reminder' });
  }
});

// ── PUT /api/admin/users/:id/plan — direct plan change without payment ─────────
router.put('/users/:id/plan', (req, res) => {
  try {
    const db  = req.app.locals.db;
    const { plan_id, billing_cycle } = req.body;

    const user = db.prepare('SELECT id, plan_id FROM users WHERE id=?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const plan = db.prepare('SELECT * FROM plans WHERE id=?').get(plan_id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    let expiresAt = null;
    if (plan.price_inr > 0) {
      const d      = new Date();
      const months = billing_cycle === 'yearly' ? 12 : billing_cycle === 'biannual' ? 6 : 1;
      d.setMonth(d.getMonth() + months);
      expiresAt = d.toISOString();
    }

    const txn = db.transaction(() => {
      db.prepare('UPDATE users SET plan_id=?,plan_expires_at=? WHERE id=?').run(plan.id, expiresAt, user.id);
      // Only record a new subscription entry when the plan is actually changing
      if (user.plan_id !== plan.id) {
        db.prepare(`INSERT INTO subscriptions (user_id,plan_id,status,amount_paid,started_at,expires_at) VALUES (?,?,'active',0,CURRENT_TIMESTAMP,?)`).run(user.id, plan.id, expiresAt);
      }
    });
    txn();
    logActivity(db, { type: 'plan_changed', detail: { user_id: user.id, plan: plan.name, billing_cycle: billing_cycle || 'admin_override' } });
    broadcast('admin');
    broadcast('billing');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change user plan' });
  }
});

// ── GET /api/admin/activity ───────────────────────────────────────────────────
router.get('/activity', (req, res) => {
  try {
    const db    = req.app.locals.db;
    const limit = asPositiveInt(req.query.limit, 50, { min: 1, max: 100 });
    const rows  = db.prepare(
      'SELECT * FROM admin_activity_log ORDER BY created_at DESC LIMIT ?'
    ).all(limit);
    res.json(rows.map(r => ({ ...r, detail: JSON.parse(r.detail || '{}') })));
  } catch (err) {
    console.error(redactSensitive(err));
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});

module.exports = router;
