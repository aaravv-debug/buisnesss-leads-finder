const fs = require('fs');
const path = require('path');

const mailerPath = path.join(__dirname, '..', 'src', 'mailer.js');
let code = fs.readFileSync(mailerPath, 'utf8');

const correctCreateTransporter = `function createTransporter(config) {
  const { provider = 'gmail', user, pass, host, port, secure } = config;

  if (provider === 'gmail') {
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: user.trim(),
        pass: pass.trim().replace(/\\s+/g, '')
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 20000,
      greetingTimeout: 15000,
      socketTimeout: 30000
    });
  }

  // Custom SMTP (Brevo, SendGrid, Outlook, Namecheap, etc.)
  return nodemailer.createTransport({
    host: host || 'smtp.gmail.com',
    port: parseInt(port, 10) || 587,
    secure: Boolean(secure),
    auth: {
      user: user.trim(),
      pass: pass.trim()
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}`;

code = code.replace(/function createTransporter\(config\) \{[\s\S]*?return nodemailer\.createTransport\(\{[\s\S]*?\}\);\s*\}\s*\}\s*/, correctCreateTransporter + '\n');

// Fallback regex if above didn't match
if (!code.includes('// Custom SMTP')) {
  code = code.replace(/function createTransporter\(config\) \{[\s\S]*?\n\}\n/, correctCreateTransporter + '\n');
}

fs.writeFileSync(mailerPath, code, 'utf8');
console.log('mailer.js createTransporter fixed cleanly');
