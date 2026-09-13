const crypto = require('crypto');

const UNSAFE_SECRET_HASHES = new Set([
  'e3ea5f77cf5e3169542bb4eb331ae13ba7e4daad51631bf595a1d8e7954406a1',
  'a8ae6e6ee929abea3afcfc5258c8ccd6f85273e0d4626d26c7279f3250f77c8e',
]);
const REDACTED = '[REDACTED]';

let cachedJwtSecret;
let cachedEncryptionKey;

function fingerprint(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function requireSecret(name, options = {}) {
  const value = process.env[name];
  const trimmed = typeof value === 'string' ? value.trim() : '';

  if (!trimmed) {
    throw new Error(`${name} must be set in the environment`);
  }
  if (options.minLength && trimmed.length < options.minLength) {
    throw new Error(`${name} must be at least ${options.minLength} characters`);
  }
  if (options.pattern && !options.pattern.test(trimmed)) {
    throw new Error(`${name} has an invalid format`);
  }

  const disallowedHashes = options.disallowHashes || UNSAFE_SECRET_HASHES;
  if (disallowedHashes.has(fingerprint(trimmed))) {
    throw new Error(`${name} is still using an unsafe default value`);
  }

  return trimmed;
}

function getJwtSecret() {
  if (!cachedJwtSecret) {
    cachedJwtSecret = requireSecret('JWT_SECRET', {
      minLength: 32,
    });
  }
  return cachedJwtSecret;
}

function getEncryptionKey() {
  if (!cachedEncryptionKey) {
    cachedEncryptionKey = requireSecret('ENCRYPTION_KEY', {
      pattern: /^[a-f0-9]{64}$/i,
    });
  }
  return cachedEncryptionKey;
}

function validateRequiredSecrets() {
  getJwtSecret();
  getEncryptionKey();
}

function stringifyForRedaction(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.stack || value.message || String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function redactSensitive(value) {
  return stringifyForRedaction(value)
    .replace(/(authorization["'\s:=]+bearer\s+)[^"'\s,;]+/gi, `$1${REDACTED}`)
    .replace(/(bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, `$1${REDACTED}`)
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, REDACTED)
    .replace(/\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql):\/\/[^\s"'<>]+/gi, REDACTED)
    .replace(/\bsk_(?:live|test)_[A-Za-z0-9_-]+\b/g, REDACTED)
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, REDACTED)
    .replace(/\brzp_(?:live|test)_[A-Za-z0-9]+\b/g, REDACTED)
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, REDACTED)
    .replace(
      /\b(password|passwd|pwd|secret|token|api[_-]?key|key[_-]?secret|client[_-]?secret|private[_-]?key)(["'\s:=]+)([^"'\s,;]+)/gi,
      `$1$2${REDACTED}`
    );
}

function redactErrorMessage(error) {
  const message = error?.message || String(error || 'Unknown error');
  return redactSensitive(message) || 'Unknown error';
}

module.exports = {
  getJwtSecret,
  getEncryptionKey,
  validateRequiredSecrets,
  redactSensitive,
  redactErrorMessage,
};