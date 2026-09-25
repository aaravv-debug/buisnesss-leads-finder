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

  console.log('Testing analyzeWebsite audit engine...');
  const { analyzeWebsite } = require('../src/enricher');
  const { interpolateTemplate } = require('../src/mailer');

  // Test 1: Modern Website
  const modernHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta property="og:title" content="Elite Dental & Aesthetics">
      </head>
      <body>
        <h1>Welcome</h1>
        <a href="https://calendly.com/booking">Book Online</a>
        <footer>© 2026 Elite Dental. All rights reserved.</footer>
      </body>
    </html>
  `;
  const modernAudit = analyzeWebsite(modernHtml, 'https://elitedental.com', 300);
  console.log('Modern Audit Result:', modernAudit);
  console.assert(modernAudit.isOutdated === false, 'Expected modern website to not be marked outdated');
  console.assert(modernAudit.status === 'modern', 'Expected modern status');

  // Test 2: Outdated Website (HTTP, no viewport, 2018 copyright, jQuery 1.8, no booking)
  const outdatedHtml = `
    <html>
      <head>
        <script src="js/jquery-1.8.3.min.js"></script>
      </head>
      <body>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td>Welcome to our 2005 style clinic</td></tr>
        </table>
        <p>Call us at 555-0199 for appointments</p>
        <footer>Copyright 2018 Clinic Inc.</footer>
      </body>
    </html>
  `;
  const outdatedAudit = analyzeWebsite(outdatedHtml, 'http://oldclinic.com', 3200);
  console.log('Outdated Audit Result:', outdatedAudit);
  console.assert(outdatedAudit.isOutdated === true, 'Expected outdated website to be marked outdated');
  console.assert(outdatedAudit.issues.length >= 3, 'Expected multiple detected audit issues');
  console.assert(outdatedAudit.recommendedPitch === 'redesign', 'Expected redesign pitch recommendation');

  // Test 3: Template Interpolation with audit variables and portfolio
  const template = 'Hi {{name}}! Notice on {{website}}: {{audit_summary}}. Check my portfolio: {{portfolio}}';
  const leadSample = {
    name: 'Glow MedSpa',
    website: 'https://glowmedspa.com',
    websiteAudit: outdatedAudit
  };
  const rendered = interpolateTemplate(template, leadSample);
  console.log('Interpolated Message:', rendered);
  console.assert(rendered.includes('Glow MedSpa'), 'Missing lead name');
  console.assert(rendered.includes('https://aaravsinh-rathod-portfolio-9.vercel.app/'), 'Missing portfolio URL');
  console.assert(rendered.includes('https://glowmedspa.com'), 'Missing website');

  console.log('All website analysis and template unit tests passed successfully!');
}

test().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
