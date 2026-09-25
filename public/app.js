// LeadPulse Scraper Frontend Logic

let currentJobId = null;
let eventSource = null;
let allLeads = [];
let activeFilter = 'all';

// DOM Elements
const scrapeForm = document.getElementById('scrapeForm');
const queryInput = document.getElementById('queryInput');
const cityInput = document.getElementById('cityInput');
const limitSelect = document.getElementById('limitSelect');
const enrichToggle = document.getElementById('enrichToggle');
const headlessToggle = document.getElementById('headlessToggle');
const startBtn = document.getElementById('startBtn');
const startBtnText = document.getElementById('startBtnText');
const btnSpinner = document.getElementById('btnSpinner');

// Progress & Status
const liveProgressContainer = document.getElementById('liveProgressContainer');
const progressBar = document.getElementById('progressBar');
const progressPercentage = document.getElementById('progressPercentage');
const progressFraction = document.getElementById('progressFraction');
const progressStatusText = document.getElementById('progressStatusText');
const latestLogText = document.getElementById('latestLogText');
const systemStatusText = document.getElementById('systemStatusText');

// Metric Counters
const metricTotal = document.getElementById('metricTotal');
const metricEmails = document.getElementById('metricEmails');
const metricPhones = document.getElementById('metricPhones');
const metricWebsites = document.getElementById('metricWebsites');
const metricSocials = document.getElementById('metricSocials');

// Table Elements
const leadsTableBody = document.getElementById('leadsTableBody');
const emptyStateRow = document.getElementById('emptyStateRow');
const tableCountBadge = document.getElementById('tableCountBadge');
const tableFilterInput = document.getElementById('tableFilterInput');
const filterChips = document.querySelectorAll('.filter-chip');

// Export & Action Buttons
const exportXlsxBtn = document.getElementById('exportXlsxBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const copyEmailsBtn = document.getElementById('copyEmailsBtn');

// Terminal Logs
const terminalLogs = document.getElementById('terminalLogs');
const clearLogsBtn = document.getElementById('clearLogsBtn');

// Batch Modal
const batchModalBtn = document.getElementById('batchModalBtn');
const batchModal = document.getElementById('batchModal');
const batchModalClose = document.getElementById('batchModalClose');
const batchCancelBtn = document.getElementById('batchCancelBtn');
const batchStartBtn = document.getElementById('batchStartBtn');
const batchCityInput = document.getElementById('batchCityInput');
const batchKeywords = document.getElementById('batchKeywords');
const batchLimit = document.getElementById('batchLimit');

// Toast
const toast = document.getElementById('toast');

// --- Initialization & Event Listeners ---

scrapeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = queryInput.value.trim();
  const city = cityInput.value.trim();
  const maxResults = parseInt(limitSelect.value, 10);
  const enrich = enrichToggle.checked;
  const headless = headlessToggle.checked;

  if (!query) {
    showToast('Please enter a business keyword/niche.');
    return;
  }

  await startScrapeJob({ query, city, maxResults, enrich, headless });
});

// Start Scraping Job
async function startScrapeJob(payload) {
  setScrapingState(true);
  resetMetrics();
  allLeads = [];
  renderLeadsTable();

  try {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to start job');

    currentJobId = data.jobId;
    appendLog(`Job initialized [ID: ${currentJobId}]. Connecting to real-time event stream...`);
    connectToJobStream(currentJobId);
  } catch (err) {
    appendLog(`Error launching job: ${err.message}`, 'error');
    setScrapingState(false);
    showToast(`Error: ${err.message}`);
  }
}

// Connect to Server-Sent Events (SSE) stream
function connectToJobStream(jobId) {
  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource(`/api/jobs/${jobId}/events`);

  eventSource.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);

      if (msg.type === 'init') {
        if (msg.leads && msg.leads.length > 0) {
          allLeads = msg.leads;
          renderLeadsTable();
          updateMetrics();
        }
      } else if (msg.type === 'lead') {
        allLeads.push(msg.lead);
        renderSingleLead(msg.lead);
        updateMetrics();
        if (exportXlsxBtn) exportXlsxBtn.disabled = false;
        exportCsvBtn.disabled = false;
        exportJsonBtn.disabled = false;
      } else if (msg.type === 'log') {
        appendLog(`[${msg.log.timestamp}] ${msg.log.text}`);
        latestLogText.textContent = msg.log.text;
      } else if (msg.type === 'progress') {
        const { current, total } = msg.progress;
        const pct = Math.min(100, Math.round((current / (total || 1)) * 100));
        progressBar.style.width = `${pct}%`;
        progressPercentage.textContent = `${pct}%`;
        progressFraction.textContent = `(${current}/${total})`;
      } else if (msg.type === 'done') {
        appendLog(`Scraping job completed successfully! Found ${allLeads.length} leads.`, 'system');
        progressStatusText.textContent = 'Scraping completed!';
        progressBar.style.width = '100%';
        progressPercentage.textContent = '100%';
        setScrapingState(false);
        showToast(`Done! Collected ${allLeads.length} leads.`);
        eventSource.close();
      } else if (msg.type === 'error') {
        appendLog(`Scraper encountered an error: ${msg.data?.error || 'Unknown error'}`, 'error');
        setScrapingState(false);
        eventSource.close();
      }
    } catch (err) {
      console.error('Error parsing SSE message:', err);
    }
  };

  eventSource.onerror = (err) => {
    console.warn('SSE stream closed or interrupted');
  };
}

// Set UI state during scraping
function setScrapingState(isScraping) {
  if (isScraping) {
    startBtn.disabled = true;
    btnSpinner.style.display = 'inline-block';
    startBtnText.textContent = 'Scraping in progress...';
    liveProgressContainer.classList.remove('hidden');
    systemStatusText.textContent = 'Scraper Running';
    progressStatusText.textContent = 'Collecting Google Maps listings...';
    progressBar.style.width = '0%';
    progressPercentage.textContent = '0%';
    progressFraction.textContent = '(0/0)';
  } else {
    startBtn.disabled = false;
    btnSpinner.style.display = 'none';
    startBtnText.textContent = 'Start Scraping Leads';
    systemStatusText.textContent = 'Engine Ready';
  }
}

// Update KPI Metric Counters
function updateMetrics() {
  metricTotal.textContent = allLeads.length;
  
  const emailsCount = allLeads.filter(l => l.emails && l.emails.length > 0).length;
  metricEmails.textContent = emailsCount;

  const phonesCount = allLeads.filter(l => Boolean(l.phone)).length;
  metricPhones.textContent = phonesCount;

  const websitesCount = allLeads.filter(l => Boolean(l.website)).length;
  metricWebsites.textContent = websitesCount;

  const socialsCount = allLeads.filter(l => l.socials && Object.values(l.socials).some(Boolean)).length;
  metricSocials.textContent = socialsCount;

  tableCountBadge.textContent = `${allLeads.length} leads`;
}

function resetMetrics() {
  metricTotal.textContent = '0';
  metricEmails.textContent = '0';
  metricPhones.textContent = '0';
  metricWebsites.textContent = '0';
  metricSocials.textContent = '0';
  tableCountBadge.textContent = '0 leads';
}

