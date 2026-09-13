function normalizeAppBaseUrl(value) {
  if (!value) return '';
  return String(value).trim().replace(/\/+$/, '');
}

function getDefaultAppBaseUrl() {
  const configuredUrl = normalizeAppBaseUrl(
    process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL
  );

  if (configuredUrl) return configuredUrl;

  return `http://localhost:${process.env.PORT || 4000}`;
}

module.exports = {
  getDefaultAppBaseUrl,
  normalizeAppBaseUrl,
};
