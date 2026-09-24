const puppeteer = require('puppeteer-core');
const { getBrowserExecutablePath, sleep, cleanText } = require('./utils');
const { enrichWebsite, enrichLeadComprehensively } = require('./enricher');

/**
 * Scrapes Google Maps listings for a given query
 * 
 * @param {Object} options
 * @param {string} options.query - Search query e.g. "gyms in Miami, FL"
 * @param {number} [options.maxResults=20] - Max businesses to scrape
 * @param {boolean} [options.enrich=true] - Extract email and socials from website
 * @param {boolean} [options.headless=true] - Run browser in headless mode
 * @param {Function} [options.onLead] - Callback called as soon as a lead is scraped & enriched
 * @param {Function} [options.onLog] - Callback for log messages
 * @param {Function} [options.onProgress] - Callback for progress (e.g. { current, total })
 */
async function scrapeGoogleMaps(options) {
  const {
    query,
    maxResults = 20,
    enrich = true,
    headless = true,
    onLead = () => {},
    onLog = () => {},
    onProgress = () => {}
  } = options;

  onLog(`Starting search for: "${query}" (Max results: ${maxResults})`);

  const executablePath = getBrowserExecutablePath();
  const browser = await puppeteer.launch({
    executablePath,
    headless: headless ? 'new' : false,
    defaultViewport: { width: 1280, height: 800 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--lang=en-US,en',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,800'
    ]
  });

  const page = await browser.newPage();

  // Avoid detection
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );

  const results = [];
  const seenUrls = new Set();

  try {
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=en`;
    onLog(`Navigating to Google Maps...`);
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Handle cookie consent dialogs if present
    try {
      const consentButtons = await page.$$('button[aria-label*="Accept all"], button[aria-label*="Agree"], form[action*="consent"] button');
      for (const btn of consentButtons) {
        await btn.click().catch(() => {});
        await sleep(1000);
      }
    } catch (_) {}

    await sleep(2000);

    // Wait for the feed or place listing to load
    const feedSelector = 'div[role="feed"]';
    let hasFeed = true;
    try {
      await page.waitForSelector(feedSelector, { timeout: 8000 });
    } catch (err) {
      hasFeed = false;
    }

    if (!hasFeed) {
      // Check if it redirected directly to a single business place detail
      const isSinglePlace = await page.$('h1.DUwDvf, h1.fontHeadlineLarge, h1[class*="header"]');
      if (isSinglePlace) {
        onLog(`Direct match found for single business place.`);
        const singleLead = await extractDetailFromPage(page);
        if (singleLead && singleLead.name) {
          if (enrich) {
            onLog(`Enriching ${singleLead.name} (socials, emails & outreach)...`);
            await enrichLeadComprehensively(singleLead, query);
          }
          results.push(singleLead);
          onLead(singleLead);
          onProgress({ current: 1, total: 1 });
        }
        await browser.close();
        return results;
      }

      onLog(`No results feed found for query: "${query}"`);
      await browser.close();
      return [];
    }

    onLog(`Search results feed loaded. Scrolling to gather listings...`);

    // Auto-scroll the feed to collect enough items
    let previousCount = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 30;

    while (scrollAttempts < maxScrollAttempts) {
      const currentListings = await page.$$('div[role="feed"] > div > div > a[href*="/maps/place/"], div[role="feed"] a[href*="/maps/place/"]');
      
      onLog(`Found ${currentListings.length} potential listings so far...`);
      onProgress({ current: Math.min(currentListings.length, maxResults), total: maxResults });

      if (currentListings.length >= maxResults) {
        break;
      }

      if (currentListings.length === previousCount) {
        scrollAttempts++;
      } else {
        scrollAttempts = 0;
        previousCount = currentListings.length;
      }

      // Check for end of list text
      const reachedEnd = await page.evaluate(() => {
        const text = document.body.innerText;
        return text.includes("You've reached the end of the list") || text.includes("No more results");
      });
      if (reachedEnd) {
        onLog(`Reached end of Google Maps listings.`);
        break;
      }

      // Scroll the feed element
      await page.evaluate((selector) => {
        const feed = document.querySelector(selector);
        if (feed) {
          feed.scrollBy(0, 1000);
        }
      }, feedSelector);

      await sleep(1500);
    }

    // Now extract URLs and preliminary details of items in the feed
    const rawItems = await page.evaluate((max) => {
      const links = Array.from(document.querySelectorAll('div[role="feed"] a[href*="/maps/place/"]'));
      const items = [];
      const seen = new Set();

      for (const a of links) {
        const url = a.href;
        if (!url || seen.has(url)) continue;
        seen.add(url);

        // Get container
        const card = a.closest('div[jsaction]') || a.parentElement;
        const textContent = card ? card.innerText : '';
        const lines = textContent.split('\n').map(s => s.trim()).filter(Boolean);

        // Business Name: check specific classes first, then aria-label, then lines
        const qBF1Pd = card?.querySelector('.qBF1Pd')?.innerText?.trim();
        const fontHeadline = card?.querySelector('.fontHeadlineSmall')?.innerText?.trim();
        const ariaLabel = a.getAttribute('aria-label')?.trim();
        const name = qBF1Pd || fontHeadline || ariaLabel || lines[0] || '';

        // Rating and reviews from aria-label
        let rating = null;
        let reviews = null;
        const ratingSpan = card ? card.querySelector('span[role="img"]') : null;
        if (ratingSpan) {
          const aria = ratingSpan.getAttribute('aria-label') || '';
          const match = aria.match(/([0-9.]+)\s*stars?(?:\s*([0-9,]+)\s*reviews?)?/i);
          if (match) {
            rating = parseFloat(match[1]);
            reviews = match[2] ? parseInt(match[2].replace(/,/g, ''), 10) : null;
          }
        }

        // Category from card lines (e.g. "Gym ·  · 1830 N Bayshore Dr")
        let category = null;
        for (const l of lines) {
          if (l.includes('·')) {
            const parts = l.split('·').map(s => s.trim()).filter(Boolean);
            if (parts[0] && !parts[0].match(/^[0-9.]/)) {
              category = parts[0];
              break;
            }
          }
        }

        items.push({
          name,
          category,
          url,
          rating,
          reviews,
          lines
        });

        if (items.length >= max) break;
      }

      return items;
    }, maxResults);

    onLog(`Found ${rawItems.length} businesses to extract details for.`);

    // Extract detailed information by clicking each listing or navigating
    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i];
      if (seenUrls.has(item.url)) continue;
      seenUrls.add(item.url);

      const businessName = item.name || `Business #${i + 1}`;
      onLog(`[${i + 1}/${rawItems.length}] Extracting: ${businessName}`);

      let lead = {
        id: `lead_${Date.now()}_${i}`,
        name: businessName,
        category: item.category || null,
        address: null,
        phone: null,
        website: null,
        rating: item.rating,
        reviews: item.reviews,
        googleMapsUrl: item.url,
        emails: [],
        socials: {}
      };

      try {
        // Find the clickable item in the current feed
        const clicked = await page.evaluate((targetUrl) => {
          const a = document.querySelector(`a[href="${targetUrl}"]`);
          if (a) {
            a.scrollIntoView({ behavior: 'instant', block: 'center' });
            a.click();
            return true;
          }
          return false;
        }, item.url);

        if (clicked) {
          await sleep(1500);
          const detail = await extractDetailFromPage(page);
          lead = {
            ...lead,
            ...detail,
            name: detail.name || item.name || lead.name,
            category: detail.category || item.category || lead.category,
            rating: detail.rating !== null ? detail.rating : lead.rating,
            reviews: detail.reviews !== null ? detail.reviews : lead.reviews,
            googleMapsUrl: page.url().includes('/maps/place/') ? page.url() : item.url
          };
        } else {
          // If cannot click in feed, navigate directly
          await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await sleep(1200);
          const detail = await extractDetailFromPage(page);
          lead = {
            ...lead,
            ...detail,
            name: detail.name || item.name || lead.name,
            category: detail.category || item.category || lead.category,
            rating: detail.rating !== null ? detail.rating : lead.rating,
            reviews: detail.reviews !== null ? detail.reviews : lead.reviews,
            googleMapsUrl: page.url().includes('/maps/place/') ? page.url() : item.url
          };
        }
      } catch (err) {
        onLog(`Warning: Failed to fetch full details for ${lead.name}: ${err.message}`);
      }

      // Comprehensive enrichment: website crawling + social profile & email search fallback
      if (enrich) {
        try {
          onLog(`Enriching ${lead.name} (socials, emails & outreach links)...`);
          await enrichLeadComprehensively(lead, query);
          if (lead.emails.length > 0) {
            onLog(`Discovered email(s) for ${lead.name}: ${lead.emails.join(', ')}`);
          }
          if (lead.socials.instagram || lead.socials.facebook) {
            const found = [lead.socials.instagram ? 'Instagram' : null, lead.socials.facebook ? 'Facebook' : null].filter(Boolean).join(', ');
            onLog(`Discovered social profile(s) for ${lead.name}: ${found}`);
          }
        } catch (err) {
          onLog(`Enrichment notice for ${lead.name}: ${err.message}`);
        }
      }

      results.push(lead);
      onLead(lead);
      onProgress({ current: results.length, total: rawItems.length });
    }

  } catch (err) {
    onLog(`Scraping error: ${err.message}`);
  } finally {
    try {
      await browser.close();
    } catch (_) {}
  }

  onLog(`Completed scraping. Extracted ${results.length} total leads.`);
  return results;
}