// Render leads table
function renderLeadsTable() {
  leadsTableBody.innerHTML = '';

  const filtered = filterLeads(allLeads);

  if (filtered.length === 0) {
    leadsTableBody.innerHTML = `
      <tr class="empty-state-row">
        <td colspan="6">
          <div class="empty-state">
            <div class="empty-icon">📍</div>
            <h3>${allLeads.length === 0 ? 'No leads scraped yet' : 'No leads match your filter'}</h3>
            <p>${allLeads.length === 0 ? 'Enter a business keyword and location above to start scraping.' : 'Try changing your filter settings.'}</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  for (const lead of filtered) {
    appendLeadRow(lead);
  }
}

function renderSingleLead(lead) {
  // If empty state was showing, clear it
  if (leadsTableBody.querySelector('.empty-state-row')) {
    leadsTableBody.innerHTML = '';
  }

  if (matchesFilter(lead)) {
    appendLeadRow(lead);
  }
}

function appendLeadRow(lead) {
  const tr = document.createElement('tr');
  tr.id = `row_${lead.id}`;

  // Emails badges HTML
  let emailsHtml = '<span style="color: var(--text-dim); font-size: 0.8rem;">None found</span>';
  if (lead.emails && lead.emails.length > 0) {
    emailsHtml = `<div class="emails-list">` + 
      lead.emails.map(e => `
        <span class="email-chip" onclick="copyText('${e}')" title="Click to copy">
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          ${escapeHtml(e)}
        </span>
      `).join('') + `</div>`;
  }

  // Socials & Direct Outreach badges HTML
  const socials = lead.socials || {};
  const cleanPhoneDigits = lead.phone ? lead.phone.replace(/\D/g, '') : null;
  const waUrl = lead.whatsAppUrl || (cleanPhoneDigits && cleanPhoneDigits.length >= 10 ? `https://wa.me/1${cleanPhoneDigits}` : null);

  const igUrl = socials.instagram || `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(lead.name || '')}`;
  const fbUrl = socials.facebook || `https://www.facebook.com/search/pages/?q=${encodeURIComponent(lead.name || '')}`;
  const liUrl = socials.linkedin;

  let outreachHtml = `
    <div class="outreach-channels">
      <a href="${igUrl}" target="_blank" class="channel-btn btn-ig ${socials.instagram ? 'verified' : 'search'}" title="${socials.instagram ? 'Verified Instagram Profile' : 'Search on Instagram'}">
        📸 ${socials.instagram ? 'Instagram' : 'Find on IG'}
      </a>
      <a href="${fbUrl}" target="_blank" class="channel-btn btn-fb ${socials.facebook ? 'verified' : 'search'}" title="${socials.facebook ? 'Verified Facebook Page' : 'Search on Facebook'}">
        📘 ${socials.facebook ? 'Facebook' : 'Find on FB'}
      </a>
      ${liUrl ? `<a href="${liUrl}" target="_blank" class="channel-btn btn-li verified" title="LinkedIn">💼 LinkedIn</a>` : ''}
      <button id="btn_enrich_${lead.id}" class="channel-btn btn-enrich-more" onclick="deepEnrichLead('${lead.id}')" title="Search web for missing contact info">
        ⚡ Deep Search
      </button>
    </div>
  `;

  // Phone & WhatsApp HTML
  let phoneHtml = '<span style="color: var(--text-dim); font-size: 0.8rem;">No phone</span>';
  if (lead.phone) {
    phoneHtml = `
      <div class="phone-group">
        <a href="tel:${escapeHtml(lead.phone)}" class="phone-link">
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
          ${escapeHtml(lead.phone)}
        </a>
        ${waUrl ? `
          <a href="${waUrl}" target="_blank" class="badge-wa" title="Open direct WhatsApp conversation">
            💬 WhatsApp
          </a>
        ` : ''}
      </div>
    `;
  }

  // Website & Pitch Status HTML
  let websiteStatusHtml = '';
  if (lead.website) {
    let displayUrl = lead.website.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
    const audit = lead.websiteAudit || {};
    const isOutdated = audit.isOutdated;
    const score = audit.score !== undefined ? audit.score : 85;
    const issues = audit.issues || [];
    const tooltip = issues.length > 0 ? issues.join(' • ') : 'Website audited';

    if (isOutdated) {
      websiteStatusHtml = `
        <div class="website-cell">
          <a href="${lead.website}" target="_blank" class="website-link" title="${lead.website}">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
            ${escapeHtml(displayUrl)}
          </a>
          <div style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
            <span class="status-chip chip-outdated-web" title="${escapeHtml(tooltip)}">⚠️ OUTDATED</span>
            <span class="audit-score-pill score-warning" title="Modernity Score: ${score}/100">${score}/100</span>
          </div>
          <span class="pitch-hint pitch-redesign-hint" title="${escapeHtml(tooltip)}">
            💡 ${escapeHtml(issues[0] || 'Needs modern redesign')}
          </span>
        </div>
      `;
    } else {
      websiteStatusHtml = `
        <div class="website-cell">
          <a href="${lead.website}" target="_blank" class="website-link" title="${lead.website}">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
            ${escapeHtml(displayUrl)}
          </a>
          <div style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
            <span class="status-chip chip-modern-web" title="${escapeHtml(tooltip)}">✅ Modern Website</span>
            <span class="audit-score-pill score-good" title="Modernity Score: ${score}/100">${score}/100</span>
          </div>
        </div>
      `;
    }
  } else {
    websiteStatusHtml = `
      <div class="no-web-pitch-cell">
        <span class="status-chip chip-no-web">🔥 NO WEBSITE</span>
        <span class="pitch-hint">Top target to sell a website!</span>
      </div>
    `;
  }

  // Rating HTML
  let ratingHtml = '<span style="color: var(--text-dim); font-size: 0.8rem;">No rating</span>';
  if (lead.rating) {
    ratingHtml = `
      <div class="rating-badge">
        ⭐ ${lead.rating} ${lead.reviews ? `<small style="opacity: 0.8;">(${lead.reviews})</small>` : ''}
      </div>
    `;
  }

  tr.innerHTML = `
    <td>
      <div class="business-cell">
        <span class="business-name">${escapeHtml(lead.name || 'Unnamed Place')}</span>
        ${lead.address ? `<span class="address-subtext">${escapeHtml(lead.address)}</span>` : ''}
        ${lead.googleMapsUrl ? `
          <a href="${lead.googleMapsUrl}" target="_blank" class="business-gmaps-link">
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
            View on Google Maps
          </a>
        ` : ''}
      </div>
    </td>
    <td>
      <div class="rating-group">
        ${ratingHtml}
        <span class="category-text">${escapeHtml(lead.category || 'Local Business')}</span>
      </div>
    </td>
    <td>${phoneHtml}</td>
    <td>${emailsHtml}</td>
    <td>${outreachHtml}</td>
    <td>${websiteStatusHtml}</td>
  `;

  leadsTableBody.prepend(tr);
}

// Filtering
function filterLeads(leads) {
  const query = tableFilterInput.value.toLowerCase().trim();

  return leads.filter(lead => {
    // Text search
    if (query) {
      const matchName = (lead.name || '').toLowerCase().includes(query);
      const matchAddress = (lead.address || '').toLowerCase().includes(query);
      const matchPhone = (lead.phone || '').toLowerCase().includes(query);
      const matchCategory = (lead.category || '').toLowerCase().includes(query);
      if (!matchName && !matchAddress && !matchPhone && !matchCategory) return false;
    }

    // Category / Tag chips
    if (activeFilter === 'hasEmail') {
      return lead.emails && lead.emails.length > 0;
    } else if (activeFilter === 'hasPhone') {
      return Boolean(lead.phone);
    } else if (activeFilter === 'hasInstagram') {
      return lead.socials && Boolean(lead.socials.instagram);
    } else if (activeFilter === 'hasFacebook') {
      return lead.socials && Boolean(lead.socials.facebook);
    } else if (activeFilter === 'noWebsite') {
      return !lead.website;
    } else if (activeFilter === 'outdatedWebsite') {
      return lead.website && lead.websiteAudit?.isOutdated;
    } else if (activeFilter === 'modernWebsite') {
      return lead.website && !lead.websiteAudit?.isOutdated;
    }

    return true;
  });
}

function matchesFilter(lead) {
  const query = tableFilterInput.value.toLowerCase().trim();
  if (query) {
    const matchName = (lead.name || '').toLowerCase().includes(query);
    const matchAddress = (lead.address || '').toLowerCase().includes(query);
    const matchPhone = (lead.phone || '').toLowerCase().includes(query);
    const matchCategory = (lead.category || '').toLowerCase().includes(query);
    if (!matchName && !matchAddress && !matchPhone && !matchCategory) return false;
  }

  if (activeFilter === 'hasEmail') return lead.emails && lead.emails.length > 0;
  if (activeFilter === 'hasPhone') return Boolean(lead.phone);
  if (activeFilter === 'hasInstagram') return lead.socials && Boolean(lead.socials.instagram);
  if (activeFilter === 'hasFacebook') return lead.socials && Boolean(lead.socials.facebook);
  if (activeFilter === 'noWebsite') return !lead.website;
  if (activeFilter === 'outdatedWebsite') return lead.website && lead.websiteAudit?.isOutdated;
  if (activeFilter === 'modernWebsite') return lead.website && !lead.websiteAudit?.isOutdated;

  return true;
}

// On-demand Deep Social and Email Search for a single lead
window.deepEnrichLead = async function(leadId) {
  const lead = allLeads.find(l => l.id === leadId);
  if (!lead) return;

  const btn = document.getElementById(`btn_enrich_${leadId}`);
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Searching...';
  }

  try {
    const cityVal = document.getElementById('cityInput').value.trim();
    const res = await fetch('/api/leads/enrich-socials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: lead.name,
        location: lead.address || cityVal,
        website: lead.website
      })
    });
    const enriched = await res.json();
    if (enriched) {
      if (enriched.emails && enriched.emails.length > 0) {
        lead.emails = Array.from(new Set([...(lead.emails || []), ...enriched.emails]));
      }
      if (enriched.socials) {
        lead.socials = { ...(lead.socials || {}), ...enriched.socials };
      }
      if (!lead.website && enriched.website) {
        lead.website = enriched.website;
      }
      if (enriched.whatsAppUrl) {
        lead.whatsAppUrl = enriched.whatsAppUrl;
      }
      showToast(`Updated contact & socials for ${lead.name}!`);
      renderLeadsTable();
      updateMetrics();
    }
  } catch (err) {
    alert('Search error: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '⚡ Deep Search';
    }
  }
};

