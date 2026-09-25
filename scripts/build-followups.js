const fs = require('fs');
const path = require('path');

const logsDir = 'C:\\Users\\mahad\\.gemini\\antigravity-ide\\brain\\0c732606-5c38-4a86-b2e4-f2c5cd383c43\\.system_generated\\tasks';
const statePath = path.join(__dirname, '..', 'autopilot-state.json');
const followupsDir = path.join(__dirname, '..', 'data');
const followupsPath = path.join(followupsDir, 'followups.json');

if (!fs.existsSync(followupsDir)) {
  fs.mkdirSync(followupsDir, { recursive: true });
}

const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : { sentEmails: [] };
const sentEmails = state.sentEmails || [];

// Read all task logs in logsDir
const emailToBusiness = new Map();
if (fs.existsSync(logsDir)) {
  const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.log'));
  for (const f of files) {
    try {
      const content = fs.readFileSync(path.join(logsDir, f), 'utf8');
      const regex = /Sending\s+.*?\s+Pitch to\s+(.*?)\s+\((.*?)\)/g;
      let m;
      while ((m = regex.exec(content)) !== null) {
        const name = m[1].trim();
        const email = m[2].trim().toLowerCase();
        if (!emailToBusiness.has(email)) {
          emailToBusiness.set(email, name);
        }
      }
    } catch (_) {}
  }
}

// Fallback nice business name from email or domain
function formatBusinessNameFromEmail(email) {
  const parts = email.split('@');
  const domain = parts[1] || '';
  const domainBase = domain.split('.')[0];
  if (['gmail', 'yahoo', 'hotmail', 'outlook', 'icloud'].includes(domainBase.toLowerCase())) {
    const user = parts[0].replace(/[._-]/g, ' ');
    return user.charAt(0).toUpperCase() + user.slice(1);
  }
  return domainBase
    .replace(/[._-]/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Today is 2026-09-25. 2 days later is 2026-09-27.
const dateMessaged = '2026-09-25';
const followupDue = '2026-09-27'; // 2 days follow-up
const followupDays = 2;

const followups = [];
for (let i = 0; i < sentEmails.length; i++) {
  const email = sentEmails[i].toLowerCase();
  let name = emailToBusiness.get(email) || formatBusinessNameFromEmail(email);
  
  // Categorize based on history index
  let category = 'Medical Spa & Aesthetics';
  let city = 'Miami / Austin / Los Angeles';
  if (i < 20) {
    category = 'Med Spa & Wellness';
    city = 'Miami, FL';
  } else if (i < 38) {
    category = 'Cosmetic Dentistry';
    city = 'Austin, TX';
  } else {
    category = 'Aesthetics & Botox Clinic';
    city = 'Los Angeles, CA';
  }

  followups.push({
    id: `cl_${i + 1}`,
    name,
    email,
    category,
    city,
    dateMessaged,
    followupDue,
    followupDays,
    status: 'Pending (Due in 2 Days)',
    initialPitch: '45-second video permission pitch sent',
    followupPitch: `Hi ${name} team! Just following up on my quick note from Thursday regarding the 45-second video preview for ${name}'s website & booking page. Would you still like me to send that 45-second demo over? Best, Aaravsinh (https://aaravsinh-rathod-portfolio-9.vercel.app/)`,
    notes: 'Outreach delivered on 25 Sep. Follow-up scheduled for 27 Sep.'
  });
}

fs.writeFileSync(followupsPath, JSON.stringify(followups, null, 2), 'utf8');
console.log(`Created follow-up database with ${followups.length} businesses at: ${followupsPath}`);
