const axios = require('axios');
const cheerio = require('cheerio');

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

const INVALID_EMAIL_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.css', '.js', '.woff', '.woff2', '.ttf'];
const JUNK_DOMAINS = [
  'wixpress.com', 'sentry.io', 'schema.org', 'example.com', 'domain.com', 'email.com', 
  'yourdomain.com', 'mysite.com', 'godaddy.com', 'cloudflare.com', 'influxmarketing.com', 
  'dharmamarketing.cloud', 'booksy.com', 'mdw.co.in', 'wordpress.org', 'gravatar.com'
];
const JUNK_USERNAMES = [
  'example', 'filler', 'noreply', 'no-reply', 'donotreply', 'webmaster', 
  'hostmaster', 'postmaster', 'mailer-daemon', 'privacy', 'admin@domain'
];

/**
 * Filter out invalid or template emails
 */
function isValidEmail(email) {
  if (!email || email.length > 80) return false;
  const lower = email.toLowerCase().trim();
  
  for (const ext of INVALID_EMAIL_EXTENSIONS) {
    if (lower.endsWith(ext)) return false;
  }
  for (const junk of JUNK_DOMAINS) {
    if (lower.includes(junk)) return false;
  }
  const user = lower.split('@')[0];
  for (const junkUser of JUNK_USERNAMES) {
    if (user === junkUser || user.startsWith(junkUser + '+')) return false;
  }
  if (lower.startsWith('u00') || lower.includes('bootstrap') || lower.includes('jquery')) return false;
  if (!lower.includes('.') || lower.indexOf('@') < 1) return false;

  return true;
}

/**
 * Extract social media profiles from HTML content
 */
function extractSocials(html, baseUrl) {
  const socials = {
    instagram: null,
    facebook: null,
    linkedin: null,
    twitter: null,
    youtube: null
  };

  try {
    const $ = cheerio.load(html);
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const lower = href.toLowerCase();

      if (!socials.instagram && lower.includes('instagram.com/')) {
        if (!lower.includes('/p/') && !lower.includes('/explore/') && !lower.includes('instagram.com/accounts/')) {
          socials.instagram = href.split('?')[0];
        }
      }
      if (!socials.facebook && lower.includes('facebook.com/')) {
        if (!lower.includes('sharer') && !lower.includes('/share.php') && !lower.includes('facebook.com/policies')) {
          socials.facebook = href.split('?')[0];
        }
      }
      if (!socials.linkedin && lower.includes('linkedin.com/')) {
        if (lower.includes('/company/') || lower.includes('/in/')) {
          socials.linkedin = href.split('?')[0];
        }
      }
      if (!socials.twitter && (lower.includes('twitter.com/') || lower.includes('x.com/'))) {
        if (!lower.includes('/intent/') && !lower.includes('/share')) {
          socials.twitter = href.split('?')[0];
        }
      }
      if (!socials.youtube && lower.includes('youtube.com/')) {
        if (lower.includes('/channel/') || lower.includes('/c/') || lower.includes('/@') || lower.includes('/user/')) {
          socials.youtube = href.split('?')[0];
        }
      }
    });
  } catch (err) {
    // ignore parse error
  }

  return socials;
}

/**
 * Fetch HTML of a webpage with timeout and user-agent
 */
async function fetchPageHtml(url) {
  try {
    let target = url.trim();
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'https://' + target;
    }

    const response = await axios.get(target, {
      timeout: 7000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      responseType: 'text'
    });

    return { html: response.data, finalUrl: response.request?.res?.responseUrl || target };
  } catch (err) {
    return null;
  }
}

/**
 * Analyzes a business website to detect whether it is modern or outdated / needs redesign.
 * Evaluates: SSL security, mobile viewport responsiveness, copyright freshness,
 * legacy code (Flash, old jQuery 1.x, table layouts), online booking presence, and speed.
 */
