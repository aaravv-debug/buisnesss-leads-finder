const fs = require('fs');
const path = require('path');

// 1. Update src/autopilot.js
const autopilotPath = path.join(__dirname, '..', 'src', 'autopilot.js');
let apCode = fs.readFileSync(autopilotPath, 'utf8');

if (!apCode.includes("require('./followups')")) {
  apCode = "const followups = require('./followups');\n" + apCode;
}

if (!apCode.includes("followups.addFollowupLead")) {
  apCode = apCode.replace(
    /if \(d\.status === 'sent' && d\.email\) \{\s*this\.sentEmailsSet\.add\(d\.email\.toLowerCase\(\)\);\s*\}/g,
    `if (d.status === 'sent' && d.email) {
          this.sentEmailsSet.add(d.email.toLowerCase());
          const matchLead = eligibleLeads.find(l => l.emails && l.emails[0] && l.emails[0].toLowerCase() === d.email.toLowerCase());
          followups.addFollowupLead(matchLead || { name: d.name || d.email.split('@')[0], email: d.email }, target.city, target.niche);
        }`
  );
  fs.writeFileSync(autopilotPath, apCode, 'utf8');
  console.log('autopilot.js updated with followups recording');
}

// 2. Update server.js
const serverPath = path.join(__dirname, '..', 'server.js');
let sCode = fs.readFileSync(serverPath, 'utf8');

if (!sCode.includes("const followups = require('./src/followups');")) {
  sCode = "const followups = require('./src/followups');\n" + sCode;
}

const followupEndpoints = `
// ==================== 2-DAY CLIENT FOLLOW-UP PIPELINE API ====================
app.get('/api/followups', (req, res) => {
  const list = followups.loadFollowups();
  const dueCount = list.filter(i => (i.daysRemaining <= 2 || i.status.includes('Due')) && !i.status.startsWith('Followed Up')).length;
  res.json({
    total: list.length,
    dueCount,
    list
  });
});

app.post('/api/followups/update', (req, res) => {
  const { id, updates } = req.body;
  const updated = followups.updateFollowup(id, updates);
  if (!updated) return res.status(404).json({ error: 'Client not found' });
  res.json(updated);
});

app.post('/api/followups/send', async (req, res) => {
  const { id, customPitch } = req.body;
  try {
    const result = await followups.sendFollowupEmail(id, customPitch);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/followups/export.csv', (req, res) => {
  const csv = followups.exportCsv();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="clients_2day_followup_tracker.csv"');
  res.send(csv);
});
`;

if (!sCode.includes('/api/followups')) {
  sCode = sCode.replace("app.get('/api/autopilot/status'", followupEndpoints + "\napp.get('/api/autopilot/status'");
  fs.writeFileSync(serverPath, sCode, 'utf8');
  console.log('server.js updated with followups endpoints');
}
