const fs = require('fs');
const path = require('path');
const { createTransporter } = require('./mailer');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FOLLOWUPS_FILE = path.join(DATA_DIR, 'followups.json');
const STATE_FILE = path.join(__dirname, '..', 'autopilot-state.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(FOLLOWUPS_FILE)) {
    fs.writeFileSync(FOLLOWUPS_FILE, '[]', 'utf8');
  }
}

function loadFollowups() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(FOLLOWUPS_FILE, 'utf8');
    const items = JSON.parse(raw);
    const now = new Date();
    
    // Dynamically calculate days remaining
    return items.map(item => {
      const dueDate = new Date(item.followupDue);
      const diffTime = dueDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      let badge = '⏳ Due in 2 Days';
      if (diffDays <= 0) {
        badge = '🚨 Due Today!';
      } else if (diffDays === 1) {
        badge = '⚠️ Due Tomorrow';
      } else if (diffDays === 2) {
        badge = '⏳ Due in 2 Days';
      } else {
        badge = `📅 In ${diffDays} Days`;
      }
      
      if (item.status && item.status.startsWith('Followed Up')) {
        badge = '✅ Follow-Up Sent';
      } else if (item.status === 'Won / Converted') {
        badge = '🎉 Client Won!';
      }

      return {
        ...item,
        daysRemaining: diffDays,
        badge
      };
    });
  } catch (err) {
    console.error('Error reading followups:', err);
    return [];
  }
}

function saveFollowups(items) {
  ensureDataFile();
  fs.writeFileSync(FOLLOWUPS_FILE, JSON.stringify(items, null, 2), 'utf8');
}

function addFollowupLead(lead, city = 'Target Market', category = 'Business') {
  const items = loadFollowups();
  const email = (lead.email || (lead.emails && lead.emails[0]) || '').toLowerCase().trim();
  if (!email) return null;

  const existingIndex = items.findIndex(i => i.email.toLowerCase() === email);
  const now = new Date();
  const dueDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days later

  const dateMessaged = now.toISOString().split('T')[0];
  const followupDue = dueDate.toISOString().split('T')[0];
  const name = lead.name || email.split('@')[0];

  const record = {
    id: existingIndex >= 0 ? items[existingIndex].id : `cl_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name,
    email,
    category: lead.category || category,
    city: lead.city || city,
    website: lead.website || '',
    dateMessaged,
    followupDue,
    followupDays: 2,
    status: 'Pending (Due in 2 Days)',
    initialPitch: '45-second video permission pitch sent',
    followupPitch: `Hi ${name} team! Just following up on my quick note from Thursday regarding the 45-second video preview for ${name}'s website & booking page. Would you still like me to send that 45-second demo over? Best, Aaravsinh (https://aaravsinh-rathod-portfolio-9.vercel.app/)`,
    notes: `Outreach delivered on ${dateMessaged}. Automatic 2-day follow-up tracker active.`
  };

  if (existingIndex >= 0) {
    items[existingIndex] = { ...items[existingIndex], ...record };
  } else {
    items.unshift(record);
  }

  saveFollowups(items);
  return record;
}

function updateFollowup(id, updates = {}) {
  const items = loadFollowups();
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return null;

  items[idx] = { ...items[idx], ...updates };
  saveFollowups(items);
  return items[idx];
}

async function sendFollowupEmail(id, customPitch = '') {
  const items = loadFollowups();
  const client = items.find(i => i.id === id);
  if (!client) throw new Error('Client not found');

  // Load email credentials from autopilot-state.json
  let config = {
    user: 'editcraftstudio19@gmail.com',
    pass: 'ucppijkvcgmbohai',
    senderName: 'Aaravsinh Rathod | Web Developer',
    provider: 'gmail',
    host: 'smtp.gmail.com',
    port: 587
  };

  try {
    if (fs.existsSync(STATE_FILE)) {
      const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      if (state.emailUser && state.emailPass) {
        config = {
          user: state.emailUser,
          pass: state.emailPass,
          senderName: state.senderName || config.senderName,
          provider: state.provider || config.provider,
          host: state.host || config.host,
          port: state.port || config.port
        };
      }
    }
  } catch (_) {}

  const transporter = createTransporter(config);
  const subject = `Following up regarding ${client.name}'s website demo`;
  const body = customPitch || client.followupPitch || `Hi ${client.name} team!\n\nJust wanted to quickly follow up on my note regarding the 45-second video preview of how a modern booking website could look for ${client.name}.\n\nWould you still like me to send that 45-second demo link over? No pressure at all!\n\nBest regards,\nAaravsinh Rathod\nWeb Developer & Designer\nhttps://aaravsinh-rathod-portfolio-9.vercel.app/`;

  await transporter.sendMail({
    from: `"${config.senderName}" <${config.user}>`,
    to: client.email,
    subject,
    text: body
  });

  const updated = updateFollowup(id, {
    status: `Followed Up on ${new Date().toISOString().split('T')[0]}`,
    lastFollowupSent: new Date().toISOString()
  });

  return { success: true, client: updated };
}

function exportCsv() {
  const items = loadFollowups();
  const headers = ['Business Name', 'Email', 'Category', 'City', 'Date Messaged', 'Follow-up Due', 'Days Remaining', 'Status', 'Notes'];
  const rows = items.map(i => [
    `"${(i.name || '').replace(/"/g, '""')}"`,
    `"${(i.email || '').replace(/"/g, '""')}"`,
    `"${(i.category || '').replace(/"/g, '""')}"`,
    `"${(i.city || '').replace(/"/g, '""')}"`,
    `"${i.dateMessaged || ''}"`,
    `"${i.followupDue || ''}"`,
    `"${i.daysRemaining !== undefined ? i.daysRemaining : 2}"`,
    `"${(i.status || '').replace(/"/g, '""')}"`,
    `"${(i.notes || '').replace(/"/g, '""')}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

module.exports = {
  loadFollowups,
  saveFollowups,
  addFollowupLead,
  updateFollowup,
  sendFollowupEmail,
  exportCsv
};
