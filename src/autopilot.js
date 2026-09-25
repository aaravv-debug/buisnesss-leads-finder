
// Anti-Spam Dynamic Content Generator (prevents "Message Blocked" by randomizing phrasing and structure)
function generateDynamicPitch(lead, isRedesign = false) {
  const name = lead.name || 'there';
  const city = lead.city || 'your area';
  const category = lead.category || 'local business';
  const website = lead.website || '';

  const subjectsNoWeb = [
    `Quick question regarding ${name}'s online booking`,
    `Question for ${name} team`,
    `Idea for ${name}'s mobile booking`,
    `Quick note regarding ${name}`,
    `New client booking question for ${name}`,
    `Idea regarding appointments for ${name}`
  ];

  const subjectsRedesign = [
    `Quick thoughts on modernizing ${name}'s website`,
    `Mobile booking idea for ${name}`,
    `${name} website & appointments idea`,
    `Thoughts on ${name}'s current website`,
    `Quick question for ${name} team`,
    `Feedback on ${name}'s mobile booking flow`
  ];

  const greetings = [
    `Hi ${name} team! 👋`,
    `Hello to the team at ${name},`,
    `Hi there ${name} team,`,
    `Good day to the ${name} team,`,
    `Hope you're having a productive week ${name} team!`
  ];

  const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
  const subject = isRedesign 
    ? subjectsRedesign[Math.floor(Math.random() * subjectsRedesign.length)]
    : subjectsNoWeb[Math.floor(Math.random() * subjectsNoWeb.length)];

  let body = '';
  if (isRedesign) {
    const intros = [
      `I was researching top ${category} practices in ${city} and was taking a look at your current website (${website}).`,
      `I came across ${name} while looking at leading ${category} businesses in ${city} and checked out your website (${website}).`,
      `I was browsing ${category} providers in ${city} and noticed your site at ${website}.`,
      `I came across your business while researching reputable ${category} spots in ${city}.`
    ];
    const randIntro = intros[Math.floor(Math.random() * intros.length)];

    body = `${randomGreeting}\n\n${randIntro}\n\nI noticed a few areas where streamlining the layout and adding a direct mobile-friendly booking system could easily bring in 5-10 extra appointments every week.\n\nI specialize in fast, high-converting booking websites for ${category} practices. You can review my recent client work and portfolio here:\n👉 https://aaravsinh-rathod-portfolio-9.vercel.app/\n\nMay I send a 45-second video showing how your website will look for ${name}? No pressure at all, just thought it might give you some great ideas!\n\nBest regards,\nAaravsinh Rathod\nFreelance Web Developer\n\n(PS: If you'd rather not receive any ideas, simply reply "opt out" and I won't reach out again!)`;
  } else {
    const intros = [
      `I was looking at top ${category} businesses in ${city} and noticed your Google profile currently doesn't have an active website or direct mobile booking link for clients.`,
      `I came across ${name} in ${city} and noticed your profile is missing a direct online booking website.`,
      `I was looking at ${category} services in ${city} and saw your listing without an active website.`
    ];
    const randIntro = intros[Math.floor(Math.random() * intros.length)];

    body = `${randomGreeting}\n\n${randIntro}\n\nI build clean, modern, and fast booking websites that help ${category} businesses bring in 5-10 extra appointments every week. You can see my recent client work and portfolio here:\n👉 https://aaravsinh-rathod-portfolio-9.vercel.app/\n\nMay I send a 45-second video showing how your website will look for ${name}? No pressure at all, just thought it might be helpful!\n\nBest regards,\nAaravsinh Rathod\nFreelance Web Developer\n\n(PS: If you'd rather not receive any ideas, simply reply "opt out" and I won't reach out again!)`;
  }

  return { subject, body };
}

const dns = require('dns');
try { dns.setDefaultResultOrder('ipv4first'); } catch (_) {}
const followups = require('./followups');
const fs = require('fs');
const path = require('path');
const { scrapeGoogleMaps } = require('./scraper');
const { runEmailCampaign, verifyConnection } = require('./mailer');
const { sleep } = require('./utils');

const AUTOPILOT_STORE_PATH = path.join(__dirname, '..', 'autopilot-state.json');

