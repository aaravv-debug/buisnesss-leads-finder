const fs = require('fs');
const path = require('path');
const { scrapeGoogleMaps } = require('./scraper');
const { runEmailCampaign, verifyConnection } = require('./mailer');
const { sleep } = require('./utils');

const AUTOPILOT_STORE_PATH = path.join(__dirname, '..', 'autopilot-state.json');

const ROTATING_TARGETS = [
  { niche: 'Med Spa', city: 'Miami, FL' },
  { niche: 'Cosmetic Dentist', city: 'Austin, TX' },
  { niche: 'Hair Salon & Extensions', city: 'Dallas, TX' },
  { niche: 'Aesthetics & Botox Clinic', city: 'Los Angeles, CA' },
  { niche: 'Roofing Contractor', city: 'Houston, TX' },
  { niche: 'Wellness & Laser Spa', city: 'New York, NY' },
  { niche: 'HVAC Services', city: 'Phoenix, AZ' },
  { niche: 'Chiropractic Clinic', city: 'Denver, CO' },
  { niche: 'Dental Practice', city: 'London, UK' },
  { niche: 'Skin & Beauty Clinic', city: 'Toronto, Canada' },
  { niche: 'Plumbing & Emergency Services', city: 'Atlanta, GA' },
  { niche: 'Luxury Day Spa', city: 'Chicago, IL' }
];

const DEFAULT_CONFIG = {
  enabled: true,
  intervalMinutes: 60,
  maxLeadsPerRun: 30,
  targetAudience: 'all', // smart adaptive: Pitch 1 for no-web, Pitch 2 for redesign
  senderName: 'Aaravsinh Rathod | Web Developer',
  emailUser: 'editcraftstudio19@gmail.com',
  emailPass: 'ucppijkvcgmbohai',
  provider: 'gmail',
  host: 'smtp.gmail.com',
  port: 587
};

class AutopilotManager {
  constructor() {
    this.state = this.loadState();
    this.intervalId = null;
    this.isRunningCycle = false;
    this.sentEmailsSet = new Set(this.state.sentEmails || []);
    this.logs = [];

    // Schedule next run
    this.scheduleNextRun();
  }

