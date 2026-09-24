const EventEmitter = require('events');
const XLSX = require('xlsx');
const { scrapeGoogleMaps } = require('./scraper');
const { parseAddress } = require('./utils');

class JobManager {
  constructor() {
    this.jobs = new Map();
  }

  createJob({ query, maxResults = 20, enrich = true, headless = true }) {
    const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const job = {
      id,
      query,
      maxResults: parseInt(maxResults, 10) || 20,
      enrich: Boolean(enrich),
      headless: Boolean(headless),
      status: 'pending',
      leads: [],
      logs: [],
      progress: { current: 0, total: parseInt(maxResults, 10) || 20 },
      emitter: new EventEmitter(),
      createdAt: new Date().toISOString(),
      completedAt: null,
      error: null
    };

    this.jobs.set(id, job);
    return job;
  }

  getJob(id) {
    return this.jobs.get(id);
  }

  getAllJobs() {
    return Array.from(this.jobs.values()).map(j => ({
      id: j.id,
      query: j.query,
      status: j.status,
      leadCount: j.leads.length,
      createdAt: j.createdAt,
      completedAt: j.completedAt
    }));
  }

  async startJob(id) {
    const job = this.jobs.get(id);
    if (!job) throw new Error('Job not found');

    job.status = 'running';
    this.addLog(job, `Job started for query: "${job.query}"`);

    try {
      const results = await scrapeGoogleMaps({
        query: job.query,
        maxResults: job.maxResults,
        enrich: job.enrich,
        headless: job.headless,
        onLead: (lead) => {
          job.leads.push(lead);
          job.emitter.emit('lead', lead);
        },
        onLog: (msg) => {
          this.addLog(job, msg);
        },
        onProgress: (prog) => {
          job.progress = prog;
          job.emitter.emit('progress', prog);
        }
      });

      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      this.addLog(job, `Job finished successfully with ${job.leads.length} leads.`);
      job.emitter.emit('done', { leadCount: job.leads.length });
    } catch (err) {
      job.status = 'failed';
      job.error = err.message;
      job.completedAt = new Date().toISOString();
      this.addLog(job, `Job failed: ${err.message}`);
      job.emitter.emit('error', { error: err.message });
    }
  }

  addLog(job, text) {
    const entry = {
      timestamp: new Date().toLocaleTimeString(),
      text
    };
    job.logs.push(entry);
    job.emitter.emit('log', entry);
  }

  /**
   * Helper to transform raw leads into standard, structured CRM records
   */
  formatLeadRecord(lead) {
    const emails = lead.emails || [];
    const addr = parseAddress(lead.address);

    return {
      'Company Name': lead.name || '',
      'Category': lead.category || '',
      'Phone Number': lead.phone || '',
      'Primary Email': emails[0] || '',
      'Secondary Email': emails[1] || '',
      'All Emails': emails.join('; '),
      'Website URL': lead.website || '',
      'Street Address': addr.street || '',
      'City': addr.city || '',
      'State': addr.state || '',
      'Zip Code': addr.zipCode || '',
      'Country': addr.country || '',
      'Full Address': lead.address || '',
      'Rating': lead.rating !== null && lead.rating !== undefined ? Number(lead.rating) : '',
      'Reviews Count': lead.reviews !== null && lead.reviews !== undefined ? Number(lead.reviews) : '',
      'WhatsApp Direct Link': lead.whatsAppUrl || (lead.phone ? `https://wa.me/1${lead.phone.replace(/\D/g, '')}` : ''),
      'Instagram': lead.socials?.instagram || '',
      'Facebook': lead.socials?.facebook || '',
      'LinkedIn': lead.socials?.linkedin || '',
      'Twitter / X': lead.socials?.twitter || '',
      'YouTube': lead.socials?.youtube || '',
      'Instagram Search Link': `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(lead.name || '')}`,
      'Facebook Search Link': `https://www.facebook.com/search/pages/?q=${encodeURIComponent(lead.name || '')}`,
      'Website Status': lead.website ? 'Has Website' : 'NO WEBSITE (Hot Pitch Target)',
      'Google Maps URL': lead.googleMapsUrl || ''
    };
  }

  /**
   * Export to clean, Excel/Google Sheets compliant CSV with UTF-8 BOM
   */
  exportToCSV(leads) {
    const records = leads.map(l => this.formatLeadRecord(l));
    if (records.length === 0) {
      records.push(this.formatLeadRecord({ name: '', emails: [], socials: {} }));
    }

    const headers = Object.keys(records[0]);

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const s = String(val).replace(/"/g, '""');
      return `"${s}"`;
    };

    const headerRow = headers.map(h => escapeCsv(h)).join(',');
    const rows = records.map(r => headers.map(h => escapeCsv(r[h])).join(','));

    // Prepend UTF-8 BOM (\uFEFF) so Excel/Sheets recognizes UTF-8 encoding and delimiters cleanly
    return '\uFEFF' + [headerRow, ...rows].join('\r\n');
  }

  /**
   * Export to native Excel (.xlsx) file with auto column widths
   */
  exportToExcel(leads) {
    const records = leads.map(l => this.formatLeadRecord(l));
    const worksheet = XLSX.utils.json_to_sheet(records);

    // Calculate dynamic column widths
    const headers = Object.keys(records[0] || {});
    const colWidths = headers.map(header => {
      let maxLen = header.length;
      for (const row of records) {
        const val = row[header] ? String(row[header]) : '';
        if (val.length > maxLen) {
          maxLen = Math.min(val.length, 50); // cap max width at 50 chars
        }
      }
      return { wch: Math.max(maxLen + 3, 12) };
    });

    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');

    return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  }
}

module.exports = new JobManager();