const ROTATING_TARGETS = [
  { niche: 'Luxury Day Spa', city: 'Chicago, IL' },
  { niche: 'Med Spa & Skin Clinic', city: 'Scottsdale, AZ' },
  { niche: 'Day Spa & Wellness', city: 'San Diego, CA' },
  { niche: 'Aesthetics & Wellness Spa', city: 'Atlanta, GA' },
  { niche: 'Laser & Medical Spa', city: 'Dallas, TX' },
  { niche: 'Med Spa', city: 'Miami, FL' },
  { niche: 'Cosmetic Dentist', city: 'Austin, TX' },
  { niche: 'Aesthetics & Botox Clinic', city: 'Los Angeles, CA' },
  { niche: 'Wellness & Laser Spa', city: 'New York, NY' },
  { niche: 'Skin & Beauty Clinic', city: 'Toronto, Canada' },
  { niche: 'Chiropractic Clinic', city: 'Denver, CO' },
  { niche: 'Dental Practice', city: 'London, UK' }
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
      const targetLeadsNeeded = this.state.maxLeadsPerRun || 70;
      const maxToScrape = Math.max(targetLeadsNeeded, Math.round(targetLeadsNeeded * 1.4));
      this.log(`Scraping up to ${maxToScrape} fresh leads for: "${target.niche} in ${target.city}"...`);
      const scrapedLeads = await scrapeGoogleMaps({
        query: `${target.niche.replace(/&/g, 'and')} in ${target.city}`,
        maxResults: maxToScrape,
        enrich: true,
        headless: true,
        onLog: (m) => this.log(m)
      });

      runRecord.leadsFound = scrapedLeads.length;
      this.log(`Scraped ${scrapedLeads.length} leads. Filtering for unreached leads with emails...`);

      // 3. Filter Leads
      const eligibleLeads = [];
      // Load suppression list
      let suppressionSet = new Set();
      try {
        const suppFile = path.join(__dirname, '..', 'data', 'suppression-list.json');
        if (fs.existsSync(suppFile)) {
          suppressionSet = new Set(JSON.parse(fs.readFileSync(suppFile, 'utf8')).map(e => e.toLowerCase()));
        }
      } catch (_) {}

      for (const lead of scrapedLeads) {
        if (!lead.emails || lead.emails.length === 0) continue;
        const primaryEmail = lead.emails[0].toLowerCase();
        if (this.sentEmailsSet.has(primaryEmail)) continue;
        if (suppressionSet.has(primaryEmail)) continue; // skip known bounced emails // avoid re-emailing
        eligibleLeads.push(lead);
        if (eligibleLeads.length >= this.state.maxLeadsPerRun) break;
      }

      this.log(`Identified ${eligibleLeads.length} fresh qualified leads ready for automated outreach.`);

      if (eligibleLeads.length === 0) {
        this.log(`⚠️ 0 new leads found for "${target.niche} in ${target.city}". Automatically trying next location immediately...`);
        runRecord.status = 'skipped_trying_next';
        // Try up to 2 fallback niches in the same cycle so an hour is NEVER wasted
        for (let retry = 0; retry < 2; retry++) {
          const fallbackTarget = ROTATING_TARGETS[this.state.targetIndex % ROTATING_TARGETS.length];
          this.state.targetIndex = (this.state.targetIndex + 1) % ROTATING_TARGETS.length;
          this.log(`🔄 Fallback Search (${retry + 1}/2): "${fallbackTarget.niche} in ${fallbackTarget.city}"...`);
          const fallbackLeads = await scrapeGoogleMaps({
            query: `${fallbackTarget.niche.replace(/&/g, 'and')} in ${fallbackTarget.city}`,
            maxResults: maxToScrape,
            enrich: true,
            headless: true,
            onLog: (m) => this.log(m)
          });
          for (const l of fallbackLeads) {
            if (l.emails && l.emails.length > 0 && !this.sentEmailsSet.has(l.emails[0].toLowerCase())) {
              eligibleLeads.push(l);
              if (eligibleLeads.length >= (this.state.maxLeadsPerRun || 30)) break;
            }
          }
          if (eligibleLeads.length > 0) break;
        }

        if (eligibleLeads.length === 0) {
          this.log(`No leads found after fallback tries. Will try next batch next hour.`);
          runRecord.status = 'no_new_leads';
          this.recordHistory(runRecord);
          return { success: true, sent: 0, reason: 'No new leads' };
        }
      }

      // 4. Send Emails with Smart Adaptive Pitch & Dynamic Anti-Spam Spintax
      const campaignResults = await runEmailCampaign({
        leads: eligibleLeads,
        config: smtpConfig,
        dynamicPitchGenerator: (lead, hasWebsite) => generateDynamicPitch(lead, hasWebsite),
        delaySeconds: 30, // 30s safe delay + human pacing to prevent spam flags
        onLog: (m) => this.log(m)
      });

      // Track sent emails
      for (const d of campaignResults.details) {
        if (d.status === 'sent' && d.email) {
          this.sentEmailsSet.add(d.email.toLowerCase());
          const matchLead = eligibleLeads.find(l => l.emails && l.emails[0] && l.emails[0].toLowerCase() === d.email.toLowerCase());
          followups.addFollowupLead(matchLead || { name: d.name || d.email.split('@')[0], email: d.email }, target.city, target.niche);
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