/**
 * Extract details from the currently loaded Google Maps place detail pane
 */
async function extractDetailFromPage(page) {
  return await page.evaluate(() => {
    // 1. Business Name (Modern Google Maps uses h1.DUwDvf)
    const nameEl = document.querySelector('h1.DUwDvf, h1.fontHeadlineLarge, div.fontHeadlineLarge, h1[class*="DUwDvf"], h1');
    let name = null;
    if (nameEl && nameEl.innerText && nameEl.innerText.trim() !== 'Results') {
      name = nameEl.innerText.trim();
    }

    // 2. Category
    let category = null;
    const catCandidates = Array.from(document.querySelectorAll('button.DkEaL, button[jsaction*="pane.rating.category"], [class*="fontBodyMedium"] button'));
    for (const el of catCandidates) {
      const txt = el.innerText.trim();
      if (txt && !['see more', 'suggest an edit', 'claim this business', 'add phone number', 'add website'].includes(txt.toLowerCase())) {
        category = txt;
        break;
      }
    }

    // 3. Address
    let address = null;
    const addressBtn = document.querySelector('button[data-item-id="address"], button[aria-label*="Address:"]');
    if (addressBtn) {
      address = addressBtn.getAttribute('aria-label')?.replace(/^Address:\s*/i, '').trim() || addressBtn.innerText.trim();
    }

    // 4. Website
    let website = null;
    const websiteLink = document.querySelector('a[data-item-id="authority"], a[aria-label*="Website:"]');
    if (websiteLink) {
      website = websiteLink.href || websiteLink.getAttribute('href');
    }

    // 5. Phone
    let phone = null;
    const phoneBtn = document.querySelector('button[data-item-id*="phone:tel:"], button[aria-label*="Phone:"], a[href^="tel:"]');
    if (phoneBtn) {
      phone = phoneBtn.getAttribute('aria-label')?.replace(/^Phone:\s*/i, '').trim() || phoneBtn.innerText.trim();
    }
    if (!phone) {
      // Check phone regex in page text
      const pageText = document.body.innerText || '';
      const phoneMatch = pageText.match(/(?:\+?1[-. ]?)?\(?[2-9]\d{2}\)?[-. ]?\d{3}[-. ]?\d{4}/);
      if (phoneMatch) {
        phone = phoneMatch[0].trim();
      }
    }

    // 6. Rating & Reviews
    let rating = null;
    let reviews = null;
    const ratingEl = document.querySelector('div.F7nice span[aria-hidden="true"], span.ceNzKf');
    if (ratingEl) {
      rating = parseFloat(ratingEl.innerText.trim()) || null;
    }
    const reviewsEl = document.querySelector('div.F7nice span[aria-label*="review"], span[aria-label*="reviews"]');
    if (reviewsEl) {
      const match = (reviewsEl.getAttribute('aria-label') || reviewsEl.innerText).match(/([0-9,]+)/);
      if (match) {
        reviews = parseInt(match[1].replace(/,/g, ''), 10);
      }
    }

    // 7. Social Links directly on Google Maps Profile
    const socials = {};
    const socialAnchors = Array.from(document.querySelectorAll('a[href*="facebook.com"], a[href*="instagram.com"], a[href*="linkedin.com"], a[href*="twitter.com"], a[href*="x.com"], a[href*="youtube.com"]'));
    for (const a of socialAnchors) {
      const h = a.href || '';
      const lower = h.toLowerCase();
      if (!socials.instagram && lower.includes('instagram.com/')) {
        if (!lower.includes('/p/') && !lower.includes('/explore/')) socials.instagram = h.split('?')[0];
      }
      if (!socials.facebook && lower.includes('facebook.com/')) {
        if (!lower.includes('sharer') && !lower.includes('/share.php')) socials.facebook = h.split('?')[0];
      }
      if (!socials.linkedin && lower.includes('linkedin.com/')) {
        if (lower.includes('/company/') || lower.includes('/in/')) socials.linkedin = h.split('?')[0];
      }
      if (!socials.twitter && (lower.includes('twitter.com/') || lower.includes('x.com/'))) {
        socials.twitter = h.split('?')[0];
      }
      if (!socials.youtube && lower.includes('youtube.com/')) {
        socials.youtube = h.split('?')[0];
      }
    }

    return {
      name,
      category,
      address,
      website,
      phone,
      rating,
      reviews,
      socials
    };
  });
}

module.exports = {
  scrapeGoogleMaps
};
