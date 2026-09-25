const http = require('http');

async function trigger() {
  console.log(`[${new Date().toLocaleTimeString()}] Checking local Leads Finder server on port 3000...`);
  
  const req = http.request('http://localhost:3000/api/autopilot/run-now', { method: 'POST', timeout: 5000 }, (res) => {
    console.log(`[${new Date().toLocaleTimeString()}] ✅ Successfully triggered autopilot on running server (Status: ${res.statusCode})`);
    process.exit(0);
  });

  req.on('error', async (err) => {
    console.log(`[${new Date().toLocaleTimeString()}] Server not running on port 3000 (${err.message}). Executing autopilot in standalone direct mode...`);
    try {
      const autopilot = require('../src/autopilot');
      const res = await autopilot.runCycle(true);
      console.log(`[${new Date().toLocaleTimeString()}] Standalone run completed:`, res);
      process.exit(0);
    } catch (cycleErr) {
      console.error(`[${new Date().toLocaleTimeString()}] Standalone run error:`, cycleErr);
      process.exit(1);
    }
  });

  req.end();
}

trigger();
