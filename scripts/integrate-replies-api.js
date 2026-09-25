const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'server.js');
let code = fs.readFileSync(serverPath, 'utf8');

if (!code.includes("const repliesTracker = require('./src/replies-tracker');")) {
  code = "const repliesTracker = require('./src/replies-tracker');\n" + code;
}

const repliesEndpoints = `
// ==================== CLIENT REPLIES & HOT LEADS API ====================
app.get('/api/replies', (req, res) => {
  const replies = repliesTracker.loadReplies();
  const unreadCount = replies.filter(r => r.unread).length;
  res.json({
    total: replies.length,
    unreadCount,
    replies
  });
});

app.post('/api/replies/scan', async (req, res) => {
  try {
    const result = await repliesTracker.scanInboxForReplies();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/replies/mark-read', (req, res) => {
  const { id } = req.body;
  const updated = repliesTracker.markReplyRead(id);
  res.json({ success: true, updated });
});
`;

if (!code.includes('/api/replies')) {
  code = code.replace("app.get('/api/followups'", repliesEndpoints + "\napp.get('/api/followups'");
  fs.writeFileSync(serverPath, code, 'utf8');
  console.log('server.js updated with replies endpoints');
}
