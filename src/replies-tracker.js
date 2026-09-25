const fs = require('fs');
const path = require('path');
const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');
const { loadFollowups, updateFollowup } = require('./followups');

const DATA_DIR = path.join(__dirname, '..', 'data');
const REPLIES_FILE = path.join(DATA_DIR, 'replies.json');
const STATE_FILE = path.join(__dirname, '..', 'autopilot-state.json');

function ensureRepliesFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(REPLIES_FILE)) {
    fs.writeFileSync(REPLIES_FILE, '[]', 'utf8');
  }
}

function loadReplies() {
  ensureRepliesFile();
  try {
    const raw = fs.readFileSync(REPLIES_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return [];
  }
}

function saveReplies(items) {
  ensureRepliesFile();
  fs.writeFileSync(REPLIES_FILE, JSON.stringify(items, null, 2), 'utf8');
}

function getImapConfig() {
  let user = 'editcraftstudio19@gmail.com';
  let pass = 'ucppijkvcgmbohai';

  try {
    if (fs.existsSync(STATE_FILE)) {
      const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      if (state.emailUser) user = state.emailUser;
      if (state.emailPass) pass = state.emailPass;
    }
  } catch (_) {}

  return {
    imap: {
      user: user.trim(),
      password: pass.trim().replace(/\s+/g, ''),
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      authTimeout: 10000,
      tlsOptions: { rejectUnauthorized: false }
    }
  };
}

async function scanInboxForReplies() {
  const followupsList = loadFollowups();
  const existingReplies = loadReplies();
  const knownEmails = new Map();

  followupsList.forEach(f => {
    if (f.email) knownEmails.set(f.email.toLowerCase().trim(), f);
  });

  const imapConfig = getImapConfig();
  let connection;
  const newReplies = [];

  try {
    connection = await imaps.connect(imapConfig);
    await connection.openBox('INBOX');

    // Search for emails from the last 7 days
    const delay = 7 * 24 * 3600 * 1000;
    const sinceDate = new Date(Date.now() - delay).toISOString();
    const searchCriteria = [['SINCE', sinceDate]];
    const fetchOptions = {
      bodies: ['HEADER', 'TEXT', ''],
      markSeen: false
    };

    const messages = await connection.search(searchCriteria, fetchOptions);

    for (const item of messages) {
      try {
        const all = item.parts.find(part => part.which === '');
        const id = item.attributes.uid;
        const parsed = await simpleParser(all.body);

        const fromEmail = (parsed.from && parsed.from.value && parsed.from.value[0] && parsed.from.value[0].address || '').toLowerCase().trim();
        const fromName = parsed.from && parsed.from.value && parsed.from.value[0] && parsed.from.value[0].name || '';
        const subject = parsed.subject || 'No Subject';
        const text = parsed.text || '';

        // Ignore automated bounce notifications from mailer-daemon / postmaster
        if (fromEmail.includes('mailer-daemon') || fromEmail.includes('postmaster') || fromEmail.includes('google.com')) {
          continue;
        }

        // Check if sender matches our outreach database OR replied to our thread
        const matchedClient = knownEmails.get(fromEmail);
        const isReSubject = subject.toLowerCase().includes('booking') || subject.toLowerCase().includes('website') || subject.toLowerCase().startsWith('re:');

        if (matchedClient || isReSubject) {
          // Check if already in replies
          const exists = existingReplies.some(r => r.messageId === parsed.messageId || (r.senderEmail === fromEmail && r.date === parsed.date?.toISOString()));
          if (!exists) {
            const clientName = (matchedClient && matchedClient.name) || fromName || fromEmail.split('@')[0];
            const city = (matchedClient && matchedClient.city) || 'Client Area';
            const category = (matchedClient && matchedClient.category) || 'Business';

            // Detect sentiment / intent
            const lowerText = text.toLowerCase();
            let intent = 'General Reply';
            let badge = '💬 Reply Received';
            if (lowerText.includes('video') || lowerText.includes('yes') || lowerText.includes('send') || lowerText.includes('sure') || lowerText.includes('ok')) {
              intent = '🔥 Hot Lead: Wants 45s Video';
              badge = '🔥 Wants 45s Video';
            } else if (lowerText.includes('price') || lowerText.includes('cost') || lowerText.includes('how much') || lowerText.includes('quote')) {
              intent = '💰 Pricing Inquiry';
              badge = '💰 Pricing Question';
            }

            const replyRecord = {
              id: `rep_${Date.now()}_${id}`,
              messageId: parsed.messageId || `${id}_${Date.now()}`,
              clientName,
              senderEmail: fromEmail,
              city,
              category,
              subject,
              snippet: text.slice(0, 180).trim() + (text.length > 180 ? '...' : ''),
              fullText: text.trim(),
              date: (parsed.date || new Date()).toISOString(),
              formattedDate: (parsed.date || new Date()).toLocaleString(),
              intent,
              badge,
              unread: true
            };

            existingReplies.unshift(replyRecord);
            newReplies.push(replyRecord);

            // Update status in follow-ups pipeline
            if (matchedClient) {
              updateFollowup(matchedClient.id, {
                status: `🎉 Replied: ${intent}`,
                notes: `Client replied on ${(parsed.date || new Date()).toLocaleDateString()}: "${replyRecord.snippet}"`
              });
            }
          }
        }
      } catch (parseErr) {
        console.warn('Error parsing message:', parseErr.message);
      }
    }

    saveReplies(existingReplies);
    return {
      success: true,
      newCount: newReplies.length,
      totalCount: existingReplies.length,
      replies: existingReplies
    };
  } catch (err) {
    console.error('Error scanning IMAP inbox:', err);
    return {
      success: false,
      error: err.message,
      replies: existingReplies
    };
  } finally {
    if (connection) {
      try { connection.end(); } catch (_) {}
    }
  }
}

function markReplyRead(id) {
  const items = loadReplies();
  const item = items.find(r => r.id === id);
  if (item) {
    item.unread = false;
    saveReplies(items);
  }
  return item;
}

module.exports = {
  loadReplies,
  saveReplies,
  scanInboxForReplies,
  markReplyRead
};
