try {
  require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
} catch (err) {
  // dotenv is optional in Vercel/serverless builds when env vars are injected by the platform.
}
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const serverless = require('serverless-http');
const fs = require('fs');
const path = require('path');
const { createDatabase } = require('./db/connection');
const { startScheduler, runScheduledJobs } = require('./jobs/scheduler');
const { validateRequiredSecrets, redactSensitive } = require('./utils/secrets');
const { getDefaultAppBaseUrl } = require('./utils/appBaseUrl');

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_DIST_PATH = path.resolve(__dirname, '../client/dist');
const isProduction = process.env.NODE_ENV === 'production';
const isServerlessRuntime = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const localDevOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];

function parseOrigins(value) {
  return (value || '').split(',').map((origin) => origin.trim()).filter(Boolean);
}

function getAllowedOrigins() {
  const configured = parseOrigins(process.env.CORS_ORIGIN);
  const appBaseUrl = process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL || '';
  const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';

  if (appBaseUrl) configured.push(appBaseUrl.replace(/\/+$/, ''));
  if (vercelUrl) configured.push(vercelUrl.replace(/\/+$/, ''));

  return [...new Set(isProduction ? configured : [...localDevOrigins, ...configured])];
}

function validateDeploymentConfig() {
  if (isServerlessRuntime && !process.env.DATABASE_URL) {
    return;
  }

  validateRequiredSecrets();

  if (process.env.CORS_ORIGIN?.split(',').some((origin) => origin.trim() === '*')) {
    throw new Error('CORS_ORIGIN must not contain *');
  }

  if (isProduction) {
    if (!isServerlessRuntime && !process.env.DATABASE_PATH && !process.env.DATA_DIR) {
      throw new Error('DATABASE_PATH or DATA_DIR must be set in production');
    }

    const appBaseUrl = process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
    if (!isServerlessRuntime && !appBaseUrl && !process.env.CORS_ORIGIN) {
      throw new Error('APP_BASE_URL, RENDER_EXTERNAL_URL, VERCEL_URL, or CORS_ORIGIN must be set in production');
    }
    const setupToken = (process.env.INITIAL_ADMIN_SETUP_TOKEN || '').trim();
    if (!setupToken || setupToken.length < 32) {
      throw new Error('INITIAL_ADMIN_SETUP_TOKEN must be set to a random value of at least 32 characters in production');
    }
  }
}

const allowedOrigins = getAllowedOrigins();

app.set('trust proxy', 1);

app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 400) {
      const safeBody = body && typeof body === 'object' ? { ...body } : { error: 'Request failed' };
      if (res.statusCode >= 500) safeBody.error = 'Internal server error';
      safeBody.correlationId = req.id;
      return originalJson(safeBody);
    }
    return originalJson(body);
  };

  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
      connectSrc: ["'self'", ...allowedOrigins, 'http://localhost:4000', 'ws://localhost:5173'],
      imgSrc: ["'self'", 'data:', 'https:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      frameSrc: ['https://api.razorpay.com', 'https://checkout.razorpay.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  frameguard: { action: 'deny' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: false },
}));

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    return callback(null, allowedOrigins.includes(origin));
  },
  credentials: true,
}));

app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ipHeader = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const primary = typeof ipHeader === 'string' ? ipHeader.split(',')[0].trim() : '';
    return primary || req.ip || req.socket?.remoteAddress || 'serverless-client';
  },
}));

if (!isProduction) {
  app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
  });
}

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

async function ensureAppDatabase() {
  if (app.locals.db !== undefined) return app.locals.db;

  if (isServerlessRuntime && !process.env.DATABASE_URL) {
    console.warn('[Database] Vercel serverless startup without DATABASE_URL; skipping DB bootstrap to avoid cold-start timeout.');
    app.locals.db = null;
    return null;
  }

  const db = await createDatabase();
  db.pragma('foreign_keys = ON');
  app.locals.db = db;
  app.locals.clientDistPath = CLIENT_DIST_PATH;
  return db;
}

