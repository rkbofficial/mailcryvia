const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const { Pool } = require('pg');
const { applySchema } = require('./schema');
const { redactSensitive } = require('../utils/secrets');

const isServerlessRuntime = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

function resolveDatabasePath() {
  const databasePath = process.env.DATABASE_PATH && process.env.DATABASE_PATH.trim();
  if (databasePath) return path.resolve(databasePath);

  const dataDir = process.env.DATA_DIR && process.env.DATA_DIR.trim();
  if (dataDir) return path.join(path.resolve(dataDir), 'database.sqlite');

  return path.join(__dirname, 'database.sqlite');
}

const DB_PATH = resolveDatabasePath();

/**
 * SqlJsWrapper: wraps sql.js to provide an API compatible with better-sqlite3 patterns.
 * This allows route files to use db.prepare(sql).get(...), .all(...), .run(...) syntax.
 */
class SqlJsWrapper {
  constructor(sqlDb) {
    this._db = sqlDb;
    this._transactionDepth = 0;
  }

  _save() {
    try {
      const data = this._db.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
    } catch (e) {
      console.error('DB save error:', redactSensitive(e));
    }
  }

  pragma(str) {
    try { this._db.run('PRAGMA ' + str); } catch(e) { /* ignore */ }
  }

  flush() {
    this._save();
  }

  prepare(sql) {
    const db = this._db;
    const wrapper = this;
    return {
      get(...params) {
        const stmt = db.prepare(sql);
        try {
          if (params.length > 0) stmt.bind(params);
          if (stmt.step()) {
            const cols = stmt.getColumnNames();
            const vals = stmt.get();
            const row = {};
            cols.forEach((c, i) => { row[c] = vals[i]; });
            return row;
          }
          return undefined;
        } finally {
          stmt.free();
        }
      },
      all(...params) {
        const results = [];
        const stmt = db.prepare(sql);
        try {
          if (params.length > 0) stmt.bind(params);
          while (stmt.step()) {
            const cols = stmt.getColumnNames();
            const vals = stmt.get();
            const row = {};
            cols.forEach((c, i) => { row[c] = vals[i]; });
            results.push(row);
          }
          return results;
        } finally {
          stmt.free();
        }
      },
      run(...params) {
        if (params.length > 0) {
          db.run(sql, params);
        } else {
          db.run(sql);
        }
        // Query BEFORE _save() — db.export() resets last_insert_rowid() to 0
        const info = db.prepare("SELECT last_insert_rowid() as id, changes() as changes");
        info.step();
        const vals = info.get();
        info.free();
        const result = { lastInsertRowid: vals[0], changes: vals[1] };
        if (wrapper._transactionDepth === 0) {
          wrapper._save();
        }
        return result;
      }
    };
  }

  transaction(fn) {
    const db = this._db;
    const wrapper = this;
    return (...args) => {
      db.run('BEGIN TRANSACTION');
      wrapper._transactionDepth += 1;
      try {
        const result = fn(...args);
        db.run('COMMIT');
        wrapper._transactionDepth -= 1;
        wrapper._save();
        return result;
      } catch (e) {
        wrapper._transactionDepth = Math.max(0, wrapper._transactionDepth - 1);
        db.run('ROLLBACK');
        throw e;
      }
    };
  }

  exec(sql) {
    this._db.run(sql);
    if (this._transactionDepth === 0) {
      this._save();
    }
  }

  close() {
    this._save();
    this._db.close();
  }
}

