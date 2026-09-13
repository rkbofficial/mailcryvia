const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const validator = require('validator');
const { sendCsv } = require('../utils/csv');
const { broadcast } = require('../utils/sse');
const { redactSensitive } = require('../utils/secrets');
const { asPositiveInt, sanitizeText, sanitizeEmail } = require('../utils/sanitize');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

// GET /api/contacts
router.get('/', (req, res) => {
  try {
    const db = req.app.locals.db;
    const uid = req.user.id;
    const page = asPositiveInt(req.query.page, 1, { min: 1, max: 100000 });
    const limit = asPositiveInt(req.query.limit, 50, { min: 1, max: 200 });
    const offset = (page - 1) * limit;
    const search = sanitizeText(req.query.search || '', 120);
    const status = ['subscribed', 'unsubscribed', 'bounced'].includes(req.query.status) ? req.query.status : '';

    let where = 'WHERE user_id = ?';
    const params = [uid];

    if (search) {
      where += ' AND (email LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR company LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (status) {
      where += ' AND status = ?';
      params.push(status);
    }

    const total = db.prepare(`SELECT COUNT(*) as count FROM contacts ${where}`).get(...params).count;
    const contacts = db.prepare(`SELECT id, email, first_name, last_name, company, phone, tags, status, custom_fields, created_at FROM contacts ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);

    res.json({ contacts, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('List contacts error:', redactSensitive(err));
    res.status(500).json({ error: 'Failed to list contacts' });
  }
});

// POST /api/contacts
router.post('/', (req, res) => {
  try {
    const db = req.app.locals.db;
    const uid = req.user.id;
    const { email, first_name, last_name, company, phone, tags, custom_fields } = req.body;

    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const normalizedEmail = sanitizeEmail(email);
    const existing = db.prepare('SELECT id FROM contacts WHERE user_id = ? AND email = ?').get(uid, normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: 'Contact with this email already exists' });
    }

    const result = db.prepare(
      'INSERT INTO contacts (user_id, email, first_name, last_name, company, phone, tags, custom_fields) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(uid, normalizedEmail, sanitizeText(first_name, 120) || null, sanitizeText(last_name, 120) || null, sanitizeText(company, 180) || null, sanitizeText(phone, 40) || null,
      JSON.stringify(tags || []), JSON.stringify(custom_fields || {}));

    const contact = db.prepare('SELECT id, email, first_name, last_name, company, phone, tags, status, custom_fields, created_at FROM contacts WHERE id = ? AND user_id = ?').get(result.lastInsertRowid, uid);
    broadcast('contacts');
    res.status(201).json(contact);
  } catch (err) {
    console.error('Create contact error:', redactSensitive(err));
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

// PUT /api/contacts/:id
router.put('/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const uid = req.user.id;
    const { id } = req.params;
    const { email, first_name, last_name, company, phone, tags, status, custom_fields } = req.body;

    const existing = db.prepare('SELECT * FROM contacts WHERE id = ? AND user_id = ?').get(id, uid);
    if (!existing) return res.status(404).json({ error: 'Contact not found' });

    if (email && !validator.isEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    if (email && email.toLowerCase() !== existing.email) {
      const dup = db.prepare('SELECT id FROM contacts WHERE user_id = ? AND email = ? AND id != ?').get(uid, email.toLowerCase(), id);
      if (dup) return res.status(409).json({ error: 'Another contact with this email already exists' });
    }

    db.prepare(`
      UPDATE contacts SET
        email = COALESCE(?, email), first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name),
        company = COALESCE(?, company), phone = COALESCE(?, phone), tags = COALESCE(?, tags),
        status = COALESCE(?, status), custom_fields = COALESCE(?, custom_fields)
      WHERE id = ? AND user_id = ?
    `).run(
      email ? email.toLowerCase() : null,
      first_name !== undefined ? first_name : null,
      last_name !== undefined ? last_name : null,
      company !== undefined ? company : null,
      phone !== undefined ? phone : null,
      tags ? JSON.stringify(tags) : null,
      status || null,
      custom_fields ? JSON.stringify(custom_fields) : null,
      id, uid
    );

    const updated = db.prepare('SELECT id, email, first_name, last_name, company, phone, tags, status, custom_fields, created_at FROM contacts WHERE id = ? AND user_id = ?').get(id, uid);
    broadcast('contacts');
    res.json(updated);
  } catch (err) {
    console.error('Update contact error:', redactSensitive(err));
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// DELETE /api/contacts/:id
router.delete('/:id', (req, res) => {
  try {
    const db = req.app.locals.db;
    const uid = req.user.id;
    const { id } = req.params;
    const existing = db.prepare('SELECT id FROM contacts WHERE id = ? AND user_id = ?').get(id, uid);
    if (!existing) return res.status(404).json({ error: 'Contact not found' });

    const deleteContact = db.transaction(() => {
      db.prepare('DELETE FROM events WHERE send_id IN (SELECT id FROM sends WHERE contact_id = ?)').run(id);
      db.prepare('DELETE FROM sends WHERE contact_id = ?').run(id);
      db.prepare('DELETE FROM list_contacts WHERE contact_id = ?').run(id);
      db.prepare('DELETE FROM contacts WHERE id = ? AND user_id = ?').run(id, uid);
    });

    deleteContact();
    broadcast('contacts');
    res.json({ message: 'Contact deleted' });
  } catch (err) {
    console.error('Delete contact error:', redactSensitive(err));
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// POST /api/contacts/import — CSV import
router.post('/import', upload.single('file'), (req, res) => {
  try {
    const db = req.app.locals.db;
    const uid = req.user.id;

    if (!req.file) return res.status(400).json({ error: 'CSV file is required' });
    const fileName = req.file.originalname || '';
    const allowedMime = ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain'];
    if (!fileName.toLowerCase().endsWith('.csv') || (req.file.mimetype && !allowedMime.includes(req.file.mimetype))) {
      return res.status(400).json({ error: 'Only CSV files are allowed' });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    let records;
    try {
      records = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true });
    } catch (e) {
      return res.status(400).json({ error: 'Invalid CSV format' });
    }

    let imported = 0, skipped = 0;
    const errors = [];

    const insertStmt = db.prepare(
      'INSERT OR IGNORE INTO contacts (user_id, email, first_name, last_name, company, phone, tags) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    const importTransaction = db.transaction(() => {
      for (let rowIndex = 0; rowIndex < records.length; rowIndex++) {
        const row = records[rowIndex];
        const email = sanitizeEmail(row.email || '');
        if (!email || !validator.isEmail(email)) {
          skipped++;
          errors.push(`Invalid email at row ${rowIndex + 2}`);
          continue;
        }
        let tags = [];
        if (row.tags) tags = row.tags.split(',').map(t => t.trim()).filter(Boolean);

        const result = insertStmt.run(uid, email, sanitizeText(row.first_name, 120) || null, sanitizeText(row.last_name, 120) || null, sanitizeText(row.company, 180) || null, sanitizeText(row.phone, 40) || null, JSON.stringify(tags));

        if (result.changes > 0) { imported++; } else { skipped++; errors.push(`Duplicate email at row ${rowIndex + 2}`); }
      }
    });

    importTransaction();
    if (imported > 0) broadcast('contacts');

    res.json({ imported, skipped, total: records.length, errors: errors.slice(0, 20) });
  } catch (err) {
    console.error('Import error:', redactSensitive(err));
    res.status(500).json({ error: 'Failed to import contacts' });
  }
});

// GET /api/contacts/export
router.get('/export', (req, res) => {
  try {
    const db = req.app.locals.db;
    const contacts = db.prepare(`
      SELECT id, email, first_name, last_name, company, phone, tags, status, created_at
      FROM contacts WHERE user_id = ? ORDER BY created_at DESC
    `).all(req.user.id);

    const rows = contacts.map(c => ({ ...c, tags: (() => { try { return JSON.parse(c.tags || '[]').join(', '); } catch { return ''; } })() }));
    sendCsv(res, 'contacts-export.csv', ['id', 'email', 'first_name', 'last_name', 'company', 'phone', 'tags', 'status', 'created_at'], rows);
  } catch (err) {
    console.error('Export error:', redactSensitive(err));
    res.status(500).json({ error: 'Failed to export contacts' });
  }
});

// POST /api/contacts/:id/unsubscribe
router.post('/:id/unsubscribe', (req, res) => {
  try {
    const db = req.app.locals.db;
    db.prepare("UPDATE contacts SET status = 'unsubscribed' WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
    broadcast('contacts');
    res.json({ message: 'Contact unsubscribed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unsubscribe contact' });
  }
});

// POST /api/contacts/bulk-delete
router.post('/bulk-delete', (req, res) => {
  try {
    const db = req.app.locals.db;
    const uid = req.user.id;
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'IDs array is required' });

    const contactIds = [...new Set(ids.map(id => parseInt(id)).filter(Number.isInteger))];
    if (contactIds.length === 0) return res.status(400).json({ error: 'At least one valid contact ID is required' });

    const ph = contactIds.map(() => '?').join(',');
    const ownedIds = db.prepare(`SELECT id FROM contacts WHERE id IN (${ph}) AND user_id = ?`).all(...contactIds, uid).map(r => r.id);
    if (ownedIds.length === 0) return res.json({ message: '0 contacts deleted' });

    const ph2 = ownedIds.map(() => '?').join(',');
    const deleteContacts = db.transaction(() => {
      db.prepare(`DELETE FROM events WHERE send_id IN (SELECT id FROM sends WHERE contact_id IN (${ph2}))`).run(...ownedIds);
      db.prepare(`DELETE FROM sends WHERE contact_id IN (${ph2})`).run(...ownedIds);
      db.prepare(`DELETE FROM list_contacts WHERE contact_id IN (${ph2})`).run(...ownedIds);
      db.prepare(`DELETE FROM contacts WHERE id IN (${ph2}) AND user_id = ?`).run(...ownedIds, uid);
    });

    deleteContacts();
    broadcast('contacts');
    res.json({ message: `${ownedIds.length} contacts deleted` });
  } catch (err) {
    console.error('Bulk delete error:', redactSensitive(err));
    res.status(500).json({ error: 'Failed to delete contacts' });
  }
});

// POST /api/contacts/bulk-add-to-list
router.post('/bulk-add-to-list', (req, res) => {
  try {
    const db = req.app.locals.db;
    const uid = req.user.id;
    const { contact_ids, list_id } = req.body;
    if (!contact_ids || !Array.isArray(contact_ids) || !list_id) return res.status(400).json({ error: 'contact_ids and list_id required' });

    const list = db.prepare('SELECT id FROM lists WHERE id = ? AND user_id = ?').get(list_id, uid);
    if (!list) return res.status(404).json({ error: 'List not found' });

    const contactIds = [...new Set(contact_ids.map(id => parseInt(id, 10)).filter(Number.isInteger))];
    if (contactIds.length === 0) return res.status(400).json({ error: 'At least one valid contact ID is required' });
    const ph = contactIds.map(() => '?').join(',');
    const ownedIds = db.prepare(`SELECT id FROM contacts WHERE id IN (${ph}) AND user_id = ?`).all(...contactIds, uid).map(r => r.id);
    const insertStmt = db.prepare('INSERT OR IGNORE INTO list_contacts (list_id, contact_id) VALUES (?, ?)');
    const txn = db.transaction(() => { for (const cid of ownedIds) insertStmt.run(list_id, cid); });
    txn();
    broadcast('contacts');
    res.json({ message: `${ownedIds.length} contacts added to list` });
  } catch (err) {
    console.error('Bulk add to list error:', redactSensitive(err));
    res.status(500).json({ error: 'Failed to add contacts to list' });
  }
});

module.exports = router;
