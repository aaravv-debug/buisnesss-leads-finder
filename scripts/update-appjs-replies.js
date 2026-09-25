const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'public', 'app.js');
let appJs = fs.readFileSync(appJsPath, 'utf8');

const repliesFrontendLogic = `
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
        showToast(\`🔥 Found \${data.newCount} NEW client reply!\`);
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
    if (repliesBadgeCount) repliesBadgeCount.textContent = \`\${unreadCount} New\`;
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
    repliesContainer.innerHTML = \`
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
    \`;
    return;
  }

  repliesContainer.innerHTML = allClientReplies.map(r => {
    const isWantsVideo = (r.intent || '').includes('Video');
    let borderColor = isWantsVideo ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255,255,255,0.08)';
    let badgeColor = isWantsVideo ? '#f59e0b' : '#60a5fa';

    return \`
      <div style="background: rgba(255,255,255,0.02); border: 1px solid \${borderColor}; border-radius: var(--radius-sm); padding: 0.85rem 1rem; transition: transform 0.15s;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; flex-wrap: wrap;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <strong style="color: #fff; font-size: 0.9rem;">\${escapeHtml(r.clientName)}</strong>
              <span style="font-size: 0.7rem; color: \${badgeColor}; background: rgba(245, 158, 11, 0.12); padding: 0.15rem 0.45rem; border-radius: 999px; font-weight: 700;">
                \${escapeHtml(r.badge || 'Reply')}
              </span>
            </div>
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.15rem;">
              <span>✉️ \${escapeHtml(r.senderEmail)}</span> · <span>📍 \${escapeHtml(r.city || 'US')}</span>
            </div>
          </div>
          <div style="font-size: 0.7rem; color: var(--text-dim);">
            \${escapeHtml(r.formattedDate || '')}
          </div>
        </div>

        <div style="margin-top: 0.5rem; padding: 0.6rem 0.75rem; background: rgba(0,0,0,0.3); border-radius: 4px; font-size: 0.8rem; color: var(--text-color); line-height: 1.4; border-left: 3px solid \${badgeColor};">
          <div style="font-size: 0.72rem; font-weight: 600; color: var(--text-muted); margin-bottom: 0.2rem;">Subject: \${escapeHtml(r.subject)}</div>
          \${escapeHtml(r.fullText || r.snippet)}
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.6rem;">
          <a href="mailto:\${encodeURIComponent(r.senderEmail)}?subject=\${encodeURIComponent('Re: ' + r.subject)}" class="btn btn-primary btn-sm" style="font-size: 0.72rem; padding: 0.25rem 0.65rem; background: linear-gradient(135deg, #f59e0b, #d97706); text-decoration: none; border: none; font-weight: 700;">
            ✉️ Reply from Gmail
          </a>
        </div>
      </div>
    \`;
  }).join('');
}

// Check replies on start
setTimeout(fetchReplies, 1500);
// Check for new replies every 3 minutes in background
setInterval(fetchReplies, 180000);
`;

if (!appJs.includes('// ==================== CLIENT REPLIES & HOT LEADS FRONTEND ====================')) {
  appJs += repliesFrontendLogic;
  fs.writeFileSync(appJsPath, appJs, 'utf8');
  console.log('app.js updated with client replies frontend handling');
}
