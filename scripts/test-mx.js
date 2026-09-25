const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

async function testMx(domain) {
  try {
    const mx = await dns.promises.resolveMx(domain);
    console.log(domain, 'VALID MX:', mx && mx.length > 0);
  } catch (err) {
    console.log(domain, 'INVALID (BOUNCE):', err.code);
  }
}

async function run() {
  await testMx('gmail.com');
  await testMx('eliteaesthetics.com');
  await testMx('mysite.com');
}
run();
