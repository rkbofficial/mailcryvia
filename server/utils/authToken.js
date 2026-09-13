const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('./secrets');

const AUTH_COOKIE = 'mailcryvia_auth';
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const revokedTokens = new Map();

function cleanupRevokedTokens() {
  const now = Math.floor(Date.now() / 1000);
  for (const [jti, exp] of revokedTokens.entries()) {
    if (!exp || exp <= now) revokedTokens.delete(jti);
  }
}

function cleanupRevokedTokensDb(db) {
  if (!db) return;
  try {
    db.prepare('DELETE FROM revoked_tokens WHERE expires_at <= ?').run(Math.floor(Date.now() / 1000));
  } catch (_) {}
}

function isTokenRevoked(decoded, db) {
  if (!decoded?.jti) return false;
  cleanupRevokedTokens();
  if (revokedTokens.has(decoded.jti)) return true;
  if (db) {
    cleanupRevokedTokensDb(db);
    try {
      return Boolean(db.prepare('SELECT jti FROM revoked_tokens WHERE jti = ?').get(decoded.jti));
    } catch (_) {}
  }
  return false;
}

function signAuthToken(user) {
  cleanupRevokedTokens();
  return jwt.sign(
    { id: user.id, role: user.role || 'user', jti: crypto.randomUUID() },
    getJwtSecret(),
    { expiresIn: TOKEN_TTL_SECONDS }
  );
}

function verifyAuthToken(token, db) {
  const decoded = jwt.verify(token, getJwtSecret());
  if (isTokenRevoked(decoded, db)) {
    throw new Error('Token revoked');
  }
  return decoded;
}

function revokeAuthToken(token, db) {
  const decoded = jwt.decode(token);
  if (decoded?.jti) {
    const exp = decoded.exp || Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
    revokedTokens.set(decoded.jti, exp);
    if (db) {
      try {
        cleanupRevokedTokensDb(db);
        db.prepare(`
          INSERT INTO revoked_tokens (jti, expires_at) VALUES (?, ?)
          ON CONFLICT(jti) DO UPDATE SET expires_at = excluded.expires_at
        `).run(decoded.jti, exp);
      } catch (_) {}
    }
  }
}

function parseCookieHeader(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }
  return parseCookieHeader(req.headers.cookie)[AUTH_COOKIE] || '';
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TOKEN_TTL_SECONDS * 1000,
    path: '/',
  };
}

function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE, token, cookieOptions());
}

function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE, { ...cookieOptions(), maxAge: undefined });
}

module.exports = {
  AUTH_COOKIE,
  signAuthToken,
  verifyAuthToken,
  revokeAuthToken,
  getTokenFromRequest,
  setAuthCookie,
  clearAuthCookie,
};