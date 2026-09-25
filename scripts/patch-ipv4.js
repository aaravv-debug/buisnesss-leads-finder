const fs = require('fs');
const path = require('path');

// 1. Update server.js to force IPv4 first globally
const serverPath = path.join(__dirname, '..', 'server.js');
let serverCode = fs.readFileSync(serverPath, 'utf8');

if (!serverCode.includes("dns.setDefaultResultOrder('ipv4first')")) {
  serverCode = "const dns = require('dns');\ntry { dns.setDefaultResultOrder('ipv4first'); } catch (_) {}\n" + serverCode;
  fs.writeFileSync(serverPath, serverCode, 'utf8');
  console.log('server.js updated with global ipv4first DNS order');
}

// 2. Update src/mailer.js to force family: 4 for SMTP
const mailerPath = path.join(__dirname, '..', 'src', 'mailer.js');
let mailerCode = fs.readFileSync(mailerPath, 'utf8');

mailerCode = mailerCode.replace(
  /port: 587,\s*secure: false,/g,
  "port: 587,\n      secure: false,\n      family: 4,"
);
fs.writeFileSync(mailerPath, mailerCode, 'utf8');
console.log('mailer.js updated with family: 4');

// 3. Update src/autopilot.js to add dns.setDefaultResultOrder
const apPath = path.join(__dirname, '..', 'src', 'autopilot.js');
let apCode = fs.readFileSync(apPath, 'utf8');

if (!apCode.includes("dns.setDefaultResultOrder('ipv4first')")) {
  apCode = "const dns = require('dns');\ntry { dns.setDefaultResultOrder('ipv4first'); } catch (_) {}\n" + apCode;
  fs.writeFileSync(apPath, apCode, 'utf8');
  console.log('autopilot.js updated with global ipv4first');
}