  loadState() {
    try {
      if (fs.existsSync(AUTOPILOT_STORE_PATH)) {
        const raw = fs.readFileSync(AUTOPILOT_STORE_PATH, 'utf8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
      }
    } catch (_) {}
    return { ...DEFAULT_CONFIG, targetIndex: 0, history: [], sentEmails: [] };
  }

  saveState() {
    try {
      this.state.sentEmails = Array.from(this.sentEmailsSet).slice(-2000); // keep last 2000 sent emails
      fs.writeFileSync(AUTOPILOT_STORE_PATH, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (_) {}
  }

  log(msg) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = `[Autopilot ${timestamp}] ${msg}`;
    console.log(entry);
    this.logs.push(entry);
    if (this.logs.length > 200) this.logs.shift();
  }

  getStatus() {
    return {
      enabled: this.state.enabled,
      isRunningCycle: this.isRunningCycle,
      intervalMinutes: this.state.intervalMinutes,
      maxLeadsPerRun: this.state.maxLeadsPerRun,
      currentTarget: ROTATING_TARGETS[this.state.targetIndex % ROTATING_TARGETS.length],
      nextRunTime: this.state.nextRunTime,
      lastRunTime: this.state.lastRunTime,
      totalSentCount: this.sentEmailsSet.size,
      history: (this.state.history || []).slice(-15),
      logs: this.logs.slice(-30),
      config: {
        emailUser: this.state.emailUser,
        senderName: this.state.senderName
      }
    };
  }

  updateConfig(newConfig = {}) {
    this.state = { ...this.state, ...newConfig };
    this.saveState();
    this.log(`Configuration updated. Autopilot enabled: ${this.state.enabled}`);
    this.scheduleNextRun();
    return this.getStatus();
  }

  scheduleNextRun() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (!this.state.enabled) {
      this.state.nextRunTime = null;
      return;
    }

    const intervalMs = (this.state.intervalMinutes || 60) * 60 * 1000;
    this.state.nextRunTime = new Date(Date.now() + intervalMs).toISOString();
    this.saveState();

    this.intervalId = setInterval(() => {
      this.runCycle();
    }, intervalMs);

    this.log(`Next hourly autopilot run scheduled for: ${new Date(this.state.nextRunTime).toLocaleTimeString()}`);
  }

  async runCycle(force = false) {
    if (this.isRunningCycle) {
      this.log(`A cycle is already running. Skipping.`);
      return { success: false, reason: 'Already running' };
    }

    this.isRunningCycle = true;
    const target = ROTATING_TARGETS[this.state.targetIndex % ROTATING_TARGETS.length];
    this.state.targetIndex = (this.state.targetIndex + 1) % ROTATING_TARGETS.length;
    this.state.lastRunTime = new Date().toISOString();
    this.saveState();

    this.log(`=======================================================`);
    this.log(`🚀 Starting Hourly Autopilot Run for: "${target.niche} in ${target.city}"`);
    this.log(`Goal: Scrape fresh leads, audit websites, and deliver up to ${this.state.maxLeadsPerRun} personalized pitches.`);
    this.log(`=======================================================`);

    const runRecord = {
      id: `run_${Date.now()}`,
      timestamp: new Date().toISOString(),
      target: `${target.niche} in ${target.city}`,
      leadsFound: 0,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      status: 'running'
    };

    try {
      // 1. Verify credentials first
      const smtpConfig = {
        provider: this.state.provider || 'gmail',
        user: this.state.emailUser,
        pass: this.state.emailPass,
        host: this.state.host || 'smtp.gmail.com',
        port: this.state.port || 587,
        senderName: this.state.senderName
      };

      this.log(`Verifying Gmail credentials for ${smtpConfig.user}...`);
      const verifyRes = await verifyConnection(smtpConfig);
      if (!verifyRes.success) {
        this.log(`⚠️ SMTP Authentication Warning: ${verifyRes.error}`);
        this.log(`NOTE: Google requires a 16-character "App Password" to allow automated sending.`);
        runRecord.status = 'auth_failed';
        runRecord.error = verifyRes.error;
        this.recordHistory(runRecord);
        return { success: false, error: verifyRes.error, needAppPassword: true };
      }
      this.log(`✅ Gmail SMTP connection verified and ready!`);

      // 2. Scrape Leads
      const maxToScrape = Math.min(45, (this.state.maxLeadsPerRun || 30) + 15);
      this.log(`Scraping up to ${maxToScrape} fresh leads for: "${target.niche} in ${target.city}"...`);
      const scrapedLeads = await scrapeGoogleMaps({
        query: `${target.niche} in ${target.city}`,
        maxResults: maxToScrape,
        enrich: true,
        headless: true,
        onLog: (m) => this.log(m)
      });

      runRecord.leadsFound = scrapedLeads.length;
      this.log(`Scraped ${scrapedLeads.length} leads. Filtering for unreached leads with emails...`);

      // 3. Filter Leads
      const eligibleLeads = [];
      for (const lead of scrapedLeads) {
        if (!lead.emails || lead.emails.length === 0) continue;
        const primaryEmail = lead.emails[0].toLowerCase();
        if (this.sentEmailsSet.has(primaryEmail)) continue; // avoid re-emailing
        eligibleLeads.push(lead);
        if (eligibleLeads.length >= this.state.maxLeadsPerRun) break;
      }

      this.log(`Identified ${eligibleLeads.length} fresh qualified leads ready for automated outreach.`);

      if (eligibleLeads.length === 0) {
        this.log(`No new unreached email leads found in this batch. Advancing to next location next hour.`);
        runRecord.status = 'no_new_leads';
        this.recordHistory(runRecord);
        return { success: true, sent: 0, reason: 'No new leads' };
      }

      // 4. Send Emails with Smart Adaptive Pitch
      const emailSubjectNoWeb = "Quick question regarding {{name}}'s online booking";
      const emailBodyNoWeb = `Hi {{name}} team! 👋\n\nI was looking at top {{category}} businesses in {{city}} and noticed your profile currently doesn't have an active website or mobile booking link for new clients.\n\nI specialize in building clean, modern, and fast booking websites that bring in 5-10 extra appointments every week. You can see my recent client work and portfolio here:\n👉 https://aaravsinh-rathod-portfolio-9.vercel.app/\n\nI put together a quick 30-second preview demo of how a custom mobile booking page could look for {{name}}. \n\nWould you mind if I sent the preview link over? No pressure at all, just thought it might be helpful!\n\nBest regards,\nAaravsinh Rathod\nWeb Developer & Designer\nhttps://aaravsinh-rathod-portfolio-9.vercel.app/`;

      const emailSubjectRedesign = "Quick thoughts on modernizing {{name}}'s website & mobile booking";
      const emailBodyRedesign = `Hi {{name}} team! 👋\n\nI was looking at top {{category}} businesses in {{city}} and was reviewing your current website ({{website}}).\n\nI noticed a few areas where modernizing the layout and adding a direct mobile-friendly booking flow could easily bring you 5-10 more client bookings each week.\n\nI specialize in modern website redesigns and high-speed booking systems for {{category}} practices. You can see my recent client redesigns and portfolio here:\n👉 https://aaravsinh-rathod-portfolio-9.vercel.app/\n\nI put together a quick 30-second preview demo showing what a modern, faster 2026 version of {{name}}'s website could look like.\n\nWould you be open to me sending the preview link over? No pressure at all, just thought it might give you some great ideas!\n\nBest regards,\nAaravsinh Rathod\nWeb Developer & Designer\nhttps://aaravsinh-rathod-portfolio-9.vercel.app/`;

      const campaignResults = await runEmailCampaign({
        leads: eligibleLeads,
        config: smtpConfig,
        subjectTemplate: emailSubjectNoWeb,
        bodyTemplate: emailBodyNoWeb,
        subjectTemplateRedesign: emailSubjectRedesign,
        bodyTemplateRedesign: emailBodyRedesign,
        delaySeconds: 20, // 20s safe delay between emails
        onLog: (m) => this.log(m)
      });

      // Track sent emails
      for (const d of campaignResults.details) {
        if (d.status === 'sent' && d.email) {
          this.sentEmailsSet.add(d.email.toLowerCase());
        }
      }

      runRecord.sentCount = campaignResults.sent;
      runRecord.failedCount = campaignResults.failed;
      runRecord.skippedCount = campaignResults.skipped;
      runRecord.status = 'completed';

      this.log(`🎉 Hourly Autopilot Run Complete! Successfully Delivered: ${campaignResults.sent}, Failed: ${campaignResults.failed}`);
      this.recordHistory(runRecord);
      this.saveState();

      return { success: true, sent: campaignResults.sent, total: eligibleLeads.length };
    } catch (err) {
      this.log(`❌ Autopilot Error: ${err.message}`);
      runRecord.status = 'error';
      runRecord.error = err.message;
      this.recordHistory(runRecord);
      return { success: false, error: err.message };
    } finally {
      this.isRunningCycle = false;
      this.scheduleNextRun();
    }
  }

  recordHistory(record) {
    if (!this.state.history) this.state.history = [];
    this.state.history.push(record);
    if (this.state.history.length > 50) this.state.history.shift();
    this.saveState();
  }
}

const autopilot = new AutopilotManager();

module.exports = autopilot;
