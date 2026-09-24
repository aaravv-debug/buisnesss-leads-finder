#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { scrapeGoogleMaps } = require('../src/scraper');
const jobs = require('../src/jobs');

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage:
  node scripts/scrape.js "<keyword / query>" [options]

Examples:
  node scripts/scrape.js "gyms in Miami FL" --limit 10
  node scripts/scrape.js "dentists in Denver CO" --limit 5 --no-enrich
  node scripts/scrape.js "plumbers in Austin TX" --output leads.csv

Options:
  --limit <number>    Max results to collect (default: 10)
  --output <file>     Export results to CSV file (default: stdout/leads.csv)
  --no-enrich         Skip crawling website for emails and social profiles
  --headful           Show Google Chrome browser window
`);
    process.exit(0);
  }

  const query = args[0];
  let limit = 10;
  let outputFile = 'leads.csv';
  let enrich = true;
  let headless = true;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[++i], 10);
    } else if (args[i] === '--output' && args[i + 1]) {
      outputFile = args[++i];
    } else if (args[i] === '--no-enrich') {
      enrich = false;
    } else if (args[i] === '--headful') {
      headless = false;
    }
  }

  console.log(`\n======================================================`);
  console.log(`🗺️ LeadPulse CLI: Starting Scraper`);
  console.log(`Query:     "${query}"`);
  console.log(`Limit:     ${limit}`);
  console.log(`Enrich:    ${enrich ? 'Yes (extract emails & socials)' : 'No'}`);
  console.log(`Headless:  ${headless ? 'Yes' : 'No'}`);
  console.log(`Output:    ${outputFile}`);
  console.log(`======================================================\n`);

  const results = await scrapeGoogleMaps({
    query,
    maxResults: limit,
    enrich,
    headless,
    onLead: (lead) => {
      console.log(`[+] Found: ${lead.name} | Phone: ${lead.phone || 'N/A'} | Emails: ${(lead.emails || []).join(', ') || 'None'}`);
    },
    onLog: (msg) => {
      console.log(`[log] ${msg}`);
    },
    onProgress: (p) => {
      process.stdout.write(`\rProgress: ${p.current}/${p.total} leads...`);
    }
  });

  console.log(`\n\nDone! Scraped ${results.length} leads.`);
  const csvData = jobs.exportToCSV(results);
  const outPath = path.resolve(process.cwd(), outputFile);
  fs.writeFileSync(outPath, csvData, 'utf8');
  console.log(`Saved clean CSV lead list to: ${outPath}\n`);
}

main().catch(err => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});
