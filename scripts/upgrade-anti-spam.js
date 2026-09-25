const fs = require('fs');
const path = require('path');

// 1. Upgrade src/enricher.js isValidEmail to filter out template/dummy/agency emails
const enricherPath = path.join(__dirname, '..', 'src', 'enricher.js');
let enricherCode = fs.readFileSync(enricherPath, 'utf8');

const junkDomainsExpanded = `const JUNK_DOMAINS = [
  'wixpress.com', 'sentry.io', 'schema.org', 'example.com', 'domain.com', 'email.com', 
  'yourdomain.com', 'mysite.com', 'godaddy.com', 'cloudflare.com', 'influxmarketing.com', 
  'dharmamarketing.cloud', 'booksy.com', 'mdw.co.in', 'wordpress.org', 'gravatar.com'
];
const JUNK_USERNAMES = [
  'example', 'filler', 'noreply', 'no-reply', 'donotreply', 'webmaster', 
  'hostmaster', 'postmaster', 'mailer-daemon', 'privacy', 'admin@domain'
];`;

enricherCode = enricherCode.replace(/const JUNK_DOMAINS = \[[\s\S]*?\];/, junkDomainsExpanded);

const updatedIsValidEmail = `function isValidEmail(email) {
  if (!email || email.length > 80) return false;
  const lower = email.toLowerCase().trim();
  
  for (const ext of INVALID_EMAIL_EXTENSIONS) {
    if (lower.endsWith(ext)) return false;
  }
  for (const junk of JUNK_DOMAINS) {
    if (lower.includes(junk)) return false;
  }
  const user = lower.split('@')[0];
  for (const junkUser of JUNK_USERNAMES) {
    if (user === junkUser || user.startsWith(junkUser + '+')) return false;
  }
  if (lower.startsWith('u00') || lower.includes('bootstrap') || lower.includes('jquery')) return false;
  if (!lower.includes('.') || lower.indexOf('@') < 1) return false;

  return true;
}`;

enricherCode = enricherCode.replace(/function isValidEmail\(email\) \{[\s\S]*?return true;\s*\}/, updatedIsValidEmail);
fs.writeFileSync(enricherPath, enricherCode, 'utf8');
console.log('enricher.js upgraded with strict dummy email filter');

// 2. Upgrade src/autopilot.js with Spintax Generator & Suppression List Checking
const apPath = path.join(__dirname, '..', 'src', 'autopilot.js');
let apCode = fs.readFileSync(apPath, 'utf8');

const spintaxHelper = `
// Anti-Spam Dynamic Content Generator (prevents "Message Blocked" by randomizing phrasing)
function generateDynamicPitch(lead, isRedesign = false) {
  const name = lead.name || 'there';
  const city = lead.city || 'your area';
  const category = lead.category || 'local business';
  const website = lead.website || '';

  const subjectsNoWeb = [
    \`Quick question regarding \${name}'s online booking\`,
    \`Question for \${name} team\`,
    \`Idea for \${name}'s mobile booking\`,
    \`Quick note regarding \${name}\`
  ];

  const subjectsRedesign = [
    \`Quick thoughts on modernizing \${name}'s website\`,
    \`Mobile booking idea for \${name}\`,
    \`\${name} website & appointments idea\`,
    \`Thoughts on \${name}'s current website\`
  ];

  const greetings = [
    \`Hi \${name} team! 👋\`,
    \`Hello to the team at \${name},\`,
    \`Hi there \${name} team,\`,
    \`Hope you're having a productive week \${name} team!\`
  ];

  const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
  const subject = isRedesign 
    ? subjectsRedesign[Math.floor(Math.random() * subjectsRedesign.length)]
    : subjectsNoWeb[Math.floor(Math.random() * subjectsNoWeb.length)];

  let body = '';
  if (isRedesign) {
    const intros = [
      \`I was researching top \${category} practices in \${city} and was taking a look at your current website (\${website}).\`,
      \`I came across \${name} while looking at leading \${category} businesses in \${city} and checked out your website (\${website}).\`,
      \`I was looking at \${category} providers in \${city} and noticed your site at \${website}.\`
    ];
    const randIntro = intros[Math.floor(Math.random() * intros.length)];

    body = \`\${randomGreeting}\\n\\n\${randIntro}\\n\\nI noticed a few areas where streamlining the layout and adding a direct mobile-friendly booking system could easily bring in 5-10 extra appointments every week.\\n\\nI specialize in fast, high-converting booking websites for \${category} practices. You can review my recent client projects here:\\n👉 https://aaravsinh-rathod-portfolio-9.vercel.app/\\n\\nMay I send a 45-second video showing how your website will look for \${name}? No pressure at all, just thought it might give you some great ideas!\\n\\nBest regards,\\nAaravsinh Rathod\\nWeb Developer & Designer\\nhttps://aaravsinh-rathod-portfolio-9.vercel.app/\\n\\n(PS: If you'd rather not receive any ideas, please reply "opt out" and I won't reach out again!)\`;
  } else {
    const intros = [
      \`I was looking at top \${category} businesses in \${city} and noticed your Google profile currently doesn't have an active website or direct mobile booking link for clients.\`,
      \`I came across \${name} in \${city} and noticed your profile is missing a direct online booking website.\`
    ];
    const randIntro = intros[Math.floor(Math.random() * intros.length)];

    body = \`\${randomGreeting}\\n\\n\${randIntro}\\n\\nI build clean, modern, and fast booking websites that help \${category} businesses bring in 5-10 extra appointments every week. You can see my recent client work and portfolio here:\\n👉 https://aaravsinh-rathod-portfolio-9.vercel.app/\\n\\nMay I send a 45-second video showing how your website will look for \${name}? No pressure at all, just thought it might be helpful!\\n\\nBest regards,\\nAaravsinh Rathod\\nWeb Developer & Designer\\nhttps://aaravsinh-rathod-portfolio-9.vercel.app/\\n\\n(PS: If you'd rather not receive any ideas, please reply "opt out" and I won't reach out again!)\`;
  }

  return { subject, body };
}
`;

if (!apCode.includes('generateDynamicPitch')) {
  apCode = spintaxHelper + '\n' + apCode;
  
  // Also load suppression list in autopilot
  apCode = apCode.replace(
    /for \(const lead of scrapedLeads\) \{/g,
    `// Load suppression list
      let suppressionSet = new Set();
      try {
        const suppFile = path.join(__dirname, '..', 'data', 'suppression-list.json');
        if (fs.existsSync(suppFile)) {
          suppressionSet = new Set(JSON.parse(fs.readFileSync(suppFile, 'utf8')).map(e => e.toLowerCase()));
        }
      } catch (_) {}

      for (const lead of scrapedLeads) {`
  );

  apCode = apCode.replace(
    /if \(this\.sentEmailsSet\.has\(primaryEmail\)\) continue;/g,
    `if (this.sentEmailsSet.has(primaryEmail)) continue;
        if (suppressionSet.has(primaryEmail)) continue; // skip known bounced emails`
  );

  // Increase safe delay with jitter
  apCode = apCode.replace(
    /delaySeconds: 20,/g,
    'delaySeconds: 30, // 30s safe delay + human pacing to prevent spam flags'
  );

  fs.writeFileSync(apPath, apCode, 'utf8');
  console.log('autopilot.js upgraded with Anti-Spam Spintax, Suppression check, and safe pacing');
}
