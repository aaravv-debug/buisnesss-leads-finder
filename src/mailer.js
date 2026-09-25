const nodemailer = require('nodemailer');
const { sleep } = require('./utils');

/**
 * Creates an SMTP Transporter based on provided configuration
 */
function createTransporter(config) {
  const { provider = 'gmail', user, pass, host, port, secure } = config;

  if (provider === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: user.trim(),
        pass: pass.trim().replace(/\s+/g, '') // strip spaces if copied from Google App Password
      }
    });
  }

  // Custom SMTP (Brevo, SendGrid, Outlook, Namecheap, etc.)
  return nodemailer.createTransport({
    host: host || 'smtp.gmail.com',
    port: parseInt(port, 10) || 587,
    secure: Boolean(secure),
    auth: {
      user: user.trim(),
      pass: pass.trim()
    }
  });
}

/**
 * Verify SMTP connection
 */
async function verifyConnection(config) {
  try {
    const transporter = createTransporter(config);
    await transporter.verify();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Replace placeholders like {{name}}, {{city}}, {{category}}
 */
function interpolateTemplate(template, lead) {
  if (!template) return '';
  return template
    .replace(/\{\{\s*name\s*\}\}/gi, lead.name || 'there')
    .replace(/\{\{\s*city\s*\}\}/gi, lead.city || 'your area')
    .replace(/\{\{\s*category\s*\}\}/gi, lead.category || 'local business')
    .replace(/\{\{\s*website\s*\}\}/gi, lead.website || 'none')
    .replace(/\{\{\s*phone\s*\}\}/gi, lead.phone || '');
}

/**
 * Run automated cold email outreach campaign with safe human-paced delays
 */
async function runEmailCampaign(options) {
  const {
    leads = [],
    config,
    subjectTemplate,
    bodyTemplate,
    delaySeconds = 25,
    onProgress = () => {},
    onLog = () => {}
  } = options;

  onLog(`[Email Bot] Initializing campaign for ${leads.length} selected lead(s)...`);
  const transporter = createTransporter(config);

  const results = {
    total: leads.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    details: []
  };

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const targetEmail = lead.emails && lead.emails.length > 0 ? lead.emails[0] : null;

    if (!targetEmail) {
      onLog(`[Email Bot] Skipped ${lead.name} (No email address discovered).`);
      results.skipped++;
      results.details.push({ id: lead.id, name: lead.name, status: 'skipped', reason: 'No email' });
      onProgress({ current: i + 1, total: leads.length, sent: results.sent, failed: results.failed });
      continue;
    }

    const personalizedSubject = interpolateTemplate(subjectTemplate, lead);
    const personalizedBody = interpolateTemplate(bodyTemplate, lead);

    onLog(`[Email Bot] [${i + 1}/${leads.length}] Sending to ${lead.name} (${targetEmail})...`);

    try {
      await transporter.sendMail({
        from: `"${config.senderName || 'Freelance Web Designer'}" <${config.user}>`,
        to: targetEmail,
        subject: personalizedSubject,
        text: personalizedBody,
        html: personalizedBody.replace(/\n/g, '<br>')
      });

      results.sent++;
      results.details.push({ id: lead.id, name: lead.name, email: targetEmail, status: 'sent' });
      onLog(`[Email Bot] ✅ Successfully delivered to ${lead.name}!`);
    } catch (err) {
      results.failed++;
      results.details.push({ id: lead.id, name: lead.name, email: targetEmail, status: 'failed', error: err.message });
      onLog(`[Email Bot] ❌ Failed to send to ${lead.name}: ${err.message}`);
    }

    onProgress({ current: i + 1, total: leads.length, sent: results.sent, failed: results.failed });

    // Safe delay before sending the next email (unless last lead)
    if (i < leads.length - 1) {
      onLog(`[Email Bot] Waiting ${delaySeconds}s to protect domain sender reputation...`);
      await sleep(delaySeconds * 1000);
    }
  }

  onLog(`[Email Bot] Campaign finished! Sent: ${results.sent}, Failed: ${results.failed}, Skipped: ${results.skipped}.`);
  return results;
}

module.exports = {
  createTransporter,
  verifyConnection,
  interpolateTemplate,
  runEmailCampaign
};