// Preset Niche Tags Handler
document.querySelectorAll('.preset-tag').forEach(tag => {
  tag.addEventListener('click', () => {
    document.getElementById('queryInput').value = tag.dataset.niche;
    document.getElementById('cityInput').value = tag.dataset.loc;
    showToast(`Loaded preset: ${tag.dataset.niche} in ${tag.dataset.loc}`);
  });
});

tableFilterInput.addEventListener('input', () => {
  renderLeadsTable();
});

filterChips.forEach(chip => {
  chip.addEventListener('click', () => {
    filterChips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeFilter = chip.getAttribute('data-filter');
    renderLeadsTable();
  });
});

// Excel (.xlsx) Export
if (exportXlsxBtn) {
  exportXlsxBtn.addEventListener('click', () => {
    if (!currentJobId) {
      showToast('No active job to export.');
      return;
    }
    window.location.href = `/api/jobs/${currentJobId}/export.xlsx`;
    showToast('Downloading formatted Excel spreadsheet (.xlsx)...');
  });
}

// CSV Export
exportCsvBtn.addEventListener('click', () => {
  if (!currentJobId) {
    showToast('No active job to export.');
    return;
  }
  window.location.href = `/api/jobs/${currentJobId}/export.csv`;
  showToast('Downloading clean CSV lead list...');
});

// JSON Export
exportJsonBtn.addEventListener('click', () => {
  if (!currentJobId) {
    showToast('No active job to export.');
    return;
  }
  window.location.href = `/api/jobs/${currentJobId}/export.json`;
  showToast('Downloading JSON lead list...');
});

// Copy all discovered emails
copyEmailsBtn.addEventListener('click', () => {
  const allEmails = [];
  allLeads.forEach(l => {
    if (l.emails) allEmails.push(...l.emails);
  });

  const unique = Array.from(new Set(allEmails));
  if (unique.length === 0) {
    showToast('No emails discovered yet to copy.');
    return;
  }

  navigator.clipboard.writeText(unique.join('\n'));
  showToast(`Copied ${unique.length} email(s) to clipboard!`);
});

// Append to Terminal Logs
function appendLog(text, level = 'info') {
  const line = document.createElement('div');
  line.className = `log-line ${level}`;
  line.textContent = text;
  terminalLogs.appendChild(line);
  terminalLogs.scrollTop = terminalLogs.scrollHeight;
}

clearLogsBtn.addEventListener('click', () => {
  terminalLogs.innerHTML = '';
});

// Batch Modal Handlers
batchModalBtn.addEventListener('click', () => {
  batchModal.classList.remove('hidden');
});
batchModalClose.addEventListener('click', () => {
  batchModal.classList.add('hidden');
});
batchCancelBtn.addEventListener('click', () => {
  batchModal.classList.add('hidden');
});