function analyzeWebsite(html, url, responseTimeMs = 500) {
  if (!html) {
    return {
      status: 'unreachable',
      isOutdated: true,
      score: 25,
      issues: ['Website is unreachable or server timed out'],
      summary: 'Website server offline / unreachable',
      recommendedPitch: 'redesign'
    };
  }

  const issues = [];
  let score = 100;
  const $ = cheerio.load(html);
  const lowerHtml = html.toLowerCase();
  const currentYear = new Date().getFullYear();

  // 1. SSL / HTTPS Security
  const isHttps = url.toLowerCase().startsWith('https://');
  if (!isHttps) {
    issues.push('Missing SSL Certificate (Browsers warn visitors: "Not Secure")');
    score -= 25;
  }

  // 2. Mobile Viewport Meta Tag (Responsive Design)
  const hasViewport = $('meta[name="viewport"]').length > 0;
  if (!hasViewport) {
    issues.push('Not mobile-responsive (Missing viewport tag - looks broken or zoomed out on phones)');
    score -= 30;
  }

  // 3. Stale Copyright Year in Footer
  const copyrightMatch = html.match(/(?:©|&copy;|copyright|\(c\))\s*(?:20\d\d\s*[-–/]\s*)?(200\d|201\d|202[0-3])\b/i);
  let copyrightYear = null;
  if (copyrightMatch && copyrightMatch[1]) {
    copyrightYear = parseInt(copyrightMatch[1], 10);
    if (copyrightYear <= 2022) {
      const yearsAgo = currentYear - copyrightYear;
      issues.push(`Outdated copyright year (${copyrightYear} - not refreshed in ${yearsAgo}+ years)`);
      score -= 25;
    }
  }

  // 4. Obsolete Legacy Code (Flash, jQuery 1.x, Table Layouts)
  const hasOldJQuery = lowerHtml.includes('jquery-1.') || lowerHtml.includes('jquery/1.') || lowerHtml.includes('jquery.min.js?ver=1');
  const hasFlash = lowerHtml.includes('.swf') || lowerHtml.includes('shockwave-flash');
  const hasLayoutTables = $('table[cellpadding], table[cellspacing], table[width="100%"]').length >= 2;

  if (hasOldJQuery) {
    issues.push('Built with obsolete jQuery 1.x script (vulnerable and slow)');
    score -= 15;
  }
  if (hasFlash) {
    issues.push('Contains obsolete Adobe Flash elements (blocked by modern browsers)');
    score -= 35;
  }
  if (hasLayoutTables) {
    issues.push('Uses 2000s-era HTML table layouts instead of modern flex/grid');
    score -= 20;
  }

  // 5. OpenGraph Social Card Preview
  const hasOg = $('meta[property^="og:"]').length > 0;
  if (!hasOg) {
    issues.push('Missing OpenGraph social cards (no image preview when shared on WhatsApp or iMessage)');
    score -= 10;
  }

  // 6. Direct Online Booking Widget
  const bookingKeywords = [
    'calendly', 'acuity', 'vagaro', 'mindbody', 'booksy', 'square',
    'schedul', 'book online', 'book-now', 'booknow', 'setmore',
    'fresha', 'janeapp', 'appointment'
  ];
  const hasBooking = bookingKeywords.some(kw => lowerHtml.includes(kw));
  if (!hasBooking) {
    issues.push('No direct 1-click mobile appointment or booking widget for new clients');
    score -= 15;
  }

  // 7. Slow Server Load Time
  if (responseTimeMs > 2500) {
    issues.push(`Slow server load time (${(responseTimeMs / 1000).toFixed(1)}s delay)`);
    score -= 15;
  }

  score = Math.max(15, Math.min(100, score));

  // Determine if website is outdated / prime redesign candidate:
  const isOutdated = score < 75 || !hasViewport || !isHttps || (copyrightYear && copyrightYear <= 2022) || issues.length >= 2;

  return {
    status: isOutdated ? 'outdated' : 'modern',
    isOutdated,
    score,
    copyrightYear,
    hasViewport,
    isHttps,
    hasBooking,
    issues,
    summary: issues.length > 0 ? issues[0] : 'Modern & responsive',
    recommendedPitch: isOutdated ? 'redesign' : 'general'
  };
}

/**
 * Extract emails, social links, and website audit from website
 */
