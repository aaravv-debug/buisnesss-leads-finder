const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'public', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// 1. Add Header Button for Client Replies
if (!html.includes('id="repliesModalBtn"')) {
  const targetHeaderBtn = '<button id="followupsModalBtn"';
  const newHeaderBtn = `<button id="repliesModalBtn" class="btn btn-secondary" style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); color: #f59e0b; font-weight: 700;">
          📥 Client Replies (<span id="headerRepliesCount">0</span>)
        </button>\n        `;
  html = html.replace(targetHeaderBtn, newHeaderBtn + targetHeaderBtn);
  console.log('Added repliesModalBtn to header');
}

// 2. Add Tab Button in Outreach Modal
if (!html.includes('data-tab="tab-replies"')) {
  const targetTabBtn = `<button type="button" class="outreach-tab-btn" data-tab="tab-followups"`;
  const newTabBtn = `<button type="button" class="outreach-tab-btn" data-tab="tab-replies" style="color: #f59e0b; font-weight: 700;">
            📥 Client Replies (<span id="tabRepliesCount">0</span>)
          </button>\n          `;
  html = html.replace(targetTabBtn, newTabBtn + targetTabBtn);
  console.log('Added tab-replies button in modal');
}

// 3. Add Tab Content for Client Replies
if (!html.includes('id="tab-replies"')) {
  const repliesTabContent = `
          <!-- TAB 6: CLIENT REPLIES & HOT LEADS FOLDER -->
          <div id="tab-replies" class="outreach-tab-content">
            <!-- Header Banner -->
            <div style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(236, 72, 153, 0.1)); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: var(--radius-sm); padding: 1rem; margin-bottom: 1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                <div>
                  <h4 style="margin: 0; font-size: 1rem; color: #f59e0b; display: flex; align-items: center; gap: 0.5rem;">
                    📥 Client Replies & Hot Leads Folder
                    <span id="repliesBadgeCount" style="background: #f59e0b; color: #111; padding: 0.15rem 0.55rem; border-radius: 999px; font-size: 0.72rem; font-weight: 800;">0 New</span>
                  </h4>
                  <p style="margin: 0.25rem 0 0 0; font-size: 0.78rem; color: var(--text-muted);">
                    Direct answers from businesses who received your pitch in <strong>editcraftstudio19@gmail.com</strong>. Only real client replies appear here.
                  </p>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                  <button type="button" id="btnScanInboxNow" class="btn btn-primary btn-sm" style="background: linear-gradient(135deg, #f59e0b, #d97706); border: none; font-size: 0.75rem; padding: 0.4rem 0.85rem; font-weight: 700;">
                    🔍 Check Gmail Inbox Now
                  </button>
                </div>
              </div>

              <!-- Quick Info Cards -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.6rem; margin-top: 0.75rem;">
                <div style="background: rgba(0,0,0,0.25); padding: 0.5rem 0.75rem; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);">
                  <div style="font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase;">Total Replies</div>
                  <div id="statTotalReplies" style="font-size: 1.15rem; font-weight: 800; color: #fff;">0</div>
                </div>
                <div style="background: rgba(0,0,0,0.25); padding: 0.5rem 0.75rem; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);">
                  <div style="font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase;">Wants 45s Video</div>
                  <div id="statWantsVideo" style="font-size: 1.15rem; font-weight: 800; color: #34d399;">0</div>
                </div>
                <div style="background: rgba(0,0,0,0.25); padding: 0.5rem 0.75rem; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);">
                  <div style="font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase;">Linked Gmail</div>
                  <div style="font-size: 0.75rem; font-weight: 600; color: #60a5fa; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">editcraftstudio19</div>
                </div>
                <div style="background: rgba(0,0,0,0.25); padding: 0.5rem 0.75rem; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);">
                  <div style="font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase;">Inbox Scanner</div>
                  <div style="font-size: 0.82rem; font-weight: 700; color: #a78bfa;">✅ Connected</div>
                </div>
              </div>
            </div>

            <!-- Replies Feed Container -->
            <div id="repliesContainer" style="max-height: 420px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem;">
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
            </div>
          </div>
`;
  html = html.replace('<!-- TAB 5: 2-DAY CLIENT FOLLOW-UP PIPELINE -->', repliesTabContent + '\n          <!-- TAB 5: 2-DAY CLIENT FOLLOW-UP PIPELINE -->');
  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('Added tab-replies content to index.html');
}
