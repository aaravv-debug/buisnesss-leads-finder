const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'public', 'app.js');
let appJs = fs.readFileSync(appJsPath, 'utf8');

const followupsLogic = `
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

    if (followupTotalBadge) followupTotalBadge.textContent = \`\${allFollowupClients.length} Clients\`;
    if (statMessagedToday) statMessagedToday.textContent = allFollowupClients.length;
    if (followupsModalBtn) followupsModalBtn.textContent = \`📁 Follow-Up Tracker (\${allFollowupClients.length})\`;

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

    return \`
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
        <td style="padding: 0.6rem 0.75rem; color: var(--text-dim); font-size: 0.72rem;">\${idx + 1}</td>
        <td style="padding: 0.6rem 0.75rem;">
          <div style="font-weight: 600; color: #fff; font-size: 0.82rem;">\${escapeHtml(c.name)}</div>
          <div style="font-size: 0.7rem; color: var(--text-muted); display: flex; gap: 0.35rem; align-items: center; margin-top: 0.15rem;">
            <span>📍 \${escapeHtml(c.city || 'US')}</span> · 
            <span>🏷️ \${escapeHtml(c.category || 'Business')}</span>
          </div>
        </td>
        <td style="padding: 0.6rem 0.75rem; font-family: var(--font-mono); font-size: 0.75rem;">
          <a href="mailto:\${encodeURIComponent(c.email)}" style="color: #60a5fa; text-decoration: none;">\${escapeHtml(c.email)}</a>
        </td>
        <td style="padding: 0.6rem 0.75rem; color: var(--text-muted); font-size: 0.75rem;">\${c.dateMessaged || '25 Sep'}</td>
        <td style="padding: 0.6rem 0.75rem; font-size: 0.75rem; font-weight: 600; color: #34d399;">
          <div>\${c.followupDue || '27 Sep 2026'}</div>
          <div style="font-size: 0.68rem; color: var(--text-dim); font-weight: normal;">(Sunday in 2 Days)</div>
        </td>
        <td style="padding: 0.6rem 0.75rem;">
          <span style="display: inline-block; padding: 0.2rem 0.5rem; border-radius: 999px; font-size: 0.7rem; font-weight: 600; color: \${badgeColor}; background: \${badgeBg};">
            \${escapeHtml(c.status || 'Pending')}
          </span>
        </td>
        <td style="padding: 0.6rem 0.75rem; text-align: right; white-space: nowrap;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="sendFollowupNow('\${c.id}', '\${escapeHtml(c.name)}')" style="font-size: 0.7rem; padding: 0.25rem 0.55rem; background: rgba(59, 130, 246, 0.2); color: #93c5fd; border: 1px solid rgba(59,130,246,0.3); margin-right: 0.3rem;">
            ⚡ Send Follow-Up
          </button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="copyClientPitch('\${c.id}')" title="Copy 2-Day Follow-Up Message" style="font-size: 0.7rem; padding: 0.25rem 0.45rem;">
            📋
          </button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="markClientWon('\${c.id}')" title="Mark Won / Converted" style="font-size: 0.7rem; padding: 0.25rem 0.45rem; color: #34d399;">
            ✅
          </button>
        </td>
      </tr>
    \`;
  }).join('');
}

window.copyClientPitch = function(id) {
  const client = allFollowupClients.find(c => c.id === id);
  if (!client) return;
  const pitch = client.followupPitch || \`Hi \${client.name} team! Just following up on my quick note from Thursday regarding the 45-second video preview for \${client.name}'s website. Would you still like me to send that 45-second demo over? Best, Aaravsinh (https://aaravsinh-rathod-portfolio-9.vercel.app/)\`;
  navigator.clipboard.writeText(pitch);
  showToast(\`📋 Follow-Up pitch for \${client.name} copied to clipboard!\`);
};

window.sendFollowupNow = async function(id, name) {
  if (!confirm(\`Send the 2-day follow-up message to \${name} via your Gmail now?\`)) return;
  showToast(\`Sending follow-up to \${name}...\`);
  try {
    const res = await fetch('/api/followups/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (data.success) {
      showToast(\`✅ Follow-up email delivered to \${name}!\`);
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
`;

if (!appJs.includes('// ==================== 2-DAY CLIENT FOLLOW-UP PIPELINE LOGIC ====================')) {
  appJs += followupsLogic;
  fs.writeFileSync(appJsPath, appJs, 'utf8');
  console.log('app.js updated with followups frontend logic');
}
