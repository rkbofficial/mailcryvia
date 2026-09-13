const cron = require('node-cron');
const { sendCampaignEmail, getSmtpSettings, createTransporter, createSendToken, personaliseHtml, injectTrackingPixel, wrapLinks, injectUnsubscribeFooter } = require('../utils/email');
const { getDefaultAppBaseUrl } = require('../utils/appBaseUrl');
const { broadcast } = require('../utils/sse');
const { redactSensitive, redactErrorMessage } = require('../utils/secrets');
const { sanitizeHtml } = require('../utils/sanitize');

async function runScheduledJobs(db) {
  try {
    const campaigns = db.prepare(
      "SELECT * FROM campaigns WHERE status = 'scheduled' AND scheduled_at <= datetime('now')"
    ).all();

    for (const campaign of campaigns) {
      console.info(`[Scheduler] Sending scheduled campaign id=${campaign.id}`);
      try {
        const list = db.prepare('SELECT id FROM lists WHERE id = ? AND user_id = ?').get(campaign.list_id, campaign.user_id);
        if (!list) {
          db.prepare("UPDATE campaigns SET status = 'failed' WHERE id = ?").run(campaign.id);
          console.warn(`[Scheduler] Campaign id=${campaign.id} has no owned list`);
          continue;
        }
        if (campaign.email_integration_id) {
          const integration = db.prepare('SELECT id FROM email_integrations WHERE id = ? AND user_id = ?').get(campaign.email_integration_id, campaign.user_id);
          if (!integration) {
            db.prepare("UPDATE campaigns SET status = 'failed' WHERE id = ?").run(campaign.id);
            console.warn(`[Scheduler] Campaign id=${campaign.id} has no owned sender`);
            continue;
          }
        }

        db.prepare("UPDATE campaigns SET status = 'sending' WHERE id = ?").run(campaign.id);
        const result = await sendCampaignEmail(db, campaign.id);
        console.info(`[Scheduler] Campaign id=${campaign.id} sent=${result.sent} failed=${result.failed}`);
        broadcast('campaigns');
        if (result.sent > 0 && campaign.user_id) {
          const today = new Date().toISOString().slice(0, 10);
          db.prepare('INSERT INTO daily_send_counts (user_id, date, count) VALUES (?, ?, ?) ON CONFLICT(user_id, date) DO UPDATE SET count = count + ?')
            .run(campaign.user_id, today, result.sent, result.sent);
        }
      } catch (err) {
        console.error(`[Scheduler] Failed to send campaign id=${campaign.id}:`, redactErrorMessage(err));
        db.prepare("UPDATE campaigns SET status = 'failed' WHERE id = ?").run(campaign.id);
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error checking scheduled campaigns:', redactSensitive(err));
  }

  try {
    const automations = db.prepare(`
      SELECT a.*, t.subject as template_subject, t.html_content as template_html
      FROM automations a
      JOIN templates t ON t.id = a.template_id AND t.user_id = a.user_id
      JOIN lists l ON l.id = a.list_id AND l.user_id = a.user_id
      WHERE a.active = 1
    `).all();

    for (const automation of automations) {
      const contacts = db.prepare(`
        SELECT c.* FROM contacts c
        JOIN list_contacts lc ON lc.contact_id = c.id
        WHERE lc.list_id = ? AND c.user_id = ? AND c.status = 'subscribed'
        AND c.id NOT IN (
          SELECT contact_id FROM sends WHERE automation_id = ?
        )
        AND julianday('now') - julianday(COALESCE(lc.added_at, c.created_at)) >= ?
      `).all(automation.list_id, automation.user_id, automation.id, automation.delay_days);

      if (contacts.length > 0) {
        const settings = getSmtpSettings(db);
        const baseUrl = settings.app_base_url || getDefaultAppBaseUrl();
        const transporter = createTransporter(settings);

        for (const contact of contacts) {
          const sendToken = createSendToken();
          const result = db.prepare(
            'INSERT INTO sends (campaign_id, automation_id, contact_id, status, public_token) VALUES (NULL, ?, ?, ?, ?)'
          ).run(automation.id, contact.id, 'pending', sendToken);
          const sendId = result.lastInsertRowid;

          try {
            let html = sanitizeHtml(personaliseHtml(automation.template_html, contact));
            html = injectUnsubscribeFooter(html, sendToken, baseUrl);
            html = wrapLinks(html, sendToken, baseUrl);
            html = injectTrackingPixel(html, sendToken, baseUrl);

            const fromName = settings.default_from_name || 'MailcryVia';
            const fromEmail = settings.default_from_email || settings.smtp_username;

            await transporter.sendMail({
              from: `"${fromName}" <${fromEmail}>`,
              to: contact.email,
              subject: automation.template_subject || 'Hello!',
              html
            });

            db.prepare("UPDATE sends SET status = 'sent', sent_at = datetime('now') WHERE id = ?").run(sendId);
            console.info(`[Scheduler] Automation id=${automation.id} sent contact_id=${contact.id}`);
          } catch (err) {
            db.prepare("UPDATE sends SET status = 'failed', bounce_reason = ? WHERE id = ?").run(
              redactErrorMessage(err).substring(0, 500), sendId
            );
            console.error(`[Scheduler] Automation send failed automation_id=${automation.id} contact_id=${contact.id}:`, redactErrorMessage(err));
          }
        }
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error processing automations:', redactSensitive(err));
  }
}

function startScheduler(db) {
  const isServerlessRuntime = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (isServerlessRuntime) {
    console.info('[Scheduler] Cron scheduler disabled in serverless runtime; use Vercel Cron or an external worker for scheduled jobs.');
    return false;
  }

  cron.schedule('* * * * *', async () => {
    try {
      await runScheduledJobs(db);
    } catch (err) {
      console.error('[Scheduler] Scheduled run failed:', redactSensitive(err));
    }
  });

  console.info('[Scheduler] Cron scheduler started');
}

module.exports = { startScheduler, runScheduledJobs };