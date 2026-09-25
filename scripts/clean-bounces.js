const fs = require('fs');
const path = require('path');
const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');

const followupsPath = path.join(__dirname, '..', 'data', 'followups.json');
const statePath = path.join(__dirname, '..', 'autopilot-state.json');

const config = {
  imap: {
    user: 'editcraftstudio19@gmail.com',
    password: 'ucppijkvcgmbohai',
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    authTimeout: 15000,
    tlsOptions: { rejectUnauthorized: false }
  }
};

async function cleanBounces() {
  console.log('Connecting to Gmail to extract all bounced email addresses...');
  const bouncedEmails = new Set();

  try {
    const connection = await imaps.connect(config);
    await connection.openBox('INBOX');

    const searchCriteria = [
      ['OR', 
        ['HEADER', 'FROM', 'mailer-daemon'],
        ['OR', 
          ['SUBJECT', 'Delivery Status Notification'],
          ['OR', ['SUBJECT', 'Undelivered Mail'], ['SUBJECT', 'blocked']]
        ]
      ]
    ];

    const messages = await connection.search(searchCriteria, { bodies: ['HEADER', 'TEXT', ''], markSeen: false });
    console.log(`Found ${messages.length} bounce notifications. Extracting recipient addresses...`);

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

    for (const msg of messages) {
      try {
        const all = msg.parts.find(p => p.which === '');
        const parsed = await simpleParser(all.body);
        const text = (parsed.text || '') + ' ' + (parsed.subject || '');
        
        // Find lines like "wasn't delivered to xxx", "delivered to xxx", "to <xxx>"
        const matchLines = text.match(/(?:delivered to|message to|account that you tried to reach|to:?)\s*<*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>*/gi);
        if (matchLines) {
          for (const line of matchLines) {
            const emailsInLine = line.match(emailRegex);
            if (emailsInLine) {
              for (const em of emailsInLine) {
                const clean = em.toLowerCase().trim();
                if (!clean.includes('editcraftstudio19') && !clean.includes('google') && !clean.includes('mailer-daemon')) {
                  bouncedEmails.add(clean);
                }
              }
            }
          }
        }
      } catch (_) {}
    }

    connection.end();
  } catch (err) {
    console.warn('IMAP note:', err.message);
  }

  // Also include the known bounced addresses from the earlier log
  const knownBounced = [
    'info@soleabrickellspa.com',
    'info@magicalmedspa.com',
    'angel@dharmamarketing.cloud',
    'admin@elite-dentistry.net',
    'example@mysite.com',
    'rachel@lacosmeticdocs.com',
    'noreply@influxmarketing.com',
    'info@eliteaesthetics.com',
    'info@eugeniaberchenkorn.com',
    'elizeta.nyc@gmail.com'
  ];
  knownBounced.forEach(e => bouncedEmails.add(e.toLowerCase()));

  console.log(`Identified ${bouncedEmails.size} unique bounced/invalid emails:`, Array.from(bouncedEmails));

  // Update followups.json
  if (fs.existsSync(followupsPath)) {
    const list = JSON.parse(fs.readFileSync(followupsPath, 'utf8'));
    let updatedCount = 0;
    
    for (const item of list) {
      const email = (item.email || '').toLowerCase().trim();
      if (bouncedEmails.has(email)) {
        item.status = '❌ Bounced (Invalid Address)';
        item.badge = '❌ Bounced';
        item.notes = 'Email bounced back by recipient mail server. Excluded from follow-ups.';
        updatedCount++;
      }
    }

    fs.writeFileSync(followupsPath, JSON.stringify(list, null, 2), 'utf8');
    console.log(`Updated ${updatedCount} records in followups.json as Bounced.`);
  }

  // Save suppression list so the bot NEVER emails these again
  const suppressionFile = path.join(__dirname, '..', 'data', 'suppression-list.json');
  fs.writeFileSync(suppressionFile, JSON.stringify(Array.from(bouncedEmails), null, 2), 'utf8');
  console.log(`Saved suppression list to ${suppressionFile}`);
}

cleanBounces();