batchStartBtn.addEventListener('click', async () => {
  const city = batchCityInput.value.trim();
  const rawKeywords = batchKeywords.value.trim();
  const limit = parseInt(batchLimit.value, 10);

  if (!rawKeywords) {
    showToast('Please enter at least one keyword.');
    return;
  }

  const queries = rawKeywords.split('\n').map(s => s.trim()).filter(Boolean);
  if (queries.length === 0) return;

  batchModal.classList.add('hidden');
  appendLog(`Starting batch run with ${queries.length} keywords in ${city}...`);

  try {
    const res = await fetch('/api/jobs/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries,
        city,
        maxResults: limit,
        enrich: true
      })
    });
    const data = await res.json();
    if (data.jobIds && data.jobIds.length > 0) {
      currentJobId = data.jobIds[0];
      setScrapingState(true);
      connectToJobStream(currentJobId);
      showToast(`Batch started (${queries.length} search queries queued)!`);
    }
  } catch (err) {
    showToast(`Batch launch error: ${err.message}`);
  }
});

// Helpers
window.copyText = function(text) {
  navigator.clipboard.writeText(text);
  showToast(`Copied: ${text}`);
};

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================
// 🚀 AUTO-OUTREACH BOT (EMAIL & INSTAGRAM)
// ==========================================
const outreachModalBtn = document.getElementById('outreachModalBtn');
const outreachModal = document.getElementById('outreachModal');
const outreachModalClose = document.getElementById('outreachModalClose');
const btnCancelEmail = document.getElementById('btnCancelEmail');
const btnCancelIg = document.getElementById('btnCancelIg');
const outreachTabs = document.querySelectorAll('.outreach-tab-btn');
const outreachTabContents = document.querySelectorAll('.outreach-tab-content');

// Email Elements
const smtpProvider = document.getElementById('smtpProvider');
const customSmtpFields = document.getElementById('customSmtpFields');
const smtpSenderName = document.getElementById('smtpSenderName');
const smtpUser = document.getElementById('smtpUser');
const smtpPass = document.getElementById('smtpPass');
const smtpHost = document.getElementById('smtpHost');
const smtpPort = document.getElementById('smtpPort');
const testEmailInput = document.getElementById('testEmailInput');
const btnTestEmail = document.getElementById('btnTestEmail');

const emailAudienceSelect = document.getElementById('emailAudienceSelect');
const emailSubject = document.getElementById('emailSubject');
const emailBody = document.getElementById('emailBody');
const emailSubjectRedesign = document.getElementById('emailSubjectRedesign');
const emailBodyRedesign = document.getElementById('emailBodyRedesign');
const btnPitchEmailNoWeb = document.getElementById('btnPitchEmailNoWeb');
const btnPitchEmailRedesign = document.getElementById('btnPitchEmailRedesign');
const emailPitchNoWebGroup = document.getElementById('emailPitchNoWebGroup');
const emailPitchRedesignGroup = document.getElementById('emailPitchRedesignGroup');

const emailDelaySelect = document.getElementById('emailDelaySelect');
const btnLaunchEmail = document.getElementById('btnLaunchEmail');
const emailTargetCount = document.getElementById('emailTargetCount');

// Instagram Elements
const igUsername = document.getElementById('igUsername');
const igPassword = document.getElementById('igPassword');
const igDelaySelect = document.getElementById('igDelaySelect');
const igHeadlessToggle = document.getElementById('igHeadlessToggle');

const igAudienceSelect = document.getElementById('igAudienceSelect');
const igMessageBody = document.getElementById('igMessageBody');
const igMessageBodyRedesign = document.getElementById('igMessageBodyRedesign');
const btnPitchIgNoWeb = document.getElementById('btnPitchIgNoWeb');
const btnPitchIgRedesign = document.getElementById('btnPitchIgRedesign');
const igPitchNoWebGroup = document.getElementById('igPitchNoWebGroup');
const igPitchRedesignGroup = document.getElementById('igPitchRedesignGroup');

const btnLaunchIg = document.getElementById('btnLaunchIg');
const igTargetCount = document.getElementById('igTargetCount');

// Activity & Monitoring Elements
const activityPulse = document.getElementById('activityPulse');
const activityStatusText = document.getElementById('activityStatusText');
const outreachProgressBar = document.getElementById('outreachProgressBar');
const outreachSentCount = document.getElementById('outreachSentCount');
const outreachFailedCount = document.getElementById('outreachFailedCount');
const outreachTotalCount = document.getElementById('outreachTotalCount');
const outreachTerminal = document.getElementById('outreachTerminal');

let outreachPollInterval = null;

// Open Outreach Hub
if (outreachModalBtn) {
  outreachModalBtn.addEventListener('click', () => {
    updateOutreachTargetCounts();
    outreachModal.classList.remove('hidden');
  });
}

// Close Outreach Hub
[outreachModalClose, btnCancelEmail, btnCancelIg].forEach(btn => {
  if (btn) {
    btn.addEventListener('click', () => {
      outreachModal.classList.add('hidden');
    });
  }
});

// Tab Switcher
outreachTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    outreachTabs.forEach(t => t.classList.remove('active'));
    outreachTabContents.forEach(c => c.classList.add('hidden'));

    tab.classList.add('active');
    const targetId = tab.dataset.tab;
    const targetContent = document.getElementById(targetId);
    if (targetContent) targetContent.classList.remove('hidden');
  });
});

// Toggle Custom SMTP
if (smtpProvider) {
  smtpProvider.addEventListener('change', () => {
    if (smtpProvider.value === 'custom') {
      customSmtpFields.classList.remove('hidden');
    } else {
      customSmtpFields.classList.add('hidden');
    }
  });
}

// Pitch Subtab Switching: Email
if (btnPitchEmailNoWeb && btnPitchEmailRedesign) {
  btnPitchEmailNoWeb.addEventListener('click', () => {
    btnPitchEmailNoWeb.style.background = 'var(--primary)';
    btnPitchEmailNoWeb.style.color = '#fff';
    btnPitchEmailRedesign.style.background = 'transparent';
    btnPitchEmailRedesign.style.color = 'var(--text-muted)';
    emailPitchNoWebGroup.classList.remove('hidden');
    emailPitchRedesignGroup.classList.add('hidden');
  });

  btnPitchEmailRedesign.addEventListener('click', () => {
    btnPitchEmailRedesign.style.background = 'var(--primary)';
    btnPitchEmailRedesign.style.color = '#fff';
    btnPitchEmailNoWeb.style.background = 'transparent';
    btnPitchEmailNoWeb.style.color = 'var(--text-muted)';
    emailPitchRedesignGroup.classList.remove('hidden');
    emailPitchNoWebGroup.classList.add('hidden');
  });
}

// Pitch Subtab Switching: Instagram
if (btnPitchIgNoWeb && btnPitchIgRedesign) {
  btnPitchIgNoWeb.addEventListener('click', () => {
    btnPitchIgNoWeb.style.background = 'var(--primary)';
    btnPitchIgNoWeb.style.color = '#fff';
    btnPitchIgRedesign.style.background = 'transparent';
    btnPitchIgRedesign.style.color = 'var(--text-muted)';
    igPitchNoWebGroup.classList.remove('hidden');
    igPitchRedesignGroup.classList.add('hidden');
  });

  btnPitchIgRedesign.addEventListener('click', () => {
    btnPitchIgRedesign.style.background = 'var(--primary)';
    btnPitchIgRedesign.style.color = '#fff';
    btnPitchIgNoWeb.style.background = 'transparent';
    btnPitchIgNoWeb.style.color = 'var(--text-muted)';
    igPitchRedesignGroup.classList.remove('hidden');
    igPitchNoWebGroup.classList.add('hidden');
  });
}

