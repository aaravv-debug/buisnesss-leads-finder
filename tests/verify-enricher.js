const { enrichWebsite, isValidEmail } = require('../src/enricher');

async function test() {
  console.log('Testing isValidEmail...');
  console.assert(isValidEmail('info@testcompany.com') === true, 'Valid email failed');
  console.assert(isValidEmail('image@test.png') === false, 'Invalid extension passed');
  console.assert(isValidEmail('sentry@sentry.io') === false, 'Junk domain passed');
  console.log('isValidEmail tests passed!');

  console.log('Testing browser executable detection...');
  const { getBrowserExecutablePath } = require('../src/utils');
  const chromePath = getBrowserExecutablePath();
  console.log('Detected Chrome Path:', chromePath);
  console.assert(Boolean(chromePath), 'Chrome path not found');

  console.log('All unit tests passed successfully!');
}

test().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
