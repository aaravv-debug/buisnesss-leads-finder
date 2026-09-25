const { scanInboxForReplies } = require('../src/replies-tracker');

async function testScan() {
  console.log('Running test scan of Gmail inbox for client replies...');
  const res = await scanInboxForReplies();
  console.log('Scan result:', res);
}

testScan();
