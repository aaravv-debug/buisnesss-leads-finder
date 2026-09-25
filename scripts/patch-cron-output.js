const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'server.js');
let code = fs.readFileSync(serverPath, 'utf8');

// Insert the cron interceptor before express.static
const target = "app.use(express.static(path.join(__dirname, 'public')));";
const interceptor = `// Intercept any cron pings (cron-job.org, UptimeRobot, /api/cron, /api/autopilot/run-now)
// Returns tiny 2-byte "OK" so cron-job.org never fails with "output too large"
app.use((req, res, next) => {
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  const isCronUa = ua.includes('cron-job.org') || ua.includes('uptimerobot') || ua.includes('cron');
  const isCronPath = req.path === '/api/autopilot/run-now' || req.path === '/api/cron';

  if (isCronPath || (isCronUa && (req.path === '/' || req.path === ''))) {
    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send('OK');
    try {
      const ap = require('./src/autopilot');
      ap.runCycle(true);
    } catch (_) {}
    return;
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));`;

if (!code.includes('isCronUa')) {
  code = code.replace(target, interceptor);
  fs.writeFileSync(serverPath, code, 'utf8');
  console.log('server.js updated with ultra-lightweight cron response handler');
}
