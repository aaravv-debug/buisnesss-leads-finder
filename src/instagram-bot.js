const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { getBrowserExecutablePath, sleep } = require('./utils');
const { interpolateTemplate } = require('./mailer');

const COOKIES_PATH = path.join(__dirname, '..', '.ig_session.json');

/**
 * Loads saved Instagram session cookies if they exist
 */
function loadSavedCookies() {
  try {
    if (fs.existsSync(COOKIES_PATH)) {
      const data = fs.readFileSync(COOKIES_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (_) {}
  return null;
}

/**
 * Saves Instagram cookies for persistent future sessions
 */
async function saveCookies(page) {
  try {
    const cookies = await page.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2), 'utf8');
  } catch (_) {}
}

/**
 * Type text with realistic human typing delays
 */
async function humanType(page, selector, text) {
  await page.focus(selector);
  for (const char of text) {
    await page.keyboard.sendCharacter(char);
    await sleep(Math.floor(Math.random() * 50) + 30);
  }
}

/**
 * Automate Instagram login and safe direct messaging
 */
async function runInstagramCampaign(options) {
  const {
    leads = [],
    credentials = {},
    messageTemplate,
    delaySeconds = 60,
    headless = false, // headful by default so user can handle 2FA/security challenge if prompted
    onProgress = () => {},
    onLog = () => {}
  } = options;

  const validLeads = leads.filter(l => l.socials && l.socials.instagram);
  onLog(`[Instagram Bot] Starting DM campaign for ${validLeads.length} Instagram profile(s)...`);

  if (validLeads.length === 0) {
    onLog(`[Instagram Bot] No leads with Instagram profiles found in selection.`);
    return { sent: 0, failed: 0, skipped: 0 };
  }

  const executablePath = getBrowserExecutablePath();
  const browser = await puppeteer.launch({
    executablePath,
    headless: headless ? 'new' : false,
    defaultViewport: { width: 1280, height: 850 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--lang=en-US,en',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,850'
    ]
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

  // Load cookies if available
  const savedCookies = loadSavedCookies();
  if (savedCookies && savedCookies.length > 0) {
    onLog(`[Instagram Bot] Restoring saved Instagram session...`);
    await page.setCookie(...savedCookies);
  }

  const results = {
    total: validLeads.length,
    sent: 0,
    failed: 0,
    skipped: 0
  };

  try {
    onLog(`[Instagram Bot] Verifying Instagram login status...`);
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3000);

    // Check if logged in (look for direct messages icon, profile link, or search input)
    let isLoggedIn = await page.evaluate(() => {
      return Boolean(document.querySelector('svg[aria-label="Direct"], svg[aria-label="Messages"], a[href*="/direct/inbox/"]'));
    });

    // If not logged in, attempt login with provided credentials
    if (!isLoggedIn) {
      if (!credentials.username || !credentials.password) {
        onLog(`[Instagram Bot] Not logged in and no credentials provided. Please provide username & password.`);
        await browser.close();
        return { error: 'Authentication required' };
      }

      onLog(`[Instagram Bot] Logging into @${credentials.username}...`);
      await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(2500);

      // Dismiss cookie modal if present
      try {
        const acceptCookie = await page.$('button:has-text("Allow all cookies"), button:has-text("Accept")');
        if (acceptCookie) await acceptCookie.click();
      } catch (_) {}

      await page.waitForSelector('input[name="username"]', { timeout: 15000 });
      await humanType(page, 'input[name="username"]', credentials.username);
      await sleep(500);
      await humanType(page, 'input[name="password"]', credentials.password);
      await sleep(800);

      // Click Log in
      await page.click('button[type="submit"]');
      onLog(`[Instagram Bot] Submitted credentials. Waiting for dashboard...`);

      // Wait for login transition
      await sleep(6000);

      // Dismiss "Save Your Login Info?" and "Turn on Notifications" dialogs
      try {
        const notNowBtn = await page.$('button:has-text("Not Now"), div[role="button"]:has-text("Not Now")');
        if (notNowBtn) await notNowBtn.click();
        await sleep(1500);
      } catch (_) {}

      await saveCookies(page);
      onLog(`[Instagram Bot] Successfully logged in and saved session cookies!`);
    } else {
      onLog(`[Instagram Bot] Session restored successfully! Logged in.`);
    }

    // Loop through leads and send DMs
    for (let i = 0; i < validLeads.length; i++) {
      const lead = validLeads[i];
      const igUrl = lead.socials.instagram;
      const personalizedMessage = interpolateTemplate(messageTemplate, lead);

      onLog(`[Instagram Bot] [${i + 1}/${validLeads.length}] Navigating to profile: ${lead.name} (${igUrl})...`);

      try {
        await page.goto(igUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await sleep(3000);

        // Find and click "Message" button
        const messageBtnClicked = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('header button, header div[role="button"], div[role="button"]'));
          for (const b of buttons) {
            const txt = b.innerText.trim().toLowerCase();
            if (txt === 'message') {
              b.click();
              return true;
            }
          }
          return false;
        });

        if (!messageBtnClicked) {
          onLog(`[Instagram Bot] Could not find "Message" button on ${lead.name}'s profile. Private or restricted.`);
          results.failed++;
          onProgress({ current: i + 1, total: validLeads.length, sent: results.sent, failed: results.failed });
          continue;
        }

        onLog(`[Instagram Bot] Opened chat thread for ${lead.name}. Typing message...`);
        await sleep(3500);

        // Wait for message textbox
        const textBoxSelector = 'div[role="textbox"][aria-label*="Message"], div[contenteditable="true"][role="textbox"]';
        try {
          await page.waitForSelector(textBoxSelector, { timeout: 10000 });
        } catch (_) {}

        const textBoxExists = await page.$(textBoxSelector);
        if (!textBoxExists) {
          onLog(`[Instagram Bot] Message input box not accessible for ${lead.name}.`);
          results.failed++;
          continue;
        }

        // Type personalized message naturally
        await humanType(page, textBoxSelector, personalizedMessage);
        await sleep(1000);

        // Press Enter to send
        await page.keyboard.press('Enter');
        await sleep(2000);

        results.sent++;
        onLog(`[Instagram Bot] 🚀 DM successfully sent to ${lead.name}!`);
      } catch (err) {
        results.failed++;
        onLog(`[Instagram Bot] ❌ Error sending DM to ${lead.name}: ${err.message}`);
      }

      onProgress({ current: i + 1, total: validLeads.length, sent: results.sent, failed: results.failed });

      // Safe pacing delay to avoid Instagram account action blocks
      if (i < validLeads.length - 1) {
        onLog(`[Instagram Bot] Pacing delay: Waiting ${delaySeconds}s before sending next DM to maintain account safety...`);
        await sleep(delaySeconds * 1000);
      }
    }

  } catch (err) {
    onLog(`[Instagram Bot] Fatal bot error: ${err.message}`);
  } finally {
    try {
      await saveCookies(page);
      await browser.close();
    } catch (_) {}
  }

  onLog(`[Instagram Bot] Campaign finished! Sent: ${results.sent}, Failed: ${results.failed}.`);
  return results;
}

module.exports = {
  runInstagramCampaign
};
