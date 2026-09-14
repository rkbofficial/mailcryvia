const express = require('express');

const app = express();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use((req, res, next) => {
  if (process.env.VERCEL && !process.env.DATABASE_URL) {
    return res.status(503).json({
      error: 'Database not configured for this Vercel deployment.',
      message: 'Add DATABASE_URL to enable the backend.'
    });
  }

  try {
    const serverApp = require('../server');
    return typeof serverApp === 'function' ? serverApp(req, res, next) : serverApp.handle(req, res, next);
  } catch (err) {
    console.error('Vercel API fallback failed:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = app;
