const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const distRoot = path.resolve(__dirname, '../dist');
const fallbackDistRoot = path.resolve(__dirname, '../client/dist');
const staticRoot = fs.existsSync(distRoot) ? distRoot : fs.existsSync(fallbackDistRoot) ? fallbackDistRoot : null;

if (staticRoot) {
  app.use(express.static(staticRoot));
  app.get(['/', '/login', '/dashboard', '/campaigns', '/templates', '/contacts', '/lists', '/settings', '/admin', '/billing', '/plans', '/inbox', '/automations', '/analytics', '/unsubscribe/:token*', '/:path((?!api).+)'], (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/unsubscribe/')) return next();
    res.sendFile(path.join(staticRoot, 'index.html'));
  });
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', require('../server/routes/auth'));
app.use('/api/plans', require('../server/routes/plans'));
app.use('/api/track', require('../server/routes/tracking'));
app.use('/unsubscribe', require('../server/routes/unsubscribe'));

app.use(async (req, res, next) => {
  if (process.env.VERCEL && !process.env.DATABASE_URL) {
    return res.status(503).json({
      error: 'Database not configured for this Vercel deployment.',
      message: 'Add DATABASE_URL to enable the backend.'
    });
  }

  try {
    const serverModule = require('../server');
    if (typeof serverModule.initializeApp === 'function') {
      await serverModule.initializeApp();
    }
    return typeof serverModule === 'function' ? serverModule(req, res, next) : serverModule.handle(req, res, next);
  } catch (err) {
    console.error('Vercel API fallback failed:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = app;