async function initializeApp() {
  if (app.locals.routesReady) return app;

  validateDeploymentConfig();
  const db = await ensureAppDatabase();
  const skipDbRoutes = isServerlessRuntime && !process.env.DATABASE_URL;

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/cron/run', async (req, res) => {
    if (skipDbRoutes) {
      return res.status(503).json({ error: 'Database not configured for this deployment; add DATABASE_URL to enable cron jobs.' });
    }

    const expectedSecret = process.env.CRON_SECRET || process.env.INITIAL_ADMIN_SETUP_TOKEN;
    const providedSecret = String(req.headers['x-cron-secret'] || req.query.secret || '').trim();

    if (expectedSecret && providedSecret !== expectedSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!expectedSecret) {
      console.warn('[Cron] CRON_SECRET not configured; cron endpoints are currently open. Set CRON_SECRET in production.');
    }

    try {
      await runScheduledJobs(app.locals.db);
      res.json({ success: true, message: 'Scheduled jobs processed' });
    } catch (err) {
      console.error('[Cron] Scheduled run failed:', redactSensitive(err));
      res.status(500).json({ error: 'Scheduled job failed' });
    }
  });

  app.use(async (req, res, next) => {
    if (skipDbRoutes) {
      return next();
    }

    try {
      await ensureAppDatabase();
      next();
    } catch (err) {
      next(err);
    }
  });

  if (!skipDbRoutes) {
    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/track', require('./routes/tracking'));
    app.use('/unsubscribe', require('./routes/unsubscribe'));
    app.use('/api/plans', require('./routes/plans'));

    const authMiddleware = require('./middleware/auth');
    app.use('/api/contacts', authMiddleware, require('./routes/contacts'));
    app.use('/api/lists', authMiddleware, require('./routes/lists'));
    app.use('/api/templates', authMiddleware, require('./routes/templates'));
    app.use('/api/campaigns', authMiddleware, require('./routes/campaigns'));
    app.use('/api/analytics', authMiddleware, require('./routes/analytics'));
    app.use('/api/automations', authMiddleware, require('./routes/automations'));
    app.use('/api/settings', authMiddleware, require('./routes/settings'));
    app.use('/api/users', authMiddleware, require('./routes/users'));
    app.use('/api/inbox', authMiddleware, require('./routes/inbox'));
    app.use('/api/subscriptions', authMiddleware, require('./routes/subscriptions'));
    app.use('/api/email-integrations', authMiddleware, require('./routes/email-integrations'));
    app.use('/api/admin', authMiddleware, require('./routes/admin'));
    app.use('/api/events', authMiddleware, require('./routes/events'));
  } else {
    app.use('/api', (req, res) => {
      res.status(503).json({ error: 'Database not configured for this Vercel deployment. Add DATABASE_URL to enable the app.' });
    });
    app.use('/unsubscribe', (req, res) => {
      res.status(503).send('Database not configured for this Vercel deployment. Add DATABASE_URL to enable the app.');
    });
  }

  if (isProduction && fs.existsSync(CLIENT_DIST_PATH)) {
    app.use(express.static(CLIENT_DIST_PATH));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/unsubscribe/')) return next();
      return res.sendFile(path.join(CLIENT_DIST_PATH, 'index.html'));
    });
  } else if (isProduction) {
    console.warn('Client build not found; frontend routes will not be served.', { correlationId: 'startup' });
  }

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((err, req, res, next) => {
    console.error('Unhandled error:', { correlationId: req.id, error: redactSensitive(err) });
    res.status(500).json({ error: 'Internal server error' });
  });

  app.locals.routesReady = true;
  app.locals.db = db;

  if (!isServerlessRuntime && typeof startScheduler === 'function' && !app.locals.schedulerStarted) {
    try {
      startScheduler(db);
      app.locals.schedulerStarted = true;
    } catch (_) {}
  }

  return app;
}

async function startServer() {
  await initializeApp();

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.info(`MailcryVia server listening on port ${PORT}`);
  });

  let isShuttingDown = false;
  const shutdown = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    server.close(() => {
      if (app.locals.db && typeof app.locals.db.close === 'function') {
        app.locals.db.close();
      }
      process.exit(0);
    });

    setTimeout(() => process.exit(1), 5000).unref();
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
  initializeApp().catch((err) => {
    console.error('Vercel app init failed:', redactSensitive(err));
  });
} else if (require.main === module) {
  startServer().catch(err => {
    console.error('Failed to start server:', redactSensitive(err));
    process.exit(1);
  });
}

if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
  const vercelHandler = serverless(app);
  module.exports = app;
  module.exports.handler = async function serverlessEntry(event, context) {
    await initializeApp();
    return vercelHandler(event, context);
  };
} else {
  module.exports = app;
}

module.exports.initializeApp = initializeApp;
module.exports.ensureAppDatabase = ensureAppDatabase;