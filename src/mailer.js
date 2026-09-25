const nodemailer = require('nodemailer');
const { sleep } = require('./utils');

/**
 * Creates an SMTP Transporter based on provided configuration
 */
function createTransporter(config) {
  const { provider = 'gmail', user, pass, host, port, secure } = config;

  if (provider === 'gmail') {
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      family: 4,
      auth: {
        user: user.trim(),
        pass: pass.trim().replace(/\s+/g, '')
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 20000,
      greetingTimeout: 15000,
      socketTimeout: 30000
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
    },
    tls: {
      rejectUnauthorized: false
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
 * Replace placeholders like {{name}}, {{city}}, {{category}}, {{website}}, {{audit_issues}}, {{portfolio}}
 */
function interpolateTemplate(template, lead) {
  if (!template) return '';
  const audit = lead.websiteAudit || {};
  const issuesList = audit.issues && audit.issues.length > 0 ? audit.issues.join('; ') : 'not mobile optimized';
  const firstIssue = audit.issues && audit.issues.length > 0 ? audit.issues[0] : 'not mobile optimized';
  const auditSummary = audit.summary || 'could use a modern refresh';

  return template
    .replace(/\{\{\s*name\s*\}\}/gi, lead.name || 'there')
    .replace(/\{\{\s*city\s*\}\}/gi, lead.city || 'your area')
    .replace(/\{\{\s*category\s*\}\}/gi, lead.category || 'local business')
    .replace(/\{\{\s*website\s*\}\}/gi, lead.website || 'your website')
    .replace(/\{\{\s*phone\s*\}\}/gi, lead.phone || '')
    .replace(/\{\{\s*portfolio\s*\}\}/gi, 'https://aaravsinh-rathod-portfolio-9.vercel.app/')
    .replace(/\{\{\s*audit_issues\s*\}\}/gi, issuesList)
    .replace(/\{\{\s*audit_first_issue\s*\}\}/gi, firstIssue)
    .replace(/\{\{\s*audit_summary\s*\}\}/gi, auditSummary);
}

/**
 * Run automated cold email outreach campaign with safe human-paced delays.
 * Features Smart Adaptive Pitching: Automatically sends "No Website" pitch to businesses without a site,
 * and "Website Redesign & Modernization" pitch to businesses with an existing/outdated site.
 */
async function runEmailCampaign(options) {
  const {
    leads = [],
    config,
    subjectTemplate,
    bodyTemplate,
    subjectTemplateRedesign,
    bodyTemplateRedesign,
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

    // Smart Adaptive Pitch Selection:
    // If the business has a website and a redesign template is provided, use the Redesign pitch!
    const hasWebsite = Boolean(lead.website);
    let chosenSubject = subjectTemplate;
    let chosenBody = bodyTemplate;

    if (hasWebsite && bodyTemplateRedesign) {
      chosenBody = bodyTemplateRedesign;
      if (subjectTemplateRedesign) chosenSubject = subjectTemplateRedesign;
    }

    const personalizedSubject = interpolateTemplate(chosenSubject, lead);
    const personalizedBody = interpolateTemplate(chosenBody, lead);

    const pitchType = hasWebsite && bodyTemplateRedesign ? '🎨 Redesign Pitch' : '📝 New Website Pitch';
    onLog(`[Email Bot] [${i + 1}/${leads.length}] Sending ${pitchType} to ${lead.name} (${targetEmail})...`);

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