// Variable Pills Helper
document.querySelectorAll('.var-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    insertAtCursor(emailBody, pill.dataset.var);
  });
});

document.querySelectorAll('.var-pill-redesign').forEach(pill => {
  pill.addEventListener('click', () => {
    if (emailBodyRedesign) insertAtCursor(emailBodyRedesign, pill.dataset.var);
  });
});

document.querySelectorAll('.var-pill-ig').forEach(pill => {
  pill.addEventListener('click', () => {
    insertAtCursor(igMessageBody, pill.dataset.var);
  });
});

document.querySelectorAll('.var-pill-ig-redesign').forEach(pill => {
  pill.addEventListener('click', () => {
    if (igMessageBodyRedesign) insertAtCursor(igMessageBodyRedesign, pill.dataset.var);
  });
});

function insertAtCursor(textarea, text) {
  const start = textarea.selectionStart || textarea.value.length;
  const end = textarea.selectionEnd || textarea.value.length;
  textarea.value = textarea.value.substring(0, start) + text + textarea.value.substring(end);
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = start + text.length;
}

function getFilteredEmailLeads() {
  const mode = emailAudienceSelect ? emailAudienceSelect.value : 'all';
  return allLeads.filter(l => {
    if (!l.emails || l.emails.length === 0) return false;
    if (mode === 'no_website') return !l.website;
    if (mode === 'outdated_website') return l.website && l.websiteAudit?.isOutdated;
    if (mode === 'has_website') return Boolean(l.website);
    return true; // 'all'
  });
}

function getFilteredIgLeads() {
  const mode = igAudienceSelect ? igAudienceSelect.value : 'all';
  return allLeads.filter(l => {
    if (!l.socials || !l.socials.instagram) return false;
    if (mode === 'no_website') return !l.website;
    if (mode === 'outdated_website') return l.website && l.websiteAudit?.isOutdated;
    if (mode === 'has_website') return Boolean(l.website);
    return true; // 'all'
  });
}

function updateOutreachTargetCounts() {
  const emailLeads = getFilteredEmailLeads();
  const igLeads = getFilteredIgLeads();

  if (emailTargetCount) emailTargetCount.textContent = `${emailLeads.length} leads selected`;
  if (igTargetCount) igTargetCount.textContent = `${igLeads.length} leads selected`;
}

if (emailAudienceSelect) {
  emailAudienceSelect.addEventListener('change', updateOutreachTargetCounts);
}
if (igAudienceSelect) {
  igAudienceSelect.addEventListener('change', updateOutreachTargetCounts);
}

// Test Email Send
if (btnTestEmail) {
  btnTestEmail.addEventListener('click', async () => {
    const user = smtpUser.value.trim();
    const pass = smtpPass.value.trim();
    const testTo = testEmailInput.value.trim();

    if (!user || !pass) {
      showToast('Please enter your email and App Password.');
      return;
    }

    btnTestEmail.disabled = true;
    btnTestEmail.textContent = 'Testing...';

    try {
      const res = await fetch('/api/outreach/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            provider: smtpProvider.value,
            user,
            pass,
            host: smtpHost.value.trim(),
            port: smtpPort.value.trim(),
            senderName: smtpSenderName.value.trim()
          },
          testEmail: testTo || null
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Connection failed');
      showToast(data.message || 'Credentials verified successfully!');
    } catch (err) {
      alert('SMTP Error: ' + err.message);
    } finally {
      btnTestEmail.disabled = false;
      btnTestEmail.textContent = 'Test Send';
    }
  });
}