async function enrichWebsite(websiteUrl) {
  if (!websiteUrl) {
    return {
      emails: [],
      socials: {},
      audit: {
        status: 'no_website',
        isOutdated: false,
        score: 0,
        issues: ['No website found'],
        summary: 'No website online',
        recommendedPitch: 'new_website'
      }
    };
  }

  const result = {
    emails: new Set(),
    socials: {},
    audit: null
  };

  const startTime = Date.now();
  const pageData = await fetchPageHtml(websiteUrl);
  const responseTimeMs = Date.now() - startTime;

  if (!pageData || !pageData.html) {
    result.audit = {
      status: 'unreachable',
      isOutdated: true,
      score: 25,
      issues: ['Website server is down or unreachable'],
      summary: 'Website server offline / unreachable',
      recommendedPitch: 'redesign'
    };
    return {
      emails: [],
      socials: {},
      audit: result.audit
    };
  }

  const { html, finalUrl } = pageData;
  const $ = cheerio.load(html);

  // Perform Website Modernization Audit
  result.audit = analyzeWebsite(html, finalUrl || websiteUrl, responseTimeMs);

  // 1. Check mailto: links
  $('a[href^="mailto:"]').each((_, el) => {
    const raw = $(el).attr('href').replace(/^mailto:/i, '').split('?')[0].trim();
    if (isValidEmail(raw)) {
      result.emails.add(raw.toLowerCase());
    }
  });

  // 2. Check page body text using regex
  const textMatches = html.match(EMAIL_REGEX) || [];
  for (const match of textMatches) {
    if (isValidEmail(match)) {
      result.emails.add(match.toLowerCase());
    }
  }

  // 3. Extract socials from homepage
  result.socials = extractSocials(html, finalUrl);

  // 4. If no email found, find contact/about page link and try once more
  if (result.emails.size === 0) {
    let contactPageUrl = null;
    $('a[href]').each((_, el) => {
      if (contactPageUrl) return;
      const href = $(el).attr('href');
      const text = $(el).text().toLowerCase();
      if (href && (text.includes('contact') || href.toLowerCase().includes('contact') || text.includes('about') || href.toLowerCase().includes('about'))) {
        try {
          contactPageUrl = new URL(href, finalUrl).toString();
        } catch (_) {}
      }
    });

    if (contactPageUrl && contactPageUrl !== finalUrl) {
      const contactData = await fetchPageHtml(contactPageUrl);
      if (contactData && contactData.html) {
        const contact$ = cheerio.load(contactData.html);
        contact$('a[href^="mailto:"]').each((_, el) => {
          const raw = contact$(el).attr('href').replace(/^mailto:/i, '').split('?')[0].trim();
          if (isValidEmail(raw)) {
            result.emails.add(raw.toLowerCase());
          }
        });
        const moreMatches = contactData.html.match(EMAIL_REGEX) || [];
        for (const match of moreMatches) {
          if (isValidEmail(match)) {
            result.emails.add(match.toLowerCase());
          }
        }
      }
    }
  }

  return {
    emails: Array.from(result.emails),
    socials: result.socials,
    audit: result.audit
  };
}

/**
 * Searches the web (via Bing/search fallback) to find Instagram, Facebook, LinkedIn,
 * and contact emails when missing from Google Maps or website.
 */
