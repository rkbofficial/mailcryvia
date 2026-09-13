function sanitizeText(value, maxLength = 1000) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength);
}

function sanitizeEmail(value) {
  return sanitizeText(value, 320).toLowerCase();
}

function sanitizeHtml(html, maxLength = 500000) {
  if (!html) return '';
  return String(html)
    .slice(0, maxLength)
    .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<\s*(iframe|object|embed|form|meta|link|base)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(iframe|object|embed|form|meta|link|base)\b[^>]*\/?>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src|xlink:href)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1="#"')
    .replace(/style\s*=\s*(["'])[\s\S]*?expression\s*\([\s\S]*?\1/gi, '');
}

function isSafeUrl(value) {
  if (!value) return true;
  try {
    const parsed = new URL(String(value));
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol);
  } catch {
    return !/^\s*javascript:/i.test(String(value));
  }
}

function asPositiveInt(value, fallback, { min = 1, max = 100 } = {}) {
  const parsed = parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

module.exports = { sanitizeText, sanitizeEmail, sanitizeHtml, isSafeUrl, asPositiveInt };