// Launch Email Campaign
if (btnLaunchEmail) {
  btnLaunchEmail.addEventListener('click', async () => {
    const user = smtpUser.value.trim();
    const pass = smtpPass.value.trim();
    const emailLeads = getFilteredEmailLeads();

    if (emailLeads.length === 0) {
      showToast('No matching leads found for the selected audience. Adjust your audience or scrape leads first!');
      return;
    }

    if (!user || !pass) {
      showToast('Please enter your sender email and App Password.');
      return;
    }

    btnLaunchEmail.disabled = true;

    try {
      const res = await fetch('/api/outreach/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads: emailLeads,
          config: {
            provider: smtpProvider.value,
            user,
            pass,
            host: smtpHost.value.trim(),
            port: smtpPort.value.trim(),
            senderName: smtpSenderName.value.trim()
          },
          subjectTemplate: emailSubject.value,
          bodyTemplate: emailBody.value,
          subjectTemplateRedesign: emailSubjectRedesign ? emailSubjectRedesign.value : emailSubject.value,
          bodyTemplateRedesign: emailBodyRedesign ? emailBodyRedesign.value : emailBody.value,
          delaySeconds: parseInt(emailDelaySelect.value, 10)
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start campaign');

      showToast(`Email campaign launched for ${emailLeads.length} leads!`);
      // Switch to Activity tab
      document.querySelector('[data-tab="tab-activity"]').click();
      startOutreachPolling();
    } catch (err) {
      alert('Launch error: ' + err.message);
    } finally {
      btnLaunchEmail.disabled = false;
    }
  });
}

// Launch Instagram DM Campaign
if (btnLaunchIg) {
  btnLaunchIg.addEventListener('click', async () => {
    const igLeads = getFilteredIgLeads();

    if (igLeads.length === 0) {
      showToast('No matching leads with Instagram found for selected audience.');
      return;
    }

    btnLaunchIg.disabled = true;

    try {
      const res = await fetch('/api/outreach/instagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads: igLeads,
          credentials: {
            username: igUsername.value.trim(),
            password: igPassword.value.trim()
          },
          messageTemplate: igMessageBody.value,
          messageTemplateRedesign: igMessageBodyRedesign ? igMessageBodyRedesign.value : igMessageBody.value,
          delaySeconds: parseInt(igDelaySelect.value, 10),
          headless: igHeadlessToggle.checked
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start Instagram bot');

      showToast(`Instagram bot launched for ${igLeads.length} profile(s)!`);
      document.querySelector('[data-tab="tab-activity"]').click();
      startOutreachPolling();
    } catch (err) {
      alert('Launch error: ' + err.message);
    } finally {
      btnLaunchIg.disabled = false;
    }
  });
}

// Poll Outreach Status & Logs
function startOutreachPolling() {
  if (outreachPollInterval) clearInterval(outreachPollInterval);

  outreachPollInterval = setInterval(async () => {
    try {
      const res = await fetch('/api/outreach/status');
      const data = await res.json();

      if (data) {
        activityStatusText.textContent = data.running 
          ? `Outreach Bot Active (${data.type.toUpperCase()})` 
          : 'Outreach Bot Completed / Idle';
        
        if (data.running) {
          activityPulse.classList.add('active');
        } else {
          activityPulse.classList.remove('active');
        }

        outreachSentCount.textContent = data.sent || 0;
        outreachFailedCount.textContent = data.failed || 0;
        outreachTotalCount.textContent = data.total || 0;

        const percent = data.total > 0 ? Math.round((data.current / data.total) * 100) : 0;
        outreachProgressBar.style.width = `${percent}%`;

        // Render logs
        if (data.logs && data.logs.length > 0) {
          outreachTerminal.innerHTML = data.logs.map(l => {
            const isSuccess = l.includes('✅') || l.includes('Delivered') || l.includes('successfully');
            const isError = l.includes('❌') || l.includes('Error') || l.includes('Failed');
            const cls = isSuccess ? 'success' : isError ? 'error' : 'system';
            return `<div class="log-line ${cls}">${escapeHtml(l)}</div>`;
          }).join('');
          outreachTerminal.scrollTop = outreachTerminal.scrollHeight;
        }

        if (!data.running && percent === 100) {
          clearInterval(outreachPollInterval);
        }
      }
    } catch (_) {}
  }, 2000);
}

// ==========================================
// 🤖 24/7 HOURLY AUTOPILOT CONTROLS
// ==========================================
const btnToggleAutopilot = document.getElementById('btnToggleAutopilot');
const btnRunNowAutopilot = document.getElementById('btnRunNowAutopilot');
const apAppPassInput = document.getElementById('apAppPassInput');
const apIntervalSelect = document.getElementById('apIntervalSelect');
const apSenderEmail = document.getElementById('apSenderEmail');
const autopilotPulse = document.getElementById('autopilotPulse');
const autopilotStatusText = document.getElementById('autopilotStatusText');
const autopilotTotalSent = document.getElementById('autopilotTotalSent');
const apNextTarget = document.getElementById('apNextTarget');
const apNextRunCountdown = document.getElementById('apNextRunCountdown');
const autopilotTerminal = document.getElementById('autopilotTerminal');

let autopilotPollingInterval = null;

async function fetchAutopilotState() {
  try {
    const res = await fetch('/api/autopilot/status');
    const data = await res.json();
    if (!data) return;

    if (autopilotStatusText) {
      if (data.isRunningCycle) {
        autopilotStatusText.textContent = '🚀 Scraping & Sending Batch (Active)...';
        if (autopilotPulse) autopilotPulse.classList.add('active');
      } else if (data.enabled) {
        autopilotStatusText.textContent = '🟢 Autopilot Active (Running Every Hour)';
        if (autopilotPulse) autopilotPulse.classList.add('active');
      } else {
        autopilotStatusText.textContent = '⏸️ Autopilot Standby';
        if (autopilotPulse) autopilotPulse.classList.remove('active');
      }
    }

    if (btnToggleAutopilot) {
      if (data.enabled) {
        btnToggleAutopilot.textContent = '⏹️ Pause 24/7 Autopilot';
        btnToggleAutopilot.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
      } else {
        btnToggleAutopilot.textContent = '▶️ Start 24/7 Autopilot';
        btnToggleAutopilot.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      }
    }

    if (autopilotTotalSent) autopilotTotalSent.textContent = data.totalSentCount || 0;
    if (apNextTarget && data.currentTarget) {
      apNextTarget.textContent = `${data.currentTarget.niche} in ${data.currentTarget.city}`;
    }

    if (apNextRunCountdown) {
      if (data.nextRunTime && data.enabled) {
        const diffMs = new Date(data.nextRunTime).getTime() - Date.now();
        const mins = Math.max(0, Math.ceil(diffMs / 60000));
        apNextRunCountdown.textContent = `Next cycle scheduled: in ${mins} minute(s) (${new Date(data.nextRunTime).toLocaleTimeString()})`;
      } else {
        apNextRunCountdown.textContent = data.enabled ? 'Scheduling next cycle...' : 'Autopilot is paused. Click Start to begin.';
      }
    }

    // Render Autopilot logs
    if (autopilotTerminal && data.logs && data.logs.length > 0) {
      autopilotTerminal.innerHTML = data.logs.map(l => {
        const isSuccess = l.includes('✅') || l.includes('Delivered') || l.includes('Complete') || l.includes('verified');
        const isError = l.includes('❌') || l.includes('Warning') || l.includes('Failed') || l.includes('Error');
        const cls = isSuccess ? 'success' : isError ? 'error' : 'system';
        return `<div class="log-line ${cls}">${escapeHtml(l)}</div>`;
      }).join('');
      autopilotTerminal.scrollTop = autopilotTerminal.scrollHeight;
    }
  } catch (_) {}
}

if (btnToggleAutopilot) {
  btnToggleAutopilot.addEventListener('click', async () => {
    btnToggleAutopilot.disabled = true;
    try {
      const resStatus = await fetch('/api/autopilot/status');
      const curStatus = await resStatus.json();
      const newEnabled = !curStatus.enabled;

      const res = await fetch('/api/autopilot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: newEnabled,
          emailPass: apAppPassInput.value.trim(),
          intervalMinutes: parseInt(apIntervalSelect.value, 10)
        })
      });

      const updated = await res.json();
      showToast(newEnabled ? 'Autopilot started! It will run every hour in the background.' : 'Autopilot paused.');
      fetchAutopilotState();
    } catch (err) {
      alert('Error updating autopilot: ' + err.message);
    } finally {
      btnToggleAutopilot.disabled = false;
    }
  });
}

if (btnRunNowAutopilot) {
  btnRunNowAutopilot.addEventListener('click', async () => {
    btnRunNowAutopilot.disabled = true;
    btnRunNowAutopilot.textContent = 'Starting...';

    try {
      // First save the current password
      await fetch('/api/autopilot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailPass: apAppPassInput.value.trim(),
          intervalMinutes: parseInt(apIntervalSelect.value, 10)
        })
      });

      const res = await fetch('/api/autopilot/run-now', { method: 'POST' });
      const data = await res.json();
      showToast('🚀 Immediate Autopilot Batch Started! Check logs below.');
      fetchAutopilotState();
    } catch (err) {
      alert('Error starting immediate run: ' + err.message);
    } finally {
      btnRunNowAutopilot.disabled = false;
      btnRunNowAutopilot.textContent = '🚀 Run 1 Batch Now (30 Leads)';
    }
  });
}

// Start continuous background polling for Autopilot tab
setInterval(fetchAutopilotState, 4000);
fetchAutopilotState();


// ==================== 2-DAY CLIENT FOLLOW-UP PIPELINE LOGIC ====================
const followupsModalBtn = document.getElementById('followupsModalBtn');
const followupTableBody = document.getElementById('followupTableBody');
const followupSearchInput = document.getElementById('followupSearchInput');
const followupFilterSelect = document.getElementById('followupFilterSelect');
const btnRefreshFollowups = document.getElementById('btnRefreshFollowups');
const btnCopyFollowupTemplate = document.getElementById('btnCopyFollowupTemplate');
const followupTemplateText = document.getElementById('followupTemplateText');
const followupTotalBadge = document.getElementById('followupTotalBadge');
const statMessagedToday = document.getElementById('statMessagedToday');

