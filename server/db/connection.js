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

class PostgresCompatWrapper {
  constructor(pool) {
    this.pool = pool;
    this._transactionDepth = 0;
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

  _query(sql, params = []) {
    const values = Array.isArray(params) ? params : [params];
    return this.pool.query(sql, values).then((result) => this._normaliseRows(result.rows));
  }

  _execute(sql, params = []) {
    const values = Array.isArray(params) ? params : [params];
    return this.pool.query(sql, values).then((result) => {
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
        const insertQuery = /\bINSERT\b/i.test(sql.trim());
        const hasReturning = /\bRETURNING\b/i.test(sql.trim());
        const query = insertQuery && !hasReturning ? `${sql.trim()} RETURNING id AS "lastInsertRowid"` : sql;
        return wrapper._execute(query, params).then((result) => {
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
        await client.query('BEGIN');
        try {
          const result = await fn(...args);
          await client.query('COMMIT');
          return result;
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
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

module.exports = { createDatabase, DB_PATH };
