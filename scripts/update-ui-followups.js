const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'public', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// 1. Add Header Button if not present
if (!html.includes('id="followupsModalBtn"')) {
  const targetHeaderAction = '<button id="outreachModalBtn"';
  const newHeaderBtn = `        <button id="followupsModalBtn" class="btn btn-secondary" style="background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.4); color: #60a5fa; font-weight: 700;">
          📁 Follow-Up Tracker (88 Clients)
        </button>\n        `;
  html = html.replace(targetHeaderAction, newHeaderBtn + targetHeaderAction);
  console.log('Added followupsModalBtn to header');
}

// 2. Add Tab button in modal tabs
if (!html.includes('data-tab="tab-followups"')) {
  const targetTabBtn = `<button type="button" class="outreach-tab-btn" data-tab="tab-autopilot" style="color: #34d399;">`;
  const newTabBtn = `<button type="button" class="outreach-tab-btn" data-tab="tab-followups" style="color: #60a5fa; font-weight: 700;">
            📁 2-Day Follow-Ups (88)
          </button>\n          `;
  html = html.replace(targetTabBtn, newTabBtn + targetTabBtn);
  console.log('Added tab-followups button in modal');
}

// 3. Add Tab Content
if (!html.includes('id="tab-followups"')) {
  const tabContentHtml = `
          <!-- TAB 5: 2-DAY CLIENT FOLLOW-UP PIPELINE -->
          <div id="tab-followups" class="outreach-tab-content">
            <!-- Header Banner -->
            <div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(16, 185, 129, 0.1)); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: var(--radius-sm); padding: 1rem; margin-bottom: 1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                <div>
                  <h4 style="margin: 0; font-size: 1rem; color: #60a5fa; display: flex; align-items: center; gap: 0.5rem;">
                    📁 2-Day Client Follow-Up Tracker
                    <span id="followupTotalBadge" style="background: #3b82f6; color: white; padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.75rem; font-weight: 700;">88 Clients</span>
                  </h4>
                  <p style="margin: 0.25rem 0 0 0; font-size: 0.78rem; color: var(--text-muted);">
                    All outreach recipients sent today (25 Sep) are tracked here. Follow-ups are scheduled for <strong>Sunday, 27 Sep (in 2 days)</strong> so no client is forgotten.
                  </p>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                  <a href="/api/followups/export.csv" target="_blank" class="btn btn-secondary btn-sm" style="background: rgba(255,255,255,0.06); border: 1px solid var(--border-color); color: #fff; font-size: 0.75rem; display: flex; align-items: center; gap: 0.35rem; text-decoration: none; padding: 0.4rem 0.75rem; border-radius: 4px;">
                    📥 Export CSV
                  </a>
                  <button type="button" id="btnRefreshFollowups" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 0.4rem 0.75rem;">
                    🔄 Refresh
                  </button>
                </div>
              </div>

              <!-- Quick Stat Cards -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.6rem; margin-top: 0.75rem;">
                <div style="background: rgba(0,0,0,0.25); padding: 0.5rem 0.75rem; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);">
                  <div style="font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase;">Messaged Today</div>
                  <div id="statMessagedToday" style="font-size: 1.15rem; font-weight: 800; color: #fff;">88</div>
                </div>
                <div style="background: rgba(0,0,0,0.25); padding: 0.5rem 0.75rem; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);">
                  <div style="font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase;">Follow-Up Due Date</div>
                  <div style="font-size: 0.88rem; font-weight: 700; color: #34d399;">27 Sep (In 2 Days)</div>
                </div>
                <div style="background: rgba(0,0,0,0.25); padding: 0.5rem 0.75rem; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);">
                  <div style="font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase;">Follow-Up Pitch</div>
                  <div style="font-size: 0.82rem; font-weight: 600; color: #60a5fa;">45s Video Check-in</div>
                </div>
                <div style="background: rgba(0,0,0,0.25); padding: 0.5rem 0.75rem; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);">
                  <div style="font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase;">Pipeline Status</div>
                  <div style="font-size: 0.88rem; font-weight: 700; color: #a78bfa;">100% Tracked</div>
                </div>
              </div>
            </div>

            <!-- Controls: Search & Filter -->
            <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem; flex-wrap: wrap;">
              <input type="text" id="followupSearchInput" placeholder="🔍 Search by business name, city, or email..." style="flex: 2; min-width: 200px; padding: 0.45rem 0.75rem; font-size: 0.8rem; background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: #fff;">
              <select id="followupFilterSelect" style="flex: 1; min-width: 140px; padding: 0.45rem 0.75rem; font-size: 0.8rem; background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: #fff;">
                <option value="all">All Niches</option>
                <option value="Miami">Miami Med Spas</option>
                <option value="Austin">Austin Cosmetic Dentists</option>
                <option value="Los Angeles">LA Aesthetics & Botox</option>
                <option value="pending">Due in 2 Days (Pending)</option>
                <option value="followed">Followed Up</option>
              </select>
            </div>

            <!-- Follow-up Table -->
            <div style="max-height: 380px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: rgba(0,0,0,0.2);">
              <table style="width: 100%; border-collapse: collapse; font-size: 0.78rem; text-align: left;">
                <thead style="position: sticky; top: 0; background: #131722; border-bottom: 1px solid var(--border-color); z-index: 2;">
                  <tr>
                    <th style="padding: 0.6rem 0.75rem; color: var(--text-muted); font-weight: 600;">#</th>
                    <th style="padding: 0.6rem 0.75rem; color: var(--text-muted); font-weight: 600;">Business & Niche</th>
                    <th style="padding: 0.6rem 0.75rem; color: var(--text-muted); font-weight: 600;">Email Address</th>
                    <th style="padding: 0.6rem 0.75rem; color: var(--text-muted); font-weight: 600;">Messaged</th>
                    <th style="padding: 0.6rem 0.75rem; color: var(--text-muted); font-weight: 600;">Follow-Up Due</th>
                    <th style="padding: 0.6rem 0.75rem; color: var(--text-muted); font-weight: 600;">Status</th>
                    <th style="padding: 0.6rem 0.75rem; color: var(--text-muted); font-weight: 600; text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody id="followupTableBody">
                  <tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading follow-up pipeline...</td></tr>
                </tbody>
              </table>
            </div>

            <!-- 2-Day Follow-Up Template Box -->
            <div style="margin-top: 1rem; background: rgba(255,255,255,0.02); border: 1px dashed var(--border-color); border-radius: var(--radius-sm); padding: 0.75rem 1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                <span style="font-size: 0.75rem; font-weight: 700; color: #60a5fa;">📝 2-Day Follow-Up Message Template (Automatically prepared):</span>
                <button type="button" id="btnCopyFollowupTemplate" class="btn btn-secondary btn-sm" style="font-size: 0.7rem; padding: 0.2rem 0.5rem;">📋 Copy Template</button>
              </div>
              <textarea id="followupTemplateText" readonly style="width: 100%; height: 75px; background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-color); font-size: 0.75rem; font-family: var(--font-mono); padding: 0.4rem 0.6rem; resize: none;">Hi {{name}} team! 👋

Just wanted to follow up on my quick note from Thursday regarding the 45-second video preview of how a modern booking website could look for {{name}}.

Would you still like me to send that 45-second demo over? No pressure at all, just thought it might be helpful!

Best regards,
Aaravsinh Rathod
Web Developer & Designer
https://aaravsinh-rathod-portfolio-9.vercel.app/</textarea>
            </div>
          </div>
`;
  html = html.replace('</div>\n\n      </div>\n    </div>\n\n    <!-- Notification Toast -->', tabContentHtml + '\n          </div>\n      </div>\n    </div>\n\n    <!-- Notification Toast -->');
  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('Added tab-followups content to index.html');
}
