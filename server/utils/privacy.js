const bcrypt = require('bcryptjs');
const crypto = require('crypto');

function anonymizeUserData(db, userId, originalEmail = '') {
  const anonymizedEmail = `deleted-user-${userId}@deleted.local`;
  const anonymizedHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12);

  const txn = db.transaction(() => {
    const campaignIds = db.prepare('SELECT id FROM campaigns WHERE user_id = ?').all(userId).map(r => r.id);
    const automationIds = db.prepare('SELECT id FROM automations WHERE user_id = ?').all(userId).map(r => r.id);
    const contactIds = db.prepare('SELECT id FROM contacts WHERE user_id = ?').all(userId).map(r => r.id);
    const integrationIds = db.prepare('SELECT id FROM email_integrations WHERE user_id = ?').all(userId).map(r => r.id);

    if (campaignIds.length) {
      const ph = campaignIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM events WHERE send_id IN (SELECT id FROM sends WHERE campaign_id IN (${ph}))`).run(...campaignIds);
      db.prepare(`DELETE FROM sends WHERE campaign_id IN (${ph})`).run(...campaignIds);
      db.prepare(`DELETE FROM campaigns WHERE id IN (${ph})`).run(...campaignIds);
    }
    if (automationIds.length) {
      const ph = automationIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM events WHERE send_id IN (SELECT id FROM sends WHERE automation_id IN (${ph}))`).run(...automationIds);
      db.prepare(`DELETE FROM sends WHERE automation_id IN (${ph})`).run(...automationIds);
      db.prepare(`DELETE FROM automations WHERE id IN (${ph})`).run(...automationIds);
    }
    if (contactIds.length) {
      const ph = contactIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM events WHERE send_id IN (SELECT id FROM sends WHERE contact_id IN (${ph}))`).run(...contactIds);
      db.prepare(`DELETE FROM sends WHERE contact_id IN (${ph})`).run(...contactIds);
      db.prepare(`DELETE FROM list_contacts WHERE contact_id IN (${ph})`).run(...contactIds);
      db.prepare(`DELETE FROM contacts WHERE id IN (${ph})`).run(...contactIds);
    }
    if (integrationIds.length) {
      const ph = integrationIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM inbox_messages WHERE integration_id IN (${ph})`).run(...integrationIds);
      db.prepare(`DELETE FROM email_integrations WHERE id IN (${ph})`).run(...integrationIds);
    }

    db.prepare('DELETE FROM lists WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM templates WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM daily_send_counts WHERE user_id = ?').run(userId);
    db.prepare('UPDATE payment_requests SET transaction_id = NULL, note = NULL, admin_note = NULL WHERE user_id = ?').run(userId);
    db.prepare('UPDATE subscriptions SET razorpay_signature = NULL WHERE user_id = ?').run(userId);
    if (originalEmail) {
      db.prepare("UPDATE admin_activity_log SET actor_email='[REDACTED]' WHERE actor_email = ?").run(originalEmail);
      db.prepare("UPDATE admin_activity_log SET target_email='[REDACTED]' WHERE target_email = ?").run(originalEmail);
    }
    db.prepare(`
      UPDATE users
      SET email = ?, name = NULL, password_hash = ?, role = 'user', deleted_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(anonymizedEmail, anonymizedHash, userId);
  });

  txn();
}

module.exports = { anonymizeUserData };