let allFollowupClients = [];

// Header button to open Follow-Ups directly
if (followupsModalBtn) {
  followupsModalBtn.addEventListener('click', () => {
    outreachModal.classList.remove('hidden');
    // Switch to tab-followups
    document.querySelectorAll('.outreach-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.outreach-tab-content').forEach(c => c.classList.remove('active'));
    
    const targetTabBtn = document.querySelector('.outreach-tab-btn[data-tab="tab-followups"]');
    const targetTabContent = document.getElementById('tab-followups');
    if (targetTabBtn) targetTabBtn.classList.add('active');
    if (targetTabContent) targetTabContent.classList.add('active');

    fetchFollowups();
  });
}

// Copy master template
if (btnCopyFollowupTemplate && followupTemplateText) {
  btnCopyFollowupTemplate.addEventListener('click', () => {
    navigator.clipboard.writeText(followupTemplateText.value);
    showToast('📋 2-Day Follow-Up template copied to clipboard!');
  });
}

// Refresh button
if (btnRefreshFollowups) {
  btnRefreshFollowups.addEventListener('click', fetchFollowups);
}

// Search & Filter
if (followupSearchInput) {
  followupSearchInput.addEventListener('input', renderFollowupRows);
}
if (followupFilterSelect) {
  followupFilterSelect.addEventListener('change', renderFollowupRows);
}

async function fetchFollowups() {
  if (!followupTableBody) return;
  try {
    const res = await fetch('/api/followups');
    const data = await res.json();
    allFollowupClients = data.list || [];

    if (followupTotalBadge) followupTotalBadge.textContent = `${allFollowupClients.length} Clients`;
    if (statMessagedToday) statMessagedToday.textContent = allFollowupClients.length;
    if (followupsModalBtn) followupsModalBtn.textContent = `📁 Follow-Up Tracker (${allFollowupClients.length})`;

    renderFollowupRows();
  } catch (err) {
    console.error('Error fetching followups:', err);
    followupTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #ef4444; padding: 1.5rem;">Failed to load follow-up records.</td></tr>';
  }
}

