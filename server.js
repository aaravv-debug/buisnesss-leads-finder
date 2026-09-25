const followups = require('./src/followups');
const express = require('express');
const cors = require('cors');
const path = require('path');
const jobs = require('./src/jobs');
const { enrichWebsite, enrichLeadComprehensively } = require('./src/enricher');

// Prevent Windows Puppeteer file-lock cleanup crashes
process.on('unhandledRejection', (reason) => {
  if (reason && (reason.code === 'EBUSY' || String(reason).includes('EBUSY') || (reason.path && reason.path.includes('puppeteer')))) {
    return;
  }
  console.error('[Server Unhandled Rejection]', reason);
});

process.on('uncaughtException', (err) => {
  if (err && (err.code === 'EBUSY' || String(err).includes('EBUSY') || (err.path && err.path.includes('puppeteer')))) {
    return;
  }
  console.error('[Server Uncaught Exception]', err);
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Create and launch a single job
app.post('/api/jobs', async (req, res) => {
  try {
    const { query, city, maxResults = 20, enrich = true, headless = true } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Search query or keyword is required.' });
    }

    const fullQuery = city ? `${query} in ${city}` : query;
    const job = jobs.createJob({
      query: fullQuery,
      maxResults,
      enrich,
      headless
    });

    // Start asynchronously in background
    jobs.startJob(job.id);

    res.status(201).json({
      message: 'Job created and started successfully',
      jobId: job.id,
      query: fullQuery
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create and launch batch jobs
app.post('/api/jobs/batch', async (req, res) => {
  try {
    const { queries = [], city, maxResults = 10, enrich = true } = req.body;
    if (!Array.isArray(queries) || queries.length === 0) {
      return res.status(400).json({ error: 'Please provide an array of queries/keywords.' });
    }

    const created = [];
    for (const q of queries) {
      const fullQuery = city ? `${q} in ${city}` : q;
      const job = jobs.createJob({
        query: fullQuery,
        maxResults,
        enrich,
        headless: true
      });
      created.push(job.id);
    }

    // Process batch sequentially in background
    (async () => {
      for (const id of created) {
        await jobs.startJob(id);
      }
    })();

    res.status(201).json({
      message: `Created batch of ${created.length} jobs`,
      jobIds: created
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all jobs
app.get('/api/jobs', (req, res) => {
  res.json(jobs.getAllJobs());
});

// Get job details
app.get('/api/jobs/:id', (req, res) => {
  const job = jobs.getJob(req.params.id);
  if (!job) {
    return res.status(400).json({ error: 'Job not found' });
  }
  res.json({
    id: job.id,
    query: job.query,
    status: job.status,
    progress: job.progress,
    leadsCount: job.leads.length,
    leads: job.leads,
    logs: job.logs,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    error: job.error
  });
});

// SSE Live stream for a specific job
app.get('/api/jobs/:id/events', (req, res) => {
  const job = jobs.getJob(req.params.id);
  if (!job) {
    return res.status(404).send('Job not found');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial state
  res.write(`data: ${JSON.stringify({ type: 'init', leads: job.leads, logs: job.logs, progress: job.progress, status: job.status })}\n\n`);

  // Event handlers
  const onLead = (lead) => {
    res.write(`data: ${JSON.stringify({ type: 'lead', lead })}\n\n`);
  };
  const onLog = (log) => {
    res.write(`data: ${JSON.stringify({ type: 'log', log })}\n\n`);
  };
  const onProgress = (progress) => {
    res.write(`data: ${JSON.stringify({ type: 'progress', progress })}\n\n`);
  };
  const onDone = (data) => {
    res.write(`data: ${JSON.stringify({ type: 'done', data })}\n\n`);
  };
  const onError = (data) => {
    res.write(`data: ${JSON.stringify({ type: 'error', data })}\n\n`);
  };

  job.emitter.on('lead', onLead);
  job.emitter.on('log', onLog);
  job.emitter.on('progress', onProgress);
  job.emitter.on('done', onDone);
  job.emitter.on('error', onError);

  req.on('close', () => {
    job.emitter.off('lead', onLead);
    job.emitter.off('log', onLog);
    job.emitter.off('progress', onProgress);
    job.emitter.off('done', onDone);
    job.emitter.off('error', onError);
  });
});

// Export job results to CSV (UTF-8 with BOM for Excel & Google Sheets)
app.get('/api/jobs/:id/export.csv', (req, res) => {
  const job = jobs.getJob(req.params.id);
  if (!job) return res.status(404).send('Job not found');

  const csv = jobs.exportToCSV(job.leads);
  const safeFilename = `leads_${job.query.replace(/[^a-z0-9]/gi, '_')}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
  res.status(200).send(Buffer.from(csv, 'utf8'));
});

// Export job results to Excel (.xlsx) with auto-proportioned columns
app.get('/api/jobs/:id/export.xlsx', (req, res) => {
  const job = jobs.getJob(req.params.id);
  if (!job) return res.status(404).send('Job not found');

  const buffer = jobs.exportToExcel(job.leads);
  const safeFilename = `leads_${job.query.replace(/[^a-z0-9]/gi, '_')}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
  res.status(200).send(buffer);
});

// Export job results to JSON
app.get('/api/jobs/:id/export.json', (req, res) => {
  const job = jobs.getJob(req.params.id);
  if (!job) return res.status(404).send('Job not found');

  const safeFilename = `leads_${job.query.replace(/[^a-z0-9]/gi, '_')}.json`;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
  res.status(200).json(job.leads);
});

// On-demand standalone website enrichment
app.post('/api/enrich-single', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const data = await enrichWebsite(url);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// On-demand social and email discovery for any lead
app.post('/api/leads/enrich-socials', async (req, res) => {
  const leadData = req.body.lead || req.body;
  const name = leadData.name;
  const location = req.body.location || leadData.location || leadData.address;
  const website = leadData.website;
  const phone = leadData.phone;
  if (!name) return res.status(400).json({ error: 'Business name is required' });

  try {
    const enriched = await enrichLeadComprehensively({ name, website, phone, address: location }, location);
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const { runEmailCampaign, verifyConnection, createTransporter } = require('./src/mailer');
const { runInstagramCampaign } = require('./src/instagram-bot');

const autopilot = require('./src/autopilot');

// Active outreach state
let activeOutreach = {
  running: false,
  type: null,
  total: 0,
  current: 0,
  sent: 0,
  failed: 0,
  logs: []
};

// Autopilot Status & Logs

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

app.get('/api/autopilot/status', (req, res) => {
  res.json(autopilot.getStatus());
});

// Update Autopilot Settings (enable/disable, password, interval, etc.)
app.post('/api/autopilot/config', (req, res) => {
  const updated = autopilot.updateConfig(req.body);
  res.json(updated);
});

// Trigger an immediate Autopilot cycle
app.all('/api/autopilot/run-now', async (req, res) => {
  res.json({ message: 'Autopilot run initiated in background' });
  autopilot.runCycle(true);
});

// Test email connection & send test email
app.post('/api/outreach/email/test', async (req, res) => {
  const { config, testEmail, subject, body } = req.body;
  if (!config || !config.user || !config.pass) {
    return res.status(400).json({ error: 'Email username and App Password are required.' });
  }

  try {
    const transporter = createTransporter(config);
    await transporter.verify();

    if (testEmail) {
      await transporter.sendMail({
        from: `"${config.senderName || 'LeadPulse Outreach'}" <${config.user}>`,
        to: testEmail,
        subject: subject || 'LeadPulse Test Email',
        text: body || 'This is a test email sent from LeadPulse Outreach Bot! Your configuration is working.'
      });
    }

    res.json({ success: true, message: testEmail ? `Test email sent to ${testEmail}!` : 'SMTP Connection Verified!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Launch Email Campaign
app.post('/api/outreach/email', async (req, res) => {
  const {
    leads = [],
    config,
    subjectTemplate,
    bodyTemplate,
    subjectTemplateRedesign,
    bodyTemplateRedesign,
    delaySeconds = 20
  } = req.body;

  if (activeOutreach.running) {
    return res.status(400).json({ error: 'Another outreach campaign is currently running.' });
  }

  if (!config || !config.user || !config.pass) {
    return res.status(400).json({ error: 'Email credentials are required.' });
  }

  activeOutreach = {
    running: true,
    type: 'email',
    total: leads.length,
    current: 0,
    sent: 0,
    failed: 0,
    logs: [`[System] Started Email Outreach campaign for ${leads.length} leads.`]
  };

  res.json({ message: 'Email campaign started', total: leads.length });

  // Run in background
  runEmailCampaign({
    leads,
    config,
    subjectTemplate,
    bodyTemplate,
    subjectTemplateRedesign,
    bodyTemplateRedesign,
    delaySeconds,
    onProgress: (p) => {
      activeOutreach.current = p.current;
      activeOutreach.sent = p.sent;
      activeOutreach.failed = p.failed;
    },
    onLog: (msg) => {
      activeOutreach.logs.push(msg);
      if (activeOutreach.logs.length > 100) activeOutreach.logs.shift();
    }
  }).finally(() => {
    activeOutreach.running = false;
  });
});

// Launch Instagram DM Campaign
app.post('/api/outreach/instagram', async (req, res) => {
  const {
    leads = [],
    credentials,
    messageTemplate,
    messageTemplateRedesign,
    delaySeconds = 60,
    headless = false
  } = req.body;

  if (activeOutreach.running) {
    return res.status(400).json({ error: 'Another outreach campaign is currently running.' });
  }

  activeOutreach = {
    running: true,
    type: 'instagram',
    total: leads.length,
    current: 0,
    sent: 0,
    failed: 0,
    logs: [`[System] Started Instagram DM Outreach campaign for ${leads.length} leads.`]
  };

  res.json({ message: 'Instagram DM campaign started', total: leads.length });

  // Run in background
  runInstagramCampaign({
    leads,
    credentials,
    messageTemplate,
    messageTemplateRedesign,
    delaySeconds,
    headless,
    onProgress: (p) => {
      activeOutreach.current = p.current;
      activeOutreach.sent = p.sent;
      activeOutreach.failed = p.failed;
    },
    onLog: (msg) => {
      activeOutreach.logs.push(msg);
      if (activeOutreach.logs.length > 100) activeOutreach.logs.shift();
    }
  }).finally(() => {
    activeOutreach.running = false;
  });
});

// Outreach Status & Logs polling
app.get('/api/outreach/status', (req, res) => {
  res.json(activeOutreach);
});

// Serve frontend SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🚀 Leads Finder Scraper App running on:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`====================================================`);
});
