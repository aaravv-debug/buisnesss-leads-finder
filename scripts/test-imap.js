const imaps = require('imap-simple');

const config = {
  imap: {
    user: 'editcraftstudio19@gmail.com',
    password: 'ucppijkvcgmbohai',
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    authTimeout: 10000,
    tlsOptions: { rejectUnauthorized: false }
  }
};

async function testImap() {
  console.log('Testing Gmail IMAP connection...');
  try {
    const connection = await imaps.connect(config);
    console.log('✅ Connected to Gmail IMAP successfully!');
    await connection.openBox('INBOX');
    console.log('✅ Opened INBOX successfully!');
    connection.end();
    console.log('Test complete!');
  } catch (err) {
    console.error('❌ IMAP Error:', err.message);
  }
}

testImap();
