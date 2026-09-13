const express = require('express');
const { redactSensitive } = require('../utils/secrets');
const router = express.Router();

function normalizeSendToken(value) {
  const token = String(value || '').trim();
  return /^[a-f0-9]{48}$/i.test(token) ? token.toLowerCase() : '';
}

// GET /unsubscribe/:token — one-click unsubscribe (public, opaque token)
router.get('/:token', (req, res) => {
  try {
    const db = req.app.locals.db;
    const token = normalizeSendToken(req.params.token);
    if (!token) {
      return res.send(getPage('Unsubscribe', '<h2>Invalid Link</h2><p>This unsubscribe link is not valid.</p>'));
    }

    const send = db.prepare('SELECT id, contact_id, unsubscribed_at FROM sends WHERE public_token = ?').get(token);
    if (!send) {
      return res.send(getPage('Unsubscribe', '<h2>Invalid Link</h2><p>This unsubscribe link is not valid.</p>'));
    }

    const contact = db.prepare('SELECT id, status FROM contacts WHERE id = ?').get(send.contact_id);
    if (!contact) {
      return res.send(getPage('Unsubscribe', '<h2>Contact Not Found</h2><p>This contact no longer exists.</p>'));
    }

    if (contact.status === 'unsubscribed') {
      return res.send(getPage('Already Unsubscribed',
        '<div class="icon">✓</div><h2>You are already unsubscribed</h2><p>You were previously unsubscribed and will not receive further emails from us.</p>'
      ));
    }

    db.prepare("UPDATE contacts SET status = 'unsubscribed' WHERE id = ?").run(contact.id);
    db.prepare("UPDATE sends SET unsubscribed_at = datetime('now') WHERE id = ?").run(send.id);
    db.prepare("INSERT INTO events (send_id, event_type, metadata) VALUES (?, 'unsubscribe', '{}')").run(send.id);

    return res.send(getPage('Unsubscribed',
      '<div class="icon">✓</div><h2>You have been unsubscribed</h2><p>You will not receive further emails from us.</p>'
    ));
  } catch (err) {
    console.error('Unsubscribe error:', redactSensitive(err));
    res.send(getPage('Error', '<h2>Something went wrong</h2><p>Please try again later.</p>'));
  }
});

function getPage(title, content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - MailcryVia</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #334155;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 48px;
      max-width: 480px;
      width: 90%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
    }
    .icon {
      width: 64px;
      height: 64px;
      background: #10b981;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      margin: 0 auto 24px;
    }
    h2 { color: #1e293b; margin-bottom: 12px; font-size: 22px; }
    p { color: #64748b; line-height: 1.6; font-size: 15px; }
    .brand { margin-top: 32px; color: #94a3b8; font-size: 13px; }
    .brand span { color: #3b82f6; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    ${content}
    <p class="brand">Powered by <span>MailcryVia</span></p>
  </div>
</body>
</html>`;
}

module.exports = router;