async function searchWebForSocialsAndEmail(businessName, location = '') {
  if (!businessName) return { instagram: null, facebook: null, linkedin: null, website: null, emails: [] };

  const query = `${businessName} ${location} instagram facebook contact`;
  try {
    const res = await axios.get(`https://www.bing.com/search?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 7000
    });

    const $ = cheerio.load(res.data);
    const discovered = {
      instagram: null,
      facebook: null,
      linkedin: null,
      website: null,
      emails: []
    };

    // Extract emails from body text
    const textMatches = res.data.match(EMAIL_REGEX) || [];
    for (const em of textMatches) {
      if (isValidEmail(em) && !em.includes('bing.com') && !em.includes('microsoft.com')) {
        discovered.emails.push(em.toLowerCase());
      }
    }

    // Decode Bing redirect URLs in raw text and gather all links
    const rawData = res.data;
    const decodedLinks = [];
    const uMatches = rawData.match(/&u=a1([a-zA-Z0-9_-]+)/g) || [];
    for (const um of uMatches) {
      try {
        const token = um.replace('&u=a1', '');
        const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = Buffer.from(base64, 'base64').toString('utf-8');
        decodedLinks.push(decoded);
      } catch (_) {}
    }

    $('a').each((_, a) => {
      let href = $(a).attr('href') || '';
      if (href) decodedLinks.push(href);
    });

    for (const href of decodedLinks) {
      const lower = href.toLowerCase();
      if (!discovered.instagram && lower.includes('instagram.com/')) {
        if (!lower.includes('/p/') && !lower.includes('/explore/') && !lower.includes('/reels/') && !lower.includes('/accounts/') && !lower.includes('/directory/')) {
          discovered.instagram = href.split('?')[0];
        }
      }
      if (!discovered.facebook && lower.includes('facebook.com/')) {
        if (!lower.includes('sharer') && !lower.includes('/login') && !lower.includes('/help') && !lower.includes('/policies') && !lower.includes('/privacy') && !lower.includes('/pages')) {
          discovered.facebook = href.split('?')[0];
        }
      }
      if (!discovered.linkedin && lower.includes('linkedin.com/')) {
        if (lower.includes('/company/') || lower.includes('/in/')) {
          discovered.linkedin = href.split('?')[0];
        }
      }
      if (!discovered.website && !lower.includes('instagram.com') && !lower.includes('facebook.com') && !lower.includes('linkedin.com') && !lower.includes('twitter.com') && !lower.includes('yelp.com') && !lower.includes('yellowpages.com') && !lower.includes('mapquest.com') && !lower.includes('bing.com') && !lower.includes('microsoft.com') && !lower.includes('apple.com') && !lower.includes('tripadvisor.com')) {
        if (href.startsWith('http://') || href.startsWith('https://')) {
          discovered.website = href.split('?')[0];
        }
      }
    }

    // Direct regex fallback on HTML text
    if (!discovered.instagram) {
      const igMatch = rawData.match(/https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]{2,30})/i);
      if (igMatch && !['p', 'explore', 'reels', 'accounts', 'directory'].includes(igMatch[1].toLowerCase())) {
        discovered.instagram = igMatch[0].split('?')[0];
      }
    }
    if (!discovered.facebook) {
      const fbMatch = rawData.match(/https?:\/\/(?:www\.)?facebook\.com\/([a-zA-Z0-9_.]{3,50})/i);
      if (fbMatch && !['sharer', 'login', 'help', 'pages', 'privacy', 'policies'].includes(fbMatch[1].toLowerCase())) {
        discovered.facebook = fbMatch[0].split('?')[0];
      }
    }

    discovered.emails = Array.from(new Set(discovered.emails));
    return discovered;
  } catch (err) {
    return { instagram: null, facebook: null, linkedin: null, website: null, emails: [] };
  }
}

/**
 * Format a phone number into an international WhatsApp click-to-chat URL
 */
function formatWhatsAppUrl(rawPhone) {
  if (!rawPhone) return null;
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return null;

  // If 10 digits (Standard US phone), prepend '1'
  if (digits.length === 10) {
    return `https://wa.me/1${digits}`;
  }
  // If 11 digits starting with 1
  if (digits.length === 11 && digits.startsWith('1')) {
    return `https://wa.me/${digits}`;
  }
  // Other international formats with at least 8 digits
  if (digits.length >= 8) {
    return `https://wa.me/${digits}`;
  }
  return null;
}

/**
 * Comprehensive lead enrichment:
 * 1. Crawls website if present
 * 2. If website missing or socials missing, performs targeted web search
 * 3. Builds direct 1-click outreach links for WhatsApp, Instagram, Facebook, and Google
 */
async function enrichLeadComprehensively(lead, location = '') {
  lead.socials = lead.socials || {};
  lead.emails = lead.emails || [];

  // 1. Enrich existing website
  if (lead.website) {
    try {
      const webData = await enrichWebsite(lead.website);
      if (webData.emails && webData.emails.length > 0) {
        lead.emails = Array.from(new Set([...lead.emails, ...webData.emails]));
      }
      if (webData.socials) {
        lead.socials = { ...lead.socials, ...webData.socials };
      }
      if (webData.audit) {
        lead.websiteAudit = webData.audit;
      }
    } catch (_) {}
  }

  // 2. If Instagram, Facebook, or Website is still missing, run web search fallback
  if (!lead.socials.instagram || !lead.socials.facebook || !lead.website || lead.emails.length === 0) {
    try {
      const searchData = await searchWebForSocialsAndEmail(lead.name, location || lead.address);
      if (!lead.socials.instagram && searchData.instagram) lead.socials.instagram = searchData.instagram;
      if (!lead.socials.facebook && searchData.facebook) lead.socials.facebook = searchData.facebook;
      if (!lead.socials.linkedin && searchData.linkedin) lead.socials.linkedin = searchData.linkedin;
      if (!lead.website && searchData.website) {
        lead.website = searchData.website;
        // Audit the newly found website
        try {
          const webData = await enrichWebsite(lead.website);
          if (webData.audit) lead.websiteAudit = webData.audit;
        } catch (_) {}
      }
      if (searchData.emails && searchData.emails.length > 0) {
        lead.emails = Array.from(new Set([...lead.emails, ...searchData.emails]));
      }
    } catch (_) {}
  }

  // Fallback audit object if lead has no website
  if (!lead.website) {
    lead.websiteAudit = {
      status: 'no_website',
      isOutdated: false,
      score: 0,
      issues: ['No website found online'],
      summary: 'No website',
      recommendedPitch: 'new_website'
    };
  } else if (!lead.websiteAudit) {
    lead.websiteAudit = {
      status: 'modern',
      isOutdated: false,
      score: 85,
      issues: [],
      summary: 'Website active',
      recommendedPitch: 'general'
    };
  }

  // 3. Construct 1-click outreach channels
  lead.whatsAppUrl = formatWhatsAppUrl(lead.phone);
  lead.outreach = {
    whatsApp: lead.whatsAppUrl,
    instagram: lead.socials.instagram || `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(lead.name)}`,
    facebook: lead.socials.facebook || `https://www.facebook.com/search/pages/?q=${encodeURIComponent(lead.name)}`,
    googleSearch: `https://www.google.com/search?q=${encodeURIComponent('"' + lead.name + '" ' + (location || lead.address || '') + ' contact email phone')}`
  };

  return lead;
}

module.exports = {
  enrichWebsite,
  analyzeWebsite,
  searchWebForSocialsAndEmail,
  formatWhatsAppUrl,
  enrichLeadComprehensively,
  isValidEmail
};

