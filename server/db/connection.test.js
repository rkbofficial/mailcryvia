const test = require('node:test');
const assert = require('node:assert/strict');
const { PostgresCompatWrapper } = require('./connection');

test('Postgres transaction uses the transaction client for queries', async () => {
  const calls = [];
  const pool = {
    query: async (sql, params) => {
      calls.push(['pool', sql, params]);
      return { rows: [], rowCount: 0 };
    },
    connect: async () => ({
      query: async (sql, params) => {
        calls.push(['client', sql, params]);
        if (sql === 'BEGIN') return { rows: [] };
        if (sql === 'COMMIT') return { rows: [] };
        if (sql === 'ROLLBACK') return { rows: [] };
        return { rows: [{ id: 42 }], rowCount: 1 };
      },
      release: () => {},
    }),
  };

  const wrapper = new PostgresCompatWrapper(pool);
  const result = await wrapper.transaction(async () => {
    const runResult = await wrapper.prepare('INSERT INTO users (email) VALUES ($1) RETURNING id').run('a@b.com');
    assert.equal(runResult.lastInsertRowid, 42);
    return 'ok';
  })();

  assert.equal(result, 'ok');
  assert.equal(calls.filter(([source]) => source === 'client').length > 0, true);
  assert.equal(calls.some(([source, sql]) => source === 'client' && sql === 'BEGIN'), true);
  assert.equal(calls.some(([source, sql]) => source === 'client' && sql === 'COMMIT'), true);
});

test('Postgres normalizes INSERT OR IGNORE to ON CONFLICT DO NOTHING', async () => {
  const calls = [];
  const pool = {
    query: async (sql, params) => {
      calls.push(['pool', sql, params]);
      return { rows: [], rowCount: 0 };
    },
    connect: async () => ({
      query: async (sql, params) => {
        calls.push(['client', sql, params]);
        if (sql === 'BEGIN') return { rows: [] };
        if (sql === 'COMMIT') return { rows: [] };
        if (sql === 'ROLLBACK') return { rows: [] };
        return { rows: [{ id: 7 }], rowCount: 1 };
      },
      release: () => {},
    }),
  };

  const wrapper = new PostgresCompatWrapper(pool);
  const result = await wrapper.transaction(async () => {
    const runResult = await wrapper.prepare('INSERT OR IGNORE INTO contacts (user_id, email) VALUES ($1, $2)').run(1, 'a@b.com');
    assert.equal(runResult.lastInsertRowid, 7);
    return 'ignore-ok';
  })();

  assert.equal(result, 'ignore-ok');
  assert.equal(calls.some(([source, sql]) => source === 'client' && sql.includes('INSERT INTO contacts (user_id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id AS "lastInsertRowid"')), true);
});

test('Postgres normalizes SQLite date and strftime functions', () => {
  const wrapper = new PostgresCompatWrapper({ query: async () => ({ rows: [], rowCount: 0 }), connect: async () => ({ query: async () => ({ rows: [], rowCount: 0 }), release: () => {} }) });

  assert.match(wrapper._normaliseSql("SELECT date(created_at) FROM users WHERE datetime('now') > ?"), /DATE\(created_at\)/);
  assert.match(wrapper._normaliseSql("SELECT strftime('%Y-%m', created_at) FROM users"), /TO_CHAR\(created_at, 'YYYY-MM'\)/);
  assert.match(wrapper._normaliseSql("SELECT julianday('now') - julianday(COALESCE(lc.added_at, c.created_at))"), /EXTRACT\(EPOCH FROM NOW\(\)\)/);
});
