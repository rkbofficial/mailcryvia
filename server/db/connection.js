const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const { applySchema } = require('./schema');
const { redactSensitive } = require('../utils/secrets');

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

async function createDatabase() {
  const SQL = await initSqlJs();
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  let sqlDb;
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    sqlDb = new SQL.Database(buffer);
  } else {
    sqlDb = new SQL.Database();
  }
  applySchema(sqlDb);
  fs.writeFileSync(DB_PATH, Buffer.from(sqlDb.export()));
  return new SqlJsWrapper(sqlDb);
}

module.exports = { createDatabase, DB_PATH };
