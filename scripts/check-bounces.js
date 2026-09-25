const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');

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

async function checkBounces() {
  console.log('Connecting to Gmail to inspect bounce notifications...');
  try {
    const connection = await imaps.connect(config);
    await connection.openBox('INBOX');

    // Search for messages with subject containing failure, delivery, undelivered, rejected, blocked, daemon
    const searchCriteria = [
      ['OR', 
        ['HEADER', 'FROM', 'mailer-daemon'],
        ['OR', 
          ['SUBJECT', 'Delivery Status Notification'],
          ['OR', ['SUBJECT', 'Undelivered Mail'], ['SUBJECT', 'failed']]
        ]
      ]
    ];

    const fetchOptions = {
      bodies: ['HEADER', 'TEXT', ''],
      markSeen: false
    };

    const messages = await connection.search(searchCriteria, fetchOptions);
    console.log(`Found ${messages.length} bounce/system notification(s) in inbox:`);

    for (let i = 0; i < Math.min(messages.length, 10); i++) {
      const all = messages[i].parts.find(part => part.which === '');
      const parsed = await simpleParser(all.body);
      console.log(`\n--- Bounce #${i + 1} ---`);
      console.log('Subject:', parsed.subject);
      console.log('From:', parsed.from?.text);
      console.log('Date:', parsed.date);
      console.log('Snippet:', parsed.text ? parsed.text.slice(0, 300) : '');
    }

    connection.end();
  } catch (err) {
    console.error('Error checking bounces:', err.message);
  }
}

checkBounces();
