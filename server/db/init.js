const { createDatabase } = require('./connection');
const { redactSensitive } = require('../utils/secrets');

async function initializeDatabase() {
  const db = await createDatabase();
  db.close();
  console.info('Database initialized successfully');
}

initializeDatabase().catch(err => {
  console.error('Failed to initialize database:', redactSensitive(err));
  process.exit(1);
});