function renderFollowupRows() {
  if (!followupTableBody) return;
  const query = (followupSearchInput ? followupSearchInput.value : '').toLowerCase().trim();
  const filter = followupFilterSelect ? followupFilterSelect.value : 'all';

  let filtered = allFollowupClients.filter(item => {
    // Search filter
    const matchesQuery = !query || 
      (item.name && item.name.toLowerCase().includes(query)) ||
      (item.email && item.email.toLowerCase().includes(query)) ||
      (item.city && item.city.toLowerCase().includes(query)) ||
      (item.category && item.category.toLowerCase().includes(query));

    if (!matchesQuery) return false;

    // Dropdown filter
    if (filter === 'Miami') return (item.city || '').includes('Miami');
    if (filter === 'Austin') return (item.city || '').includes('Austin');
    if (filter === 'Los Angeles') return (item.city || '').includes('Los Angeles');
    if (filter === 'pending') return !(item.status || '').startsWith('Followed');
    if (filter === 'followed') return (item.status || '').startsWith('Followed');

    return true;
  });

  if (filtered.length === 0) {
    followupTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No client follow-ups match this filter.</td></tr>';
    return;
  }

  followupTableBody.innerHTML = filtered.map((c, idx) => {
    const isFollowed = (c.status || '').startsWith('Followed Up');
    const isWon = c.status === 'Won / Converted';
    
    let badgeColor = '#3b82f6';
    let badgeBg = 'rgba(59, 130, 246, 0.15)';
    if (isFollowed) {
      badgeColor = '#10b981';
      badgeBg = 'rgba(16, 185, 129, 0.15)';
    } else if (isWon) {
      badgeColor = '#f59e0b';
      badgeBg = 'rgba(245, 158, 11, 0.15)';
    }

    return `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
        <td style="padding: 0.6rem 0.75rem; color: var(--text-dim); font-size: 0.72rem;">${idx + 1}</td>
        <td style="padding: 0.6rem 0.75rem;">
          <div style="font-weight: 600; color: #fff; font-size: 0.82rem;">${escapeHtml(c.name)}</div>
          <div style="font-size: 0.7rem; color: var(--text-muted); display: flex; gap: 0.35rem; align-items: center; margin-top: 0.15rem;">
            <span>📍 ${escapeHtml(c.city || 'US')}</span> · 
            <span>🏷️ ${escapeHtml(c.category || 'Business')}</span>
          </div>
        </td>
        <td style="padding: 0.6rem 0.75rem; font-family: var(--font-mono); font-size: 0.75rem;">
          <a href="mailto:${encodeURIComponent(c.email)}" style="color: #60a5fa; text-decoration: none;">${escapeHtml(c.email)}</a>
        </td>
        <td style="padding: 0.6rem 0.75rem; color: var(--text-muted); font-size: 0.75rem;">${c.dateMessaged || '25 Sep'}</td>
        <td style="padding: 0.6rem 0.75rem; font-size: 0.75rem; font-weight: 600; color: #34d399;">
          <div>${c.followupDue || '27 Sep 2026'}</div>
          <div style="font-size: 0.68rem; color: var(--text-dim); font-weight: normal;">(Sunday in 2 Days)</div>
        </td>
        <td style="padding: 0.6rem 0.75rem;">
          <span style="display: inline-block; padding: 0.2rem 0.5rem; border-radius: 999px; font-size: 0.7rem; font-weight: 600; color: ${badgeColor}; background: ${badgeBg};">
            ${escapeHtml(c.status || 'Pending')}
          </span>
        </td>
        <td style="padding: 0.6rem 0.75rem; text-align: right; white-space: nowrap;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="sendFollowupNow('${c.id}', '${escapeHtml(c.name)}')" style="font-size: 0.7rem; padding: 0.25rem 0.55rem; background: rgba(59, 130, 246, 0.2); color: #93c5fd; border: 1px solid rgba(59,130,246,0.3); margin-right: 0.3rem;">
            ⚡ Send Follow-Up
          </button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="copyClientPitch('${c.id}')" title="Copy 2-Day Follow-Up Message" style="font-size: 0.7rem; padding: 0.25rem 0.45rem;">
            📋
          </button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="markClientWon('${c.id}')" title="Mark Won / Converted" style="font-size: 0.7rem; padding: 0.25rem 0.45rem; color: #34d399;">
            ✅
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

window.copyClientPitch = function(id) {
  const client = allFollowupClients.find(c => c.id === id);
  if (!client) return;
  const pitch = client.followupPitch || `Hi ${client.name} team! Just following up on my quick note from Thursday regarding the 45-second video preview for ${client.name}'s website. Would you still like me to send that 45-second demo over? Best, Aaravsinh (https://aaravsinh-rathod-portfolio-9.vercel.app/)`;
  navigator.clipboard.writeText(pitch);
  showToast(`📋 Follow-Up pitch for ${client.name} copied to clipboard!`);
};

window.sendFollowupNow = async function(id, name) {
  if (!confirm(`Send the 2-day follow-up message to ${name} via your Gmail now?`)) return;
  showToast(`Sending follow-up to ${name}...`);
  try {
    const res = await fetch('/api/followups/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`✅ Follow-up email delivered to ${name}!`);
      fetchFollowups();
    } else {
      alert('Failed: ' + (data.error || 'Unknown error'));
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

window.markClientWon = async function(id) {
  try {
    await fetch('/api/followups/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, updates: { status: 'Won / Converted' } })
    });
    showToast('🎉 Client marked as Won / Converted!');
    fetchFollowups();
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

// Initial load of followups
setTimeout(fetchFollowups, 1000);

// ==================== CLIENT REPLIES & HOT LEADS FRONTEND ====================
const repliesModalBtn = document.getElementById('repliesModalBtn');
const repliesContainer = document.getElementById('repliesContainer');
const btnScanInboxNow = document.getElementById('btnScanInboxNow');
const headerRepliesCount = document.getElementById('headerRepliesCount');
const tabRepliesCount = document.getElementById('tabRepliesCount');
const repliesBadgeCount = document.getElementById('repliesBadgeCount');
const statTotalReplies = document.getElementById('statTotalReplies');
const statWantsVideo = document.getElementById('statWantsVideo');

let allClientReplies = [];

if (repliesModalBtn) {
  repliesModalBtn.addEventListener('click', () => {
    outreachModal.classList.remove('hidden');
    document.querySelectorAll('.outreach-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.outreach-tab-content').forEach(c => c.classList.remove('active'));

    const targetTabBtn = document.querySelector('.outreach-tab-btn[data-tab="tab-replies"]');
    const targetTabContent = document.getElementById('tab-replies');
    if (targetTabBtn) targetTabBtn.classList.add('active');
    if (targetTabContent) targetTabContent.classList.add('active');

    fetchReplies();
  });
}

if (btnScanInboxNow) {
  btnScanInboxNow.addEventListener('click', scanRepliesNow);
}

window.scanRepliesNow = async function() {
  if (btnScanInboxNow) {
    btnScanInboxNow.disabled = true;
    btnScanInboxNow.textContent = '🔍 Checking Gmail...';
  }
  showToast('Connecting to your Gmail inbox via IMAP...');

  try {
    const res = await fetch('/api/replies/scan', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      if (data.newCount > 0) {
        showToast(`🔥 Found ${data.newCount} NEW client reply!`);
      } else {
        showToast('Inbox checked: No new client replies yet.');
      }
      fetchReplies();
    } else {
      alert('IMAP check error: ' + (data.error || 'Unknown error'));
    }
  } catch (err) {
    alert('Network error checking inbox: ' + err.message);
  } finally {
    if (btnScanInboxNow) {
      btnScanInboxNow.disabled = false;
      btnScanInboxNow.textContent = '🔍 Check Gmail Inbox Now';
    }
  }
};

async function fetchReplies() {
  if (!repliesContainer) return;
  try {
    const res = await fetch('/api/replies');
    const data = await res.json();
    allClientReplies = data.replies || [];

    const unreadCount = data.unreadCount || 0;
    if (headerRepliesCount) headerRepliesCount.textContent = unreadCount;
    if (tabRepliesCount) tabRepliesCount.textContent = unreadCount;
    if (repliesBadgeCount) repliesBadgeCount.textContent = `${unreadCount} New`;
    if (statTotalReplies) statTotalReplies.textContent = allClientReplies.length;

    const videoCount = allClientReplies.filter(r => (r.intent || '').includes('Video')).length;
    if (statWantsVideo) statWantsVideo.textContent = videoCount;

    renderRepliesFeed();
  } catch (err) {
    console.error('Error fetching replies:', err);
  }
}

function renderRepliesFeed() {
  if (!repliesContainer) return;

  if (allClientReplies.length === 0) {
    repliesContainer.innerHTML = `
      <div style="text-align: center; padding: 2.5rem 1rem; background: rgba(0,0,0,0.2); border: 1px dashed var(--border-color); border-radius: var(--radius-sm); color: var(--text-muted);">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">📬</div>
        <h5 style="margin: 0 0 0.35rem 0; font-size: 0.95rem; color: #fff;">No Client Replies Yet Today</h5>
        <p style="margin: 0; font-size: 0.78rem; max-width: 440px; margin: 0 auto;">
          Your 88 emails were sent out today. When clients write back to request the 45-second preview video or ask for pricing, their replies will automatically appear right here!
        </p>
        <button type="button" onclick="scanRepliesNow()" class="btn btn-secondary btn-sm" style="margin-top: 1rem; font-size: 0.75rem;">
          🔄 Check for New Replies Now
        </button>
      </div>
    `;
    return;
  }

  repliesContainer.innerHTML = allClientReplies.map(r => {
    const isWantsVideo = (r.intent || '').includes('Video');
    let borderColor = isWantsVideo ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255,255,255,0.08)';
    let badgeColor = isWantsVideo ? '#f59e0b' : '#60a5fa';

    return `
      <div style="background: rgba(255,255,255,0.02); border: 1px solid ${borderColor}; border-radius: var(--radius-sm); padding: 0.85rem 1rem; transition: transform 0.15s;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; flex-wrap: wrap;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <strong style="color: #fff; font-size: 0.9rem;">${escapeHtml(r.clientName)}</strong>
              <span style="font-size: 0.7rem; color: ${badgeColor}; background: rgba(245, 158, 11, 0.12); padding: 0.15rem 0.45rem; border-radius: 999px; font-weight: 700;">
                ${escapeHtml(r.badge || 'Reply')}
              </span>
            </div>
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.15rem;">
              <span>✉️ ${escapeHtml(r.senderEmail)}</span> · <span>📍 ${escapeHtml(r.city || 'US')}</span>
            </div>
          </div>
          <div style="font-size: 0.7rem; color: var(--text-dim);">
            ${escapeHtml(r.formattedDate || '')}
          </div>
        </div>

        <div style="margin-top: 0.5rem; padding: 0.6rem 0.75rem; background: rgba(0,0,0,0.3); border-radius: 4px; font-size: 0.8rem; color: var(--text-color); line-height: 1.4; border-left: 3px solid ${badgeColor};">
          <div style="font-size: 0.72rem; font-weight: 600; color: var(--text-muted); margin-bottom: 0.2rem;">Subject: ${escapeHtml(r.subject)}</div>
          ${escapeHtml(r.fullText || r.snippet)}
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.6rem;">
          <a href="mailto:${encodeURIComponent(r.senderEmail)}?subject=${encodeURIComponent('Re: ' + r.subject)}" class="btn btn-primary btn-sm" style="font-size: 0.72rem; padding: 0.25rem 0.65rem; background: linear-gradient(135deg, #f59e0b, #d97706); text-decoration: none; border: none; font-weight: 700;">
            ✉️ Reply from Gmail
          </a>
        </div>
      </div>
    `;
  }).join('');
}

// Check replies on start
setTimeout(fetchReplies, 1500);
// Check for new replies every 3 minutes in background
setInterval(fetchReplies, 180000);
