const express = require('express');
const validator = require('validator');
const { sendCsv } = require('../utils/csv');
const { broadcast } = require('../utils/sse');
const router = express.Router();

// GET /api/lists
router.get('/', (req, res) => {
  try {
    const db = req.app.locals.db;
    const lists = db.prepare(`
      SELECT l.*,
        (SELECT COUNT(*) FROM list_contacts WHERE list_id = l.id) as contact_count
      FROM lists l WHERE l.user_id = ? ORDER BY l.created_at DESC
    `).all(req.user.id);
    res.json(lists);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch lists' });
  }
});

// GET /api/lists/export
router.get('/export', (req, res) => {
  try {
    const db = req.app.locals.db;
    const lists = db.prepare(`
      SELECT l.id, l.name, l.description, l.created_at, COUNT(lc.contact_id) as contact_count
      FROM lists l
      LEFT JOIN list_contacts lc ON lc.list_id = l.id
      WHERE l.user_id = ?
      GROUP BY l.id ORDER BY l.created_at DESC
    `).all(req.user.id);
    sendCsv(res, 'lists-export.csv', ['id', 'name', 'description', 'created_at', 'contact_count'], lists);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export lists' });
  }
});

// POST /api/lists
router.post('/', (req, res) => {
  try {
    const db = req.app.locals.db;
    const { name, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'List name is required' });

    const result = db.prepare('INSERT INTO lists (user_id, name, description) VALUES (?, ?, ?)').run(
      req.user.id, validator.escape(name.trim()), description ? validator.escape(description.trim()) : null
    );
    const list = db.prepare('SELECT * FROM lists WHERE id = ?').get(result.lastInsertRowid);
    broadcast('lists');
    res.status(201).json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create list' });
  }
});

// PUT /api/lists/:id
router.put('/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const { name, description } = req.body;
    const existing = db.prepare('SELECT id FROM lists WHERE id = ? AND user_id = ?').get(parseInt(req.params.id), req.user.id);
    if (!existing) return res.status(404).json({ error: 'List not found' });
    if (!name || !name.trim()) return res.status(400).json({ error: 'List name is required' });

    db.prepare('UPDATE lists SET name = ?, description = ? WHERE id = ? AND user_id = ?').run(
      validator.escape(name.trim()), description ? validator.escape(description.trim()) : null,
      parseInt(req.params.id), req.user.id
    );
    const updated = db.prepare('SELECT * FROM lists WHERE id = ?').get(parseInt(req.params.id));
    broadcast('lists');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update list' });
  }
});

// DELETE /api/lists/:id
router.delete('/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const listId = parseInt(req.params.id);
    const existing = db.prepare('SELECT id FROM lists WHERE id = ? AND user_id = ?').get(listId, req.user.id);
    if (!existing) return res.status(404).json({ error: 'List not found' });

    const deleteList = db.transaction(() => {
      db.prepare('UPDATE campaigns SET list_id = NULL WHERE list_id = ?').run(listId);
      db.prepare('UPDATE automations SET list_id = NULL WHERE list_id = ?').run(listId);
      db.prepare('DELETE FROM list_contacts WHERE list_id = ?').run(listId);
      db.prepare('DELETE FROM lists WHERE id = ? AND user_id = ?').run(listId, req.user.id);
    });

    deleteList();
    broadcast('lists');
    res.json({ message: 'List deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete list' });
  }
});

// POST /api/lists/:id/contacts
router.post('/:id/contacts', (req, res) => {
  try {
    const db = req.app.locals.db;
    const listId = parseInt(req.params.id);
    const { contact_ids } = req.body;
    if (!contact_ids || !Array.isArray(contact_ids)) return res.status(400).json({ error: 'contact_ids array is required' });
    const existing = db.prepare('SELECT id FROM lists WHERE id = ? AND user_id = ?').get(listId, req.user.id);
    if (!existing) return res.status(404).json({ error: 'List not found' });

    const contactIds = [...new Set(contact_ids.map(id => parseInt(id, 10)).filter(Number.isInteger))];
    if (contactIds.length === 0) return res.status(400).json({ error: 'At least one valid contact ID is required' });
    const ph = contactIds.map(() => '?').join(',');
    const ownedIds = db.prepare(`SELECT id FROM contacts WHERE id IN (${ph}) AND user_id = ?`).all(...contactIds, req.user.id).map(r => r.id);
    for (const cid of ownedIds) {
      try { db.prepare('INSERT OR IGNORE INTO list_contacts (list_id, contact_id) VALUES (?, ?)').run(listId, cid); } catch (_) {}
    }
    broadcast('lists');
    res.json({ message: `${ownedIds.length} contacts added to list` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add contacts to list' });
  }
});

// DELETE /api/lists/:id/contacts/:contactId
router.delete('/:id/contacts/:contactId', (req, res) => {
  try {
    const db = req.app.locals.db;
    const list = db.prepare('SELECT id FROM lists WHERE id = ? AND user_id = ?').get(parseInt(req.params.id), req.user.id);
    if (!list) return res.status(404).json({ error: 'List not found' });
    const contact = db.prepare('SELECT id FROM contacts WHERE id = ? AND user_id = ?').get(parseInt(req.params.contactId), req.user.id);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });
    db.prepare('DELETE FROM list_contacts WHERE list_id = ? AND contact_id = ?').run(parseInt(req.params.id), parseInt(req.params.contactId));
    broadcast('lists');
    res.json({ message: 'Contact removed from list' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove contact from list' });
  }
});

// GET /api/lists/:id/contacts
router.get('/:id/contacts', (req, res) => {
  try {
    const db = req.app.locals.db;
    const list = db.prepare('SELECT id FROM lists WHERE id = ? AND user_id = ?').get(parseInt(req.params.id), req.user.id);
    if (!list) return res.status(404).json({ error: 'List not found' });
    const contacts = db.prepare(`
      SELECT c.id, c.email, c.first_name, c.last_name, c.company, c.phone, c.tags, c.status, c.custom_fields, c.created_at FROM contacts c
      JOIN list_contacts lc ON lc.contact_id = c.id
      WHERE lc.list_id = ? AND c.user_id = ? ORDER BY c.created_at DESC
    `).all(parseInt(req.params.id), req.user.id);
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch list contacts' });
  }
});

module.exports = router;