async function ensurePostgresSchema(pool) {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'user',
      plan_id INTEGER DEFAULT 1,
      plan_expires_at TIMESTAMPTZ,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS revoked_tokens (
      jti TEXT PRIMARY KEY,
      expires_at BIGINT NOT NULL,
      revoked_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS plans (
      id SERIAL PRIMARY KEY,
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
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_id INTEGER NOT NULL REFERENCES plans(id),
      status TEXT DEFAULT 'active',
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      razorpay_signature TEXT,
      amount_paid INTEGER DEFAULT 0,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS payment_orders (
      order_id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_id INTEGER NOT NULL REFERENCES plans(id),
      billing_cycle TEXT NOT NULL DEFAULT 'monthly',
      amount INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'created',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      verified_at TIMESTAMPTZ,
      razorpay_payment_id TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS daily_send_counts (
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, date)
    )`,
    `CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL DEFAULT 1,
      email TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      company TEXT,
      phone TEXT,
      tags TEXT DEFAULT '[]',
      status TEXT DEFAULT 'subscribed',
      custom_fields TEXT DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, email)
    )`,
    `CREATE TABLE IF NOT EXISTS lists (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS list_contacts (
      list_id INTEGER REFERENCES lists(id) ON DELETE CASCADE,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
      added_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (list_id, contact_id)
    )`,
    `CREATE TABLE IF NOT EXISTS templates (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      subject TEXT,
      html_content TEXT,
      blocks_json TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS automations (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      trigger_type TEXT,
      delay_days INTEGER DEFAULT 0,
      template_id INTEGER REFERENCES templates(id),
      list_id INTEGER REFERENCES lists(id),
      active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS payment_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_id INTEGER NOT NULL REFERENCES plans(id),
      billing_cycle TEXT DEFAULT 'monthly',
      amount INTEGER NOT NULL DEFAULT 0,
      transaction_id TEXT,
      payment_method TEXT DEFAULT 'upi',
      note TEXT,
      status TEXT DEFAULT 'pending',
      admin_note TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      processed_at TIMESTAMPTZ,
      reminder_sent_at TIMESTAMPTZ
    )`,
    `CREATE TABLE IF NOT EXISTS admin_activity_log (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      actor_email TEXT,
      target_email TEXT,
      detail TEXT DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS email_integrations (
      id SERIAL PRIMARY KEY,
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
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS campaigns (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      from_name TEXT,
      from_email TEXT,
      reply_to TEXT,
      html_content TEXT NOT NULL,
      list_id INTEGER REFERENCES lists(id),
      email_integration_id INTEGER REFERENCES email_integrations(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'draft',
      scheduled_at TIMESTAMPTZ,
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS sends (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER REFERENCES campaigns(id),
      automation_id INTEGER REFERENCES automations(id),
      contact_id INTEGER REFERENCES contacts(id),
      status TEXT DEFAULT 'pending',
      sent_at TIMESTAMPTZ,
      opened_at TIMESTAMPTZ,
      clicked_at TIMESTAMPTZ,
      bounce_reason TEXT,
      unsubscribed_at TIMESTAMPTZ,
      public_token TEXT,
      UNIQUE(public_token)
    )`,
    `CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      send_id INTEGER REFERENCES sends(id),
      event_type TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS inbox_messages (
      id SERIAL PRIMARY KEY,
      message_id TEXT UNIQUE,
      thread_id TEXT,
      from_name TEXT,
      from_email TEXT,
      to_email TEXT,
      subject TEXT,
      text_content TEXT,
      html_content TEXT,
      date TIMESTAMPTZ,
      is_read INTEGER DEFAULT 0,
      integration_id INTEGER REFERENCES email_integrations(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`
  ];

  for (const statement of statements) {
    await pool.query(statement);
  }

  const alterStatements = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_id INTEGER DEFAULT 1`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
    `ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_email_integrations INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT`,
    `ALTER TABLE list_contacts ADD COLUMN IF NOT EXISTS added_at TIMESTAMPTZ DEFAULT NOW()`,
    `ALTER TABLE templates ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE templates ADD COLUMN IF NOT EXISTS blocks_json TEXT`,
    `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`,
    `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS email_integration_id INTEGER REFERENCES email_integrations(id) ON DELETE SET NULL`,
    `ALTER TABLE sends ADD COLUMN IF NOT EXISTS automation_id INTEGER REFERENCES automations(id)`,
    `ALTER TABLE sends ADD COLUMN IF NOT EXISTS public_token TEXT`,
    `ALTER TABLE email_integrations ADD COLUMN IF NOT EXISTS imap_host TEXT`,
    `ALTER TABLE email_integrations ADD COLUMN IF NOT EXISTS imap_port INTEGER DEFAULT 993`,
    `ALTER TABLE email_integrations ADD COLUMN IF NOT EXISTS imap_username TEXT`,
    `ALTER TABLE email_integrations ADD COLUMN IF NOT EXISTS imap_password TEXT`,
    `ALTER TABLE email_integrations ADD COLUMN IF NOT EXISTS imap_tls TEXT DEFAULT 'true'`,
    `ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ`,
    `ALTER TABLE inbox_messages ADD COLUMN IF NOT EXISTS integration_id INTEGER REFERENCES email_integrations(id) ON DELETE CASCADE`,
    `ALTER TABLE automations ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL DEFAULT 1`
  ];

  for (const statement of alterStatements) {
    try {
      await pool.query(statement);
    } catch (_) {
      // ignore additive migrations if the column already exists or schema is partially created
    }
  }

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sends_public_token
    ON sends(public_token)
    WHERE public_token IS NOT NULL
  `);
}

class PostgresCompatWrapper {
  constructor(pool) {
    this.pool = pool;
    this._transactionDepth = 0;
    this._transactionClient = null;
  }

  _normaliseRow(row) {
    if (!row) return row;
    const normalised = {};
    for (const [key, value] of Object.entries(row)) {
      normalised[key] = value;
    }
    return normalised;
  }

  _normaliseRows(rows) {
    if (!Array.isArray(rows)) return rows;
    return rows.map((row) => this._normaliseRow(row));
  }

  _withClient(fn) {
    return this.pool.connect().then((client) => {
      const cleanup = () => client.release();
      return Promise.resolve(fn(client)).finally(cleanup);
    });
  }

  _normaliseSql(sql) {
    let normalised = String(sql || '')
      .replace(/datetime\(['"]?now['"]?\)/gi, 'NOW()')
      .replace(/date\(([^)]+)\)/gi, 'DATE($1)')
      .replace(/strftime\('([^']+)',\s*([^\)]+)\)/gi, (_, format, value) => {
        const pgFormat = format
          .replace(/%Y/g, 'YYYY')
          .replace(/%m/g, 'MM')
          .replace(/%d/g, 'DD')
          .replace(/%H/g, 'HH24')
          .replace(/%M/g, 'MI')
          .replace(/%S/g, 'SS');
        return `TO_CHAR(${value.trim()}, '${pgFormat}')`;
      })
      .replace(/julianday\(['"]?now['"]?\)/gi, 'EXTRACT(EPOCH FROM NOW()) / 86400.0')
      .replace(/julianday\(([^)]+)\)/gi, 'EXTRACT(EPOCH FROM ($1)) / 86400.0')
      .replace(/randomblob\(([^)]+)\)/gi, 'gen_random_bytes($1)')
      .replace(/hex\(([^)]+)\)/gi, 'encode($1, \'hex\')');

    if (/\bINSERT\s+OR\s+IGNORE\b/i.test(normalised) && !/\bON\s+CONFLICT\b/i.test(normalised)) {
      normalised = normalised.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, 'INSERT INTO');
      normalised = `${normalised.trim()} ON CONFLICT DO NOTHING`;
    }

    return normalised;
  }

  _getQueryTarget() {
    return this._transactionClient || this.pool;
  }

  _query(sql, params = []) {
    const values = Array.isArray(params) ? params : [params];
    const target = this._getQueryTarget();
    return target.query(this._normaliseSql(sql), values).then((result) => this._normaliseRows(result.rows));
  }

  _execute(sql, params = []) {
    const values = Array.isArray(params) ? params : [params];
    const target = this._getQueryTarget();
    return target.query(this._normaliseSql(sql), values).then((result) => {
      const lastInsertRowid = result.rows && result.rows[0] && 'id' in result.rows[0] ? result.rows[0].id : null;
      const changes = typeof result.rowCount === 'number' ? result.rowCount : 0;
      return { lastInsertRowid, changes };
    });
  }

  prepare(sql) {
    const wrapper = this;
    return {
      get(...params) {
        return wrapper._query(sql, params).then((rows) => rows[0]);
      },
      all(...params) {
        return wrapper._query(sql, params);
      },
      run(...params) {
        let query = wrapper._normaliseSql(sql);

        if (/\bINSERT\s+OR\s+IGNORE\b/i.test(query)) {
          query = query.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, 'INSERT INTO');
          if (!/\bON\s+CONFLICT\b/i.test(query)) {
            query = `${query.trim()} ON CONFLICT DO NOTHING`;
          }
        }

        const insertQuery = /\bINSERT\b/i.test(query);
        const hasReturning = /\bRETURNING\b/i.test(query);
        const finalQuery = insertQuery && !hasReturning ? `${query.trim()} RETURNING id AS "lastInsertRowid"` : query;
        return wrapper._execute(finalQuery, params).then((result) => {
          if (result.lastInsertRowid == null && /\bUPDATE\b|\bDELETE\b/i.test(sql.trim())) {
            return { lastInsertRowid: null, changes: result.changes };
          }
          return result;
        });
      }
    };
  }

  transaction(fn) {
    const wrapper = this;
    return (...args) => {
      return wrapper._withClient(async (client) => {
        wrapper._transactionClient = client;
        try {
          await client.query('BEGIN');
          const result = await fn(...args);
          await client.query('COMMIT');
          return result;
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          wrapper._transactionClient = null;
        }
      });
    };
  }

  pragma() {
    return undefined;
  }

  exec(sql) {
    return this.pool.query(sql).then((result) => ({ rowCount: result.rowCount || 0 }));
  }

  close() {
    return this.pool.end();
  }
}

async function createDatabase() {
  const databaseUrl = process.env.DATABASE_URL && process.env.DATABASE_URL.trim();
  if (databaseUrl) {
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.PGSSLMODE === 'require' || process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
    });

    try {
      await pool.query('SELECT 1');
      await ensurePostgresSchema(pool);
      console.info('[Database] PostgreSQL adapter ready for Vercel/serverless migration path.');
      return new PostgresCompatWrapper(pool);
    } catch (err) {
      console.warn('[Database] PostgreSQL connection failed, falling back to SQLite:', redactSensitive(err));
      await pool.end().catch(() => {});
    }
  }

  const SQL = await initSqlJs();
  const useInMemoryDb = isServerlessRuntime || !process.env.DATABASE_PATH;

  if (process.env.DATABASE_URL && !isServerlessRuntime) {
    console.info('[Database] DATABASE_URL detected; local runtime will continue in SQLite compatibility mode until the full Postgres migration is complete.');
  }

  let sqlDb;
  if (useInMemoryDb) {
    sqlDb = new SQL.Database();
  } else {
    try {
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    } catch (err) {
      console.warn('Database directory is not writable, falling back to in-memory SQLite for serverless runtime:', redactSensitive(err));
      sqlDb = new SQL.Database();
    }

    if (sqlDb == null && fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      sqlDb = new SQL.Database(buffer);
    } else if (sqlDb == null) {
      sqlDb = new SQL.Database();
    }
  }

  applySchema(sqlDb);

  if (!useInMemoryDb) {
    try {
      fs.writeFileSync(DB_PATH, Buffer.from(sqlDb.export()));
    } catch (err) {
      console.warn('Database write failed, falling back to in-memory SQLite for serverless runtime:', redactSensitive(err));
      return new SqlJsWrapper(new SQL.Database(sqlDb.export()));
    }
  }

  if (isServerlessRuntime) {
    console.info('[Database] SQLite fallback active in serverless runtime; local disk writes are disabled by design.');
  }

  return new SqlJsWrapper(sqlDb);
}

module.exports = { createDatabase, DB_PATH, PostgresCompatWrapper };
