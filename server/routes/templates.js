const express = require('express');
const { sendCsv } = require('../utils/csv');
const { broadcast } = require('../utils/sse');
const { sanitizeText, sanitizeHtml } = require('../utils/sanitize');
const router = express.Router();

function publicTemplate(row) {
  if (!row) return null;
  const { user_id, ...safe } = row;
  return safe;
}

// GET /api/templates
router.get('/', (req, res) => {
  try {
    const db = req.app.locals.db;
    const templates = db.prepare('SELECT id, name, subject, html_content, blocks_json, created_at FROM templates WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// GET /api/templates/export
router.get('/export', (req, res) => {
  try {
    const db = req.app.locals.db;
    const templates = db.prepare(`
      SELECT id, name, subject, html_content, created_at
      FROM templates WHERE user_id = ? ORDER BY created_at DESC
    `).all(req.user.id);
    sendCsv(res, 'templates-export.csv', ['id', 'name', 'subject', 'html_content', 'created_at'], templates);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export templates' });
  }
});

// GET /api/templates/:id
router.get('/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const template = db.prepare('SELECT id, name, subject, html_content, blocks_json, created_at FROM templates WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// POST /api/templates
router.post('/', (req, res) => {
  try {
    const db = req.app.locals.db;
    const { blocks_json } = req.body;
    const name = sanitizeText(req.body.name, 160);
    const subject = sanitizeText(req.body.subject || '', 255);
    const htmlContent = sanitizeHtml(req.body.html_content || '');
    if (!name) return res.status(400).json({ error: 'Template name is required' });

    const result = db.prepare(
      'INSERT INTO templates (user_id, name, subject, html_content, blocks_json) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.id, name, subject, htmlContent, blocks_json || null);

    const template = db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?').get(result.lastInsertRowid, req.user.id);
    broadcast('templates');
    res.status(201).json(publicTemplate(template));
  } catch (err) {
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// PUT /api/templates/:id
router.put('/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const { blocks_json } = req.body;
    const existing = db.prepare('SELECT id FROM templates WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Template not found' });

    db.prepare(
      'UPDATE templates SET name = ?, subject = ?, html_content = ?, blocks_json = ? WHERE id = ? AND user_id = ?'
    ).run(
      sanitizeText(req.body.name || '', 160),
      sanitizeText(req.body.subject || '', 255),
      sanitizeHtml(req.body.html_content || ''),
      blocks_json !== undefined ? blocks_json : null,
      req.params.id,
      req.user.id
    );

    const updated = db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    broadcast('templates');
    res.json(publicTemplate(updated));
  } catch (err) {
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// DELETE /api/templates/:id
router.delete('/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const existing = db.prepare('SELECT id FROM templates WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Template not found' });

    const deleteTemplate = db.transaction(() => {
      db.prepare('UPDATE automations SET template_id = NULL WHERE template_id = ? AND user_id = ?').run(req.params.id, req.user.id);
      db.prepare('DELETE FROM templates WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    });

    deleteTemplate();
    broadcast('templates');
    res.json({ message: 'Template deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

module.exports = router;