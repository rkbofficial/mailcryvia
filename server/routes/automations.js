const express = require('express');
const { broadcast } = require('../utils/sse');
const { sanitizeText, asPositiveInt } = require('../utils/sanitize');
const router = express.Router();

function publicAutomation(row) {
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

function requireOwnedTemplate(db, value, userId) {
  const id = normalizeNullableId(value);
  if (id === undefined || id === null) return id;
  const row = db.prepare('SELECT id FROM templates WHERE id = ? AND user_id = ?').get(id, userId);
  if (!row) {
    const err = new Error('Template not found');
    err.status = 404;
    throw err;
  }
  return id;
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

function routeError(res, err, fallback) {
  res.status(err.status || 500).json({ error: err.status ? err.message : fallback });
}

// GET /api/automations
router.get('/', (req, res) => {
  try {
    const db = req.app.locals.db;
    const automations = db.prepare(`
      SELECT a.*, t.name as template_name, l.name as list_name
      FROM automations a
      LEFT JOIN templates t ON t.id = a.template_id AND t.user_id = a.user_id
      LEFT JOIN lists l ON l.id = a.list_id AND l.user_id = a.user_id
      WHERE a.user_id = ?
      ORDER BY a.created_at DESC
    `).all(req.user.id).map(publicAutomation);
    res.json(automations);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch automations' });
  }
});

// POST /api/automations
router.post('/', (req, res) => {
  try {
    const db = req.app.locals.db;
    const { trigger_type, active } = req.body;
    const name = sanitizeText(req.body.name, 160);
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const templateId = requireOwnedTemplate(db, req.body.template_id, req.user.id);
    const listId = requireOwnedList(db, req.body.list_id, req.user.id);
    const delayDays = asPositiveInt(req.body.delay_days, 0, { min: 0, max: 365 });

    const result = db.prepare(
      'INSERT INTO automations (user_id, name, trigger_type, delay_days, template_id, list_id, active) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(req.user.id, name, sanitizeText(trigger_type || 'contact_added_to_list', 80), delayDays,
      templateId || null, listId || null, active !== undefined ? (active ? 1 : 0) : 1);

    const automation = db.prepare('SELECT * FROM automations WHERE id = ? AND user_id = ?').get(result.lastInsertRowid, req.user.id);
    broadcast('automations');
    res.status(201).json(publicAutomation(automation));
  } catch (err) {
    routeError(res, err, 'Failed to create automation');
  }
});

// PUT /api/automations/:id
router.put('/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const existing = db.prepare('SELECT * FROM automations WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Automation not found' });

    const name = req.body.name !== undefined ? sanitizeText(req.body.name, 160) : existing.name;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const triggerType = req.body.trigger_type !== undefined ? sanitizeText(req.body.trigger_type, 80) : existing.trigger_type;
    const delayDays = req.body.delay_days !== undefined ? asPositiveInt(req.body.delay_days, existing.delay_days, { min: 0, max: 365 }) : existing.delay_days;
    const templateId = req.body.template_id !== undefined ? requireOwnedTemplate(db, req.body.template_id, req.user.id) : existing.template_id;
    const listId = req.body.list_id !== undefined ? requireOwnedList(db, req.body.list_id, req.user.id) : existing.list_id;
    const active = req.body.active !== undefined ? (req.body.active ? 1 : 0) : existing.active;

    db.prepare(`
      UPDATE automations SET name=?, trigger_type=?, delay_days=?, template_id=?, list_id=?, active=? WHERE id=? AND user_id=?
    `).run(name, triggerType, delayDays, templateId || null, listId || null, active, req.params.id, req.user.id);
    const updated = db.prepare('SELECT * FROM automations WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    broadcast('automations');
    res.json(publicAutomation(updated));
  } catch (err) {
    routeError(res, err, 'Failed to update automation');
  }
});

// DELETE /api/automations/:id
router.delete('/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const existing = db.prepare('SELECT id FROM automations WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Automation not found' });
    db.prepare('DELETE FROM automations WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    broadcast('automations');
    res.json({ message: 'Automation deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete automation' });
  }
});

// POST /api/automations/:id/toggle
router.post('/:id/toggle', (req, res) => {
  try {
    const db = req.app.locals.db;
    const existing = db.prepare('SELECT * FROM automations WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Automation not found' });

    const newActive = existing.active ? 0 : 1;
    db.prepare('UPDATE automations SET active = ? WHERE id = ? AND user_id = ?').run(newActive, req.params.id, req.user.id);
    const updated = db.prepare('SELECT * FROM automations WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    broadcast('automations');
    res.json(publicAutomation(updated));
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle automation' });
  }
});

module.exports = router;