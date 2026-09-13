const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { decrypt } = require('./crypto');
const { redactSensitive } = require('./secrets');
const { sanitizeText, sanitizeEmail, sanitizeHtml } = require('./sanitize');

function getImapSettings(db) {
  const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'imap_%'").all();
  const s = {};
  rows.forEach(r => { s[r.key] = r.value; });
  if (s.imap_password) s.imap_password = decrypt(s.imap_password);
  return s;
}

async function syncIntegrationInbox(db, integrationId) {
  const integration = db.prepare('SELECT * FROM email_integrations WHERE id = ?').get(integrationId);
  if (!integration) return { error: 'Integration not found' };
  if (!integration.imap_host || !integration.imap_username || !integration.imap_password) {
    return { error: 'IMAP not configured for this sender. Add IMAP settings in Email Senders.' };
  }

  const imapPass = decrypt(integration.imap_password);

  const client = new ImapFlow({
    host: integration.imap_host,
    port: parseInt(integration.imap_port || '993', 10),
    secure: integration.imap_tls !== 'false',
    auth: { user: integration.imap_username, pass: imapPass },
    logger: false
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    let newCount = 0;

    try {
      const status = await client.status('INBOX', { messages: true });
      const messages = [];

      if (status.messages > 0) {
        const start = Math.max(1, status.messages - 20);
        for await (let msg of client.fetch(`${start}:*`, { source: true, uid: true, flags: true })) {
          messages.push(msg);
        }
      }

      for (const msg of messages) {
        const parsed = await simpleParser(msg.source);
        // Scope message_id per integration to avoid collisions across accounts
        const messageId = (parsed.messageId || `uid-${msg.uid}`) + `-int-${integrationId}`;

        const existing = db.prepare('SELECT id FROM inbox_messages WHERE message_id = ?').get(messageId);
        if (!existing) {
          db.prepare(`
            INSERT INTO inbox_messages
            (message_id, thread_id, from_name, from_email, to_email, subject, text_content, html_content, date, is_read, integration_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            messageId,
            parsed.inReplyTo || messageId,
            sanitizeText(parsed.from?.value[0]?.name || '', 160),
            sanitizeEmail(parsed.from?.value[0]?.address || ''),
            sanitizeText(parsed.to?.value.map(t => t.address).join(', ') || '', 1000),
            sanitizeText(parsed.subject || '', 255),
            sanitizeText(parsed.text || '', 200000),
            sanitizeHtml(parsed.html || parsed.textAsHtml || ''),
            parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
            msg.flags.has('\\Seen') ? 1 : 0,
            integrationId
          );
          newCount++;
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
    return { success: true, newMessages: newCount };
  } catch (err) {
    console.error('IMAP sync error:', redactSensitive(err));
    return { error: 'Failed to sync inbox' };
  }
}

module.exports = { syncIntegrationInbox, getImapSettings };
