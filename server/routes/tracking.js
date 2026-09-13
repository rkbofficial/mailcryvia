const express = require('express');
const { isSafeUrl, sanitizeText } = require('../utils/sanitize');
const router = express.Router();

const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

function normalizeSendToken(value) {
  const token = String(value || '').trim();
  return /^[a-f0-9]{48}$/i.test(token) ? token.toLowerCase() : '';
}

function getSafeRedirectUrl(rawValue) {
  if (!rawValue) return null;
  const decoded = decodeURIComponent(String(rawValue));
  if (!isSafeUrl(decoded)) return null;
  try {
    const parsed = new URL(decoded);
    if (!['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) return null;
    return decoded;
  } catch {
    return null;
  }
}

// GET /api/track/open/:token.png
router.get('/open/:token.png', (req, res) => {
  try {
    const db = req.app.locals.db;
    const token = normalizeSendToken(req.params.token);

    if (token) {
      const send = db.prepare('SELECT id, opened_at FROM sends WHERE public_token = ?').get(token);
      if (send && !send.opened_at) {
        db.prepare("UPDATE sends SET opened_at = datetime('now') WHERE id = ?").run(send.id);
        db.prepare("INSERT INTO events (send_id, event_type, metadata) VALUES (?, 'open', '{}')").run(send.id);
      }
    }
  } catch (_) {}
  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.send(TRANSPARENT_GIF);
});

// GET /api/track/click/:token
router.get('/click/:token', (req, res) => {
  try {
    const db = req.app.locals.db;
    const token = normalizeSendToken(req.params.token);
    const redirectUrl = getSafeRedirectUrl(req.query.url);

    if (token) {
      const send = db.prepare('SELECT id, clicked_at FROM sends WHERE public_token = ?').get(token);
      if (send && !send.clicked_at) {
        db.prepare("UPDATE sends SET clicked_at = datetime('now') WHERE id = ?").run(send.id);
        db.prepare("INSERT INTO events (send_id, event_type, metadata) VALUES (?, 'click', ?)").run(
          send.id, JSON.stringify({ url: sanitizeText(redirectUrl || '', 2000) })
        );
      }
    }

    return res.redirect(302, redirectUrl || '/');
  } catch (_) {
    return res.redirect(302, '/');
  }
});

module.exports = router;