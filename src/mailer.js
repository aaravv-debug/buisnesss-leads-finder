const dns = require('dns');
try { dns.setDefaultResultOrder('ipv4first'); } catch (_) {}
dns.setServers(['8.8.8.8', '1.1.1.1']);
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { sleep } = require('./utils');

const SUPPRESSION_PATH = path.join(__dirname, '..', 'data', 'suppression-list.json');

/**
 * Check if the domain has valid MX records so we never send to a dead or non-existent mail server
 */
async function verifyDomainMx(email) {
  try {
    const domain = (email.split('@')[1] || '').trim().toLowerCase();
    if (!domain || !domain.includes('.')) return false;
    const records = await dns.promises.resolveMx(domain);
    return Boolean(records && records.length > 0);
  } catch (err) {
    return false;
  }
}

/**
 * Helper to check suppression list
 */
function isSuppressed(email) {
  try {
    if (fs.existsSync(SUPPRESSION_PATH)) {
      const list = JSON.parse(fs.readFileSync(SUPPRESSION_PATH, 'utf8'));
      return list.map(e => e.toLowerCase()).includes(email.toLowerCase().trim());
    }
  } catch (_) {}
  return false;
}

/**
 * Helper to add to suppression list
 */
function addToSuppressionList(email) {
  try {
    let list = [];
    if (fs.existsSync(SUPPRESSION_PATH)) {
      list = JSON.parse(fs.readFileSync(SUPPRESSION_PATH, 'utf8'));
    }
    const clean = email.toLowerCase().trim();
    if (!list.includes(clean)) {
      list.push(clean);
      fs.writeFileSync(SUPPRESSION_PATH, JSON.stringify(list, null, 2), 'utf8');
    }
  } catch (_) {}
}

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
 * Run automated cold email outreach campaign with safe human-paced delays and anti-spam protection.
 */
async function runEmailCampaign(options) {
  const {
    leads = [],
    config,
    subjectTemplate,
    bodyTemplate,
    subjectTemplateRedesign,
    bodyTemplateRedesign,
    dynamicPitchGenerator,
    delaySeconds = 30,
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
    const targetEmail = lead.emails && lead.emails.length > 0 ? lead.emails[0].trim() : null;

    if (!targetEmail) {
      onLog(`[Email Bot] Skipped ${lead.name} (No email address discovered).`);
      results.skipped++;
      results.details.push({ id: lead.id, name: lead.name, status: 'skipped', reason: 'No email' });
      onProgress({ current: i + 1, total: leads.length, sent: results.sent, failed: results.failed });
      continue;
    }

    // 1. Check suppression list (bounces, unsubscribes)
    if (isSuppressed(targetEmail)) {
      onLog(`[Email Bot] ⛔ Skipped ${lead.name} (${targetEmail}): In suppression list (bounced/unsubscribed).`);
      results.skipped++;
      results.details.push({ id: lead.id, name: lead.name, email: targetEmail, status: 'skipped', reason: 'Suppression list' });
      onProgress({ current: i + 1, total: leads.length, sent: results.sent, failed: results.failed });
      continue;
    }

    // 2. DNS MX Record Verification (Prevents sending to non-existent servers and getting bounce-backs)
    const hasMx = await verifyDomainMx(targetEmail);
    if (!hasMx) {
      onLog(`[Email Bot] ⚠️ Skipped ${lead.name} (${targetEmail}): Domain has no valid mail exchanger (MX) record. Skipping to prevent bounce.`);
      addToSuppressionList(targetEmail);
      results.skipped++;
      results.details.push({ id: lead.id, name: lead.name, email: targetEmail, status: 'skipped', reason: 'Invalid MX (bounce prevention)' });
      onProgress({ current: i + 1, total: leads.length, sent: results.sent, failed: results.failed });
      continue;
    }

    // 3. Dynamic Pitch Selection
    const hasWebsite = Boolean(lead.website);
    let chosenSubject = '';
    let chosenBody = '';

    if (typeof dynamicPitchGenerator === 'function') {
      const generated = dynamicPitchGenerator(lead, hasWebsite);
      chosenSubject = generated.subject;
      chosenBody = generated.body;
    } else {
      chosenSubject = subjectTemplate;
      chosenBody = bodyTemplate;
      if (hasWebsite && bodyTemplateRedesign) {
        chosenBody = bodyTemplateRedesign;
        if (subjectTemplateRedesign) chosenSubject = subjectTemplateRedesign;
      }
      chosenSubject = interpolateTemplate(chosenSubject, lead);
      chosenBody = interpolateTemplate(chosenBody, lead);
    }

    const pitchType = hasWebsite ? '🎨 Redesign Pitch' : '📝 New Website Pitch';
    onLog(`[Email Bot] [${i + 1}/${leads.length}] Sending ${pitchType} to ${lead.name} (${targetEmail})...`);

    try {
      await transporter.sendMail({
        from: `"${config.senderName || 'Aaravsinh Rathod | Web Developer'}" <${config.user}>`,
        to: targetEmail,
        subject: chosenSubject,
        text: chosenBody,
        html: chosenBody.replace(/\n/g, '<br>')
      });

      results.sent++;
      results.details.push({ id: lead.id, name: lead.name, email: targetEmail, status: 'sent' });
      onLog(`[Email Bot] ✅ Successfully delivered to ${lead.name}!`);
    } catch (err) {
      results.failed++;
      results.details.push({ id: lead.id, name: lead.name, email: targetEmail, status: 'failed', error: err.message });
      onLog(`[Email Bot] ❌ Failed to send to ${lead.name}: ${err.message}`);

      // If blocked or rejected, add to suppression list
      if (err.message.includes('550') || err.message.includes('blocked') || err.message.includes('rejected')) {
        addToSuppressionList(targetEmail);
      }
    }

    onProgress({ current: i + 1, total: leads.length, sent: results.sent, failed: results.failed });

    // Safe delay before sending the next email (with random human jitter of 5-15s)
    if (i < leads.length - 1) {
      const jitterDelay = delaySeconds + Math.floor(Math.random() * 10);
      onLog(`[Email Bot] Safe anti-spam pacing: waiting ${jitterDelay}s before next contact...`);
      await sleep(jitterDelay * 1000);
    }
  }

  onLog(`[Email Bot] Campaign finished! Sent: ${results.sent}, Failed: ${results.failed}, Skipped: ${results.skipped}.`);
  return results;
}

module.exports = {
  createTransporter,
  verifyConnection,
  verifyDomainMx,
  interpolateTemplate,
  runEmailCampaign
};
