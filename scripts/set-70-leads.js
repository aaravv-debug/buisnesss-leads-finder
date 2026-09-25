const fs = require('fs');
const path = require('path');

const statePath = path.join(__dirname, '..', 'autopilot-state.json');
if (fs.existsSync(statePath)) {
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  state.maxLeadsPerRun = 70;
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
  console.log('autopilot-state.json updated with maxLeadsPerRun = 70');
}
