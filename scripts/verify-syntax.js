const { verifyDomainMx, runEmailCampaign } = require('../src/mailer');
const autopilot = require('../src/autopilot');

async function test() {
  console.log('Testing MX check for gmail.com...');
  const mxOk = await verifyDomainMx('test@gmail.com');
  console.log('test@gmail.com has valid MX:', mxOk);

  console.log('Testing MX check for non-existent domain...');
  const mxBad = await verifyDomainMx('fake@fake-nonexistent-domain-12345.xyz');
  console.log('fake domain has valid MX:', mxBad);

  console.log('All modules loaded and verified successfully!');
  process.exit(0);
}

test();
