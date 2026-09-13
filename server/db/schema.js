function applySchema(db) {
  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'user',
      plan_id INTEGER DEFAULT 1,
      plan_expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migrations for existing DBs
  try { db.run("ALTER TABLE users ADD COLUMN name TEXT"); } catch (_) {}
  try { db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'"); } catch (_) {}
  try { db.run("ALTER TABLE users ADD COLUMN plan_id INTEGER DEFAULT 1"); } catch (_) {}
  try { db.run("ALTER TABLE users ADD COLUMN plan_expires_at DATETIME"); } catch (_) {}
  try { db.run("ALTER TABLE users ADD COLUMN deleted_at DATETIME"); } catch (_) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS revoked_tokens (
      jti TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL,
      revoked_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      price_inr INTEGER NOT NULL DEFAULT 0,
      recipients_per_day INTEGER NOT NULL DEFAULT 200,
      max_contacts INTEGER NOT NULL DEFAULT 500,
      max_campaigns_per_month INTEGER NOT NULL DEFAULT 5,
      max_email_integrations INTEGER NOT NULL DEFAULT 1,
      features TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Migration for existing DBs
  try { db.run("ALTER TABLE plans ADD COLUMN max_email_integrations INTEGER NOT NULL DEFAULT 1"); } catch (_) {}
  // Backfill limits for existing plans by slug
  try {
    db.run("UPDATE plans SET max_email_integrations = 1  WHERE slug = 'free'         AND max_email_integrations = 1");
    db.run("UPDATE plans SET max_email_integrations = 5  WHERE slug = 'professional'");
    db.run("UPDATE plans SET max_email_integrations = 20 WHERE slug = 'business'");
    db.run("UPDATE plans SET max_email_integrations = -1 WHERE slug = 'enterprise'");
  } catch (_) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_id INTEGER NOT NULL REFERENCES plans(id),
      status TEXT DEFAULT 'active',
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      razorpay_signature TEXT,
      amount_paid INTEGER DEFAULT 0,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS payment_orders (
      order_id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_id INTEGER NOT NULL REFERENCES plans(id),
      billing_cycle TEXT NOT NULL DEFAULT 'monthly',
      amount INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'created',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      verified_at DATETIME
    )
  `);

  try { db.run("ALTER TABLE payment_orders ADD COLUMN razorpay_payment_id TEXT"); } catch (_) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS daily_send_counts (
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, date)
    )
  `);

  // Helper: run a COUNT query on the raw sql.js db (get() returns an array, not a named object)
  function sqlCount(query) {
    try {
      const stmt = db.prepare(query);
      const hasRow = stmt.step();
      const val = hasRow ? (stmt.get()[0] || 0) : 0;
      stmt.free();
      return val;
    } catch (_) { return 0; }
  }

  // Always upsert plans on startup — keeps data in sync with code.
  // ON CONFLICT skips is_active so admins can still toggle plans on/off.
  try {
    // ON CONFLICT only updates display fields (name, sort_order).
    // Admin-editable fields (price, limits, features) are intentionally excluded
    // so that admin changes survive server restarts.
    const upsertSQL = `
      INSERT INTO plans (name, slug, price_inr, recipients_per_day, max_contacts, max_campaigns_per_month, max_email_integrations, features, is_active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      ON CONFLICT(slug) DO UPDATE SET
        name       = excluded.name,
        sort_order = excluded.sort_order,
        features   = excluded.features
    `;
    db.run(upsertSQL, ['Free',         'free',         0,    200,   500,    5,   1,  JSON.stringify(['200 recipients/day', '500 contacts', '5 campaigns/month', '1 email sender (SMTP)', 'Campaign templates', 'Basic analytics', 'Email support']),                                                                         1]);
    db.run(upsertSQL, ['Professional', 'professional', 699,  5000,  10000,  50,  5,  JSON.stringify(['5,000 recipients/day', '10,000 contacts', '50 campaigns/month', '5 email senders (SMTP)', 'Advanced analytics', 'Campaign templates', 'Email automations', 'Priority email support']),                                    2]);
    db.run(upsertSQL, ['Business',     'business',     1299, 25000, 100000, 200, 20, JSON.stringify(['25,000 recipients/day', '100,000 contacts', '200 campaigns/month', '20 email senders (SMTP)', 'Full analytics suite', 'Campaign templates', 'Email automations', 'Dedicated IP', 'Phone support']),                         3]);
    db.run(upsertSQL, ['Enterprise',   'enterprise',   1499, -1,    -1,     -1,  -1, JSON.stringify(['Unlimited recipients/day', 'Unlimited contacts', 'Unlimited campaigns', 'Unlimited email senders (SMTP)', 'Full analytics suite', 'Email automations', 'White-label option', 'SLA guarantee', 'Dedicated account manager', '24/7 support']), 4]);
  } catch (_) {}

  // Do not auto-promote users to admin. Initial admin setup must use /api/auth/register before public signup.

  // New databases get contacts with user_id from the start
  db.run(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      email TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      company TEXT,
      phone TEXT,
      tags TEXT DEFAULT '[]',
      status TEXT DEFAULT 'subscribed',
      custom_fields TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, email)
    )
  `);

  // Migration for existing databases: recreate contacts to add user_id + change unique constraint
  {
    let contactsHasUserId = false;
    try {
      const s = db.prepare("SELECT user_id FROM contacts LIMIT 1");
      s.step(); s.free();
      contactsHasUserId = true;
    } catch (_) { /* column doesn't exist yet */ }

    if (!contactsHasUserId) {
      db.run('PRAGMA foreign_keys = OFF');
      db.run(`CREATE TABLE contacts_migrated (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL DEFAULT 1,
        email TEXT NOT NULL,
        first_name TEXT, last_name TEXT, company TEXT, phone TEXT,
        tags TEXT DEFAULT '[]', status TEXT DEFAULT 'subscribed',
        custom_fields TEXT DEFAULT '{}', created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, email)
      )`);
      db.run(`INSERT OR IGNORE INTO contacts_migrated
        (id, user_id, email, first_name, last_name, company, phone, tags, status, custom_fields, created_at)
        SELECT id, 1, email, first_name, last_name, company, phone, tags, status, custom_fields, created_at
        FROM contacts`);
      db.run('DROP TABLE contacts');
      db.run('ALTER TABLE contacts_migrated RENAME TO contacts');
      db.run('PRAGMA foreign_keys = ON');
    }
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  try { db.run("ALTER TABLE lists ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1"); } catch (_) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS list_contacts (
      list_id INTEGER REFERENCES lists(id) ON DELETE CASCADE,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (list_id, contact_id)
    )
  `);
  try { db.run('ALTER TABLE list_contacts ADD COLUMN added_at DATETIME DEFAULT CURRENT_TIMESTAMP'); } catch (_) {}

  // New databases get user_id + blocks_json from the start
  db.run(`
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      subject TEXT,
      html_content TEXT,
      blocks_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  try { db.run("ALTER TABLE templates ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1"); } catch (_) {}
  try { db.run("ALTER TABLE templates ADD COLUMN blocks_json TEXT"); } catch (_) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      from_name TEXT,
      from_email TEXT,
      reply_to TEXT,
      html_content TEXT NOT NULL,
      list_id INTEGER REFERENCES lists(id),
      status TEXT DEFAULT 'draft',
      scheduled_at DATETIME,
      sent_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  try { db.run('ALTER TABLE campaigns ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL'); } catch (_) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS sends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER REFERENCES campaigns(id),
      automation_id INTEGER REFERENCES automations(id),
      contact_id INTEGER REFERENCES contacts(id),
      status TEXT DEFAULT 'pending',
      sent_at DATETIME,
      opened_at DATETIME,
      clicked_at DATETIME,
      bounce_reason TEXT,
      unsubscribed_at DATETIME,
      public_token TEXT
    )
  `);

  // Migration: add automation_id and opaque public token for existing databases.
  try { db.run('ALTER TABLE sends ADD COLUMN automation_id INTEGER REFERENCES automations(id)'); } catch (_) {}
  try { db.run('ALTER TABLE sends ADD COLUMN public_token TEXT'); } catch (_) {}
  try { db.run("UPDATE sends SET public_token = lower(hex(randomblob(24))) WHERE public_token IS NULL OR public_token = ''"); } catch (_) {}
  try { db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_sends_public_token ON sends(public_token) WHERE public_token IS NOT NULL'); } catch (_) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      send_id INTEGER REFERENCES sends(id),
      event_type TEXT,
      metadata TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS automations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      trigger_type TEXT,
      delay_days INTEGER DEFAULT 0,
      template_id INTEGER REFERENCES templates(id),
      list_id INTEGER REFERENCES lists(id),
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  try { db.run("ALTER TABLE automations ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1"); } catch (_) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS payment_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_id INTEGER NOT NULL REFERENCES plans(id),
      billing_cycle TEXT DEFAULT 'monthly',
      amount INTEGER NOT NULL DEFAULT 0,
      transaction_id TEXT,
      payment_method TEXT DEFAULT 'upi',
      note TEXT,
      status TEXT DEFAULT 'pending',
      admin_note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME,
      reminder_sent_at DATETIME
    )
  `);
  try { db.run("ALTER TABLE payment_requests ADD COLUMN reminder_sent_at DATETIME"); } catch (_) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS admin_activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      actor_email TEXT,
      target_email TEXT,
      detail TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS email_integrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      from_name TEXT NOT NULL,
      from_email TEXT NOT NULL,
      smtp_host TEXT NOT NULL,
      smtp_port INTEGER DEFAULT 587,
      smtp_username TEXT NOT NULL,
      smtp_password TEXT NOT NULL,
      smtp_tls TEXT DEFAULT 'false',
      imap_host TEXT,
      imap_port INTEGER DEFAULT 993,
      imap_username TEXT,
      imap_password TEXT,
      imap_tls TEXT DEFAULT 'true',
      is_default INTEGER DEFAULT 0,
      is_verified INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Migrations for existing email_integrations rows
  try { db.run("ALTER TABLE email_integrations ADD COLUMN imap_host TEXT"); } catch (_) {}
  try { db.run("ALTER TABLE email_integrations ADD COLUMN imap_port INTEGER DEFAULT 993"); } catch (_) {}
  try { db.run("ALTER TABLE email_integrations ADD COLUMN imap_username TEXT"); } catch (_) {}
  try { db.run("ALTER TABLE email_integrations ADD COLUMN imap_password TEXT"); } catch (_) {}
  try { db.run("ALTER TABLE email_integrations ADD COLUMN imap_tls TEXT DEFAULT 'true'"); } catch (_) {}

  // Add integration_id to inbox_messages to scope messages per email account
  try { db.run("ALTER TABLE inbox_messages ADD COLUMN integration_id INTEGER REFERENCES email_integrations(id) ON DELETE CASCADE"); } catch (_) {}

  // Migration: link campaigns to a specific email integration
  try { db.run("ALTER TABLE campaigns ADD COLUMN email_integration_id INTEGER REFERENCES email_integrations(id) ON DELETE SET NULL"); } catch (_) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS inbox_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT UNIQUE,
      thread_id TEXT,
      from_name TEXT,
      from_email TEXT,
      to_email TEXT,
      subject TEXT,
      text_content TEXT,
      html_content TEXT,
      date DATETIME,
      is_read INTEGER DEFAULT 0,
      integration_id INTEGER REFERENCES email_integrations(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

module.exports = { applySchema };
