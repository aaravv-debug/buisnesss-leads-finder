const fs = require('fs');
const path = require('path');

const autopilotPath = path.join(__dirname, '..', 'src', 'autopilot.js');
let code = fs.readFileSync(autopilotPath, 'utf8');

// Replace the line that calculates maxToScrape
code = code.replace(
  /const maxToScrape = Math\.min\(45, \(this\.state\.maxLeadsPerRun \|\| 30\) \+ 15\);/,
  `const targetLeadsNeeded = this.state.maxLeadsPerRun || 70;
      const maxToScrape = Math.max(targetLeadsNeeded, Math.round(targetLeadsNeeded * 1.4));`
);

// Clean up query string so & doesn't break Google Maps searches
code = code.replace(
  /query: `\$\{target\.niche\} in \$\{target\.city\}`/g,
  "query: `${target.niche.replace(/&/g, 'and')} in ${target.city}`"
);

fs.writeFileSync(autopilotPath, code, 'utf8');
console.log('autopilot.js capacity updated successfully!');
