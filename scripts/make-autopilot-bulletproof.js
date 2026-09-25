const fs = require('fs');
const path = require('path');

// 1. Update src/mailer.js to use port 587 with retry resilience
const mailerPath = path.join(__dirname, '..', 'src', 'mailer.js');
let mailerCode = fs.readFileSync(mailerPath, 'utf8');

const updatedGmailTransport = `  if (provider === 'gmail') {
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: user.trim(),
        pass: pass.trim().replace(/\\s+/g, '')
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 20000,
      greetingTimeout: 15000,
      socketTimeout: 30000
    });
  }`;

mailerCode = mailerCode.replace(
  /if \(provider === 'gmail'\) \{[\s\S]*?auth: \{[\s\S]*?pass: pass\.trim\(\)\.replace\(\/\\s\+\/g, ''\)[\s\S]*?\}[\s\S]*?\};?\s*\}/,
  updatedGmailTransport
);
fs.writeFileSync(mailerPath, mailerCode, 'utf8');
console.log('mailer.js updated with resilient SMTP settings');

// 2. Update src/autopilot.js to auto-retry next location when 0 leads found
const apPath = path.join(__dirname, '..', 'src', 'autopilot.js');
let apCode = fs.readFileSync(apPath, 'utf8');

// Replace the 0 leads block with auto-fallback to next location
const zeroLeadsOld = `if (eligibleLeads.length === 0) {
        this.log(\`No new unreached email leads found in this batch. Advancing to next location next hour.\`);
        runRecord.status = 'no_new_leads';
        this.recordHistory(runRecord);
        return { success: true, sent: 0, reason: 'No new leads' };
      }`;

const zeroLeadsNew = `if (eligibleLeads.length === 0) {
        this.log(\`⚠️ 0 new leads found for "\${target.niche} in \${target.city}". Automatically trying next location immediately...\`);
        runRecord.status = 'skipped_trying_next';
        // Try up to 2 fallback niches in the same cycle so an hour is NEVER wasted
        for (let retry = 0; retry < 2; retry++) {
          const fallbackTarget = ROTATING_TARGETS[this.state.targetIndex % ROTATING_TARGETS.length];
          this.state.targetIndex = (this.state.targetIndex + 1) % ROTATING_TARGETS.length;
          this.log(\`🔄 Fallback Search (\${retry + 1}/2): "\${fallbackTarget.niche} in \${fallbackTarget.city}"...\`);
          const fallbackLeads = await scrapeGoogleMaps({
            query: \`\${fallbackTarget.niche.replace(/&/g, 'and')} in \${fallbackTarget.city}\`,
            maxResults: maxToScrape,
            enrich: true,
            headless: true,
            onLog: (m) => this.log(m)
          });
          for (const l of fallbackLeads) {
            if (l.emails && l.emails.length > 0 && !this.sentEmailsSet.has(l.emails[0].toLowerCase())) {
              eligibleLeads.push(l);
              if (eligibleLeads.length >= (this.state.maxLeadsPerRun || 30)) break;
            }
          }
          if (eligibleLeads.length > 0) break;
        }

        if (eligibleLeads.length === 0) {
          this.log(\`No leads found after fallback tries. Will try next batch next hour.\`);
          runRecord.status = 'no_new_leads';
          this.recordHistory(runRecord);
          return { success: true, sent: 0, reason: 'No new leads' };
        }
      }`;

if (apCode.includes("Advancing to next location next hour")) {
  apCode = apCode.replace(zeroLeadsOld, zeroLeadsNew);
  fs.writeFileSync(apPath, apCode, 'utf8');
  console.log('autopilot.js updated with auto-fallback location loop');
}
