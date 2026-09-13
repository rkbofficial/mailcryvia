const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { decrypt } = require('./crypto');
const { getDefaultAppBaseUrl } = require('./appBaseUrl');
const { redactErrorMessage } = require('./secrets');
const { sanitizeHtml, isSafeUrl } = require('./sanitize');

function allowInvalidTls() {
  return process.env.SMTP_ALLOW_INVALID_TLS === 'true' && process.env.NODE_ENV !== 'production';
}

function smtpTlsOptions() {
  return { rejectUnauthorized: !allowInvalidTls() };
}

function createSendToken() {
  return crypto.randomBytes(24).toString('hex');
}

function getSmtpSettings(db) {
  const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'smtp_%' OR key LIKE 'default_%' OR key = 'app_base_url'").all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  settings.app_base_url = settings.app_base_url || getDefaultAppBaseUrl();
  return settings;
}

function createTransporter(settings) {
  const host = settings.smtp_host || 'smtp.gmail.com';
  const port = parseInt(settings.smtp_port || '587', 10);
  const secure = settings.smtp_tls === 'true' ? (port === 465) : false;
  const user = settings.smtp_username || '';
  const pass = settings.smtp_password ? decrypt(settings.smtp_password) : '';

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: smtpTlsOptions()
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function personaliseHtml(html, contact) {
  if (!html) return html;
  return html
    .replace(/\{\{first_name\}\}/g, escapeHtml(contact.first_name))
    .replace(/\{\{last_name\}\}/g, escapeHtml(contact.last_name))
    .replace(/\{\{email\}\}/g, escapeHtml(contact.email))
    .replace(/\{\{company\}\}/g, escapeHtml(contact.company));
}

function injectTrackingPixel(html, sendToken, baseUrl) {
  const pixel = `<img src="${baseUrl}/api/track/open/${sendToken}.png" width="1" height="1" style="display:none" alt="">`;
  if (html.includes('</body>')) {
    return html.replace('</body>', pixel + '</body>');
  }
  return html + pixel;
}

function wrapLinks(html, sendToken, baseUrl) {
  return html.replace(/<a\s([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi, (match, before, url, after) => {
    if (url.includes('/unsubscribe/') || url.includes('/api/track/') || !isSafeUrl(url)) {
      return match;
    }
    const encodedUrl = encodeURIComponent(url);
    return `<a ${before}href="${baseUrl}/api/track/click/${sendToken}?url=${encodedUrl}"${after}>`;
  });
}

function injectUnsubscribeFooter(html, sendToken, baseUrl) {
  const footer = `<p style="font-size:11px;color:#999;text-align:center;margin-top:20px;">Don't want these emails? <a href="${baseUrl}/unsubscribe/${sendToken}" style="color:#999;text-decoration:underline;">Unsubscribe</a></p>`;
  if (html.includes('</body>')) {
    return html.replace('</body>', footer + '</body>');
  }
  return html + footer;
}

function createTransporterFromIntegration(integration) {
  const port = parseInt(integration.smtp_port || 587, 10);
  const secure = integration.smtp_tls === 'true' ? (port === 465) : false;
  const pass = integration.smtp_password ? decrypt(integration.smtp_password) : '';
  return nodemailer.createTransport({
    host: integration.smtp_host,
    port,
    secure,
    auth: { user: integration.smtp_username, pass },
    tls: smtpTlsOptions(),
  });
}

async function sendCampaignEmail(db, campaignId) {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
  if (!campaign) throw new Error('Campaign not found');

  let transporter;
  let fromName;
  let fromEmail;

  if (campaign.email_integration_id) {
    const integration = db.prepare('SELECT * FROM email_integrations WHERE id = ? AND user_id = ?').get(campaign.email_integration_id, campaign.user_id);
    if (integration) {
      transporter = createTransporterFromIntegration(integration);
      fromName = campaign.from_name || integration.from_name;
      fromEmail = campaign.from_email || integration.from_email;
    }
  }

  if (!transporter) {
    const settings = getSmtpSettings(db);
    transporter = createTransporter(settings);
    fromName = campaign.from_name || settings.default_from_name || 'MailcryVia';
    fromEmail = campaign.from_email || settings.default_from_email || settings.smtp_username;
  }

  const settings = getSmtpSettings(db);
  const baseUrl = settings.app_base_url;

  const contacts = db.prepare(`
    SELECT c.* FROM contacts c
    JOIN list_contacts lc ON lc.contact_id = c.id
    WHERE lc.list_id = ? AND c.user_id = ? AND c.status = 'subscribed'
  `).all(campaign.list_id, campaign.user_id);

  if (contacts.length === 0) {
    db.prepare("UPDATE campaigns SET status = 'sent', sent_at = datetime('now') WHERE id = ?").run(campaignId);
    return { sent: 0, failed: 0 };
  }

  const insertSend = db.prepare('INSERT INTO sends (campaign_id, contact_id, status, public_token) VALUES (?, ?, ?, ?)');
  const updateSendSuccess = db.prepare("UPDATE sends SET status = 'sent', sent_at = datetime('now') WHERE id = ?");
  const updateSendFail = db.prepare("UPDATE sends SET status = 'failed', bounce_reason = ? WHERE id = ?");

  let sentCount = 0;
  let failedCount = 0;

  for (const contact of contacts) {
    const sendToken = createSendToken();
    const result = insertSend.run(campaignId, contact.id, 'pending', sendToken);
    const sendId = result.lastInsertRowid;

    let html = sanitizeHtml(personaliseHtml(campaign.html_content, contact));
    html = injectUnsubscribeFooter(html, sendToken, baseUrl);
    html = wrapLinks(html, sendToken, baseUrl);
    html = injectTrackingPixel(html, sendToken, baseUrl);

    const replyTo = campaign.reply_to || fromEmail;

    try {
      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: contact.email,
        replyTo,
        subject: campaign.subject,
        html
      });
      updateSendSuccess.run(sendId);
      sentCount++;
    } catch (err) {
      updateSendFail.run(redactErrorMessage(err).substring(0, 500), sendId);
      failedCount++;
    }
  }

  db.prepare("UPDATE campaigns SET status = 'sent', sent_at = datetime('now') WHERE id = ?").run(campaignId);

  return { sent: sentCount, failed: failedCount };
}

module.exports = {
  getSmtpSettings,
  createTransporter,
  createTransporterFromIntegration,
  createSendToken,
  personaliseHtml,
  injectTrackingPixel,
  wrapLinks,
  injectUnsubscribeFooter,
  smtpTlsOptions,
  sendCampaignEmail
};