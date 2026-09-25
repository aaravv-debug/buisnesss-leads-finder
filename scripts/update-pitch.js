const fs = require('fs');
const path = require('path');

// 1. Update src/autopilot.js
const autopilotPath = path.join(__dirname, '..', 'src', 'autopilot.js');
if (fs.existsSync(autopilotPath)) {
  let content = fs.readFileSync(autopilotPath, 'utf8');

  // Replace No Web pitch
  content = content.replace(
    /I put together a quick 30-second preview demo of how a custom mobile booking page could look for \{\{name\}\}\.\s*\\n\\nWould you mind if I sent the preview link over\? No pressure at all, just thought it might be helpful!/g,
    "May I send a 45-second video showing how your website will look for {{name}}? No pressure at all, just thought it might be helpful!"
  );

  // Fallback looser match if formatting differed
  content = content.replace(
    /I put together a quick 30-second preview demo[\s\S]*?No pressure at all, just thought it might be helpful!/g,
    "May I send a 45-second video showing how your website will look for {{name}}? No pressure at all, just thought it might be helpful!"
  );

  // Replace Redesign pitch
  content = content.replace(
    /I put together a quick 30-second preview demo showing what a modern, faster 2026 version of \{\{name\}\}'s website could look like\.\s*\\n\\nWould you be open to me sending the preview link over\? No pressure at all, just thought it might give you some great ideas!/g,
    "May I send a 45-second video showing how your website will look for {{name}}? No pressure at all, just thought it might give you some great ideas!"
  );

  // Fallback looser match
  content = content.replace(
    /I put together a quick 30-second preview demo[\s\S]*?No pressure at all, just thought it might give you some great ideas!/g,
    "May I send a 45-second video showing how your website will look for {{name}}? No pressure at all, just thought it might give you some great ideas!"
  );

  fs.writeFileSync(autopilotPath, content, 'utf8');
  console.log('autopilot.js updated successfully');
}

// 2. Update public/index.html
const indexPath = path.join(__dirname, '..', 'public', 'index.html');
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');

  // Replace Email Template 1 (No Web)
  html = html.replace(
    /I put together a quick 30-second preview demo of how a custom mobile booking page could look for\s+\{\{name\}\}\.\s+Would you mind if I sent the preview link over\? No pressure at all, just thought it might be\s+helpful!/g,
    "May I send a 45-second video showing how your website will look for {{name}}? No pressure at all, just thought it might be helpful!"
  );

  // Replace Email Template 2 (Redesign)
  html = html.replace(
    /I put together a quick 30-second preview demo showing what a modern, faster 2026 version of\s+\{\{name\}\}'s website could look like\.\s+Would you be open to me sending the preview link over\? No pressure at all, just thought it might\s+give you some great ideas!/g,
    "May I send a 45-second video showing how your website will look for {{name}}? No pressure at all, just thought it might give you some great ideas!"
  );

  // Replace Instagram DM Template 1
  html = html.replace(
    /I put together a quick 30-second design preview of how a booking page could look for \{\{name\}\}\.\s+Would you mind if I sent the preview link over\? No pressure at all!/g,
    "May I send a 45-second video showing how your website will look for {{name}}? No pressure at all!"
  );

  // Replace Instagram DM Template 2
  html = html.replace(
    /I put together a quick 30-second design preview of a modern, refreshed look for \{\{name\}\}\.\s+Would you mind if I sent the preview over\? No pressure at all!/g,
    "May I send a 45-second video showing how your website will look for {{name}}? No pressure at all!"
  );

  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('index.html updated successfully');
}
