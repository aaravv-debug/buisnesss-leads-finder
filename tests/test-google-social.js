const puppeteer = require('puppeteer-core');
const { getBrowserExecutablePath } = require('../src/utils');

async function testGoogleSocialSearch(name, location) {
  const browser = await puppeteer.launch({
    executablePath: getBrowserExecutablePath(),
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=en-US,en']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  const query = `"${name}" ${location} instagram facebook email`;
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en`;

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });

  const data = await page.evaluate(() => {
    const text = document.body.innerText || '';
    const links = Array.from(document.querySelectorAll('a[href]')).map(a => a.href);

    const ig = links.find(h => h.includes('instagram.com/') && !h.includes('/p/') && !h.includes('/explore/'));
    const fb = links.find(h => h.includes('facebook.com/') && !h.includes('sharer') && !h.includes('/share.php'));
    const li = links.find(h => h.includes('linkedin.com/company/') || h.includes('linkedin.com/in/'));

    // Extract emails from snippets
    const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi) || [];
    // Extract US phone numbers (e.g. (305) 123-4567 or 305-123-4567)
    const phones = text.match(/(?:\+?1[-. ]?)?\(?[2-9]\d{2}\)?[-. ]?\d{3}[-. ]?\d{4}/g) || [];

    return {
      instagram: ig ? ig.split('&')[0] : null,
      facebook: fb ? fb.split('&')[0] : null,
      linkedin: li ? li.split('&')[0] : null,
      emails: Array.from(new Set(emails.filter(e => !e.endsWith('.png') && !e.includes('google.com')))),
      phones: Array.from(new Set(phones))
    };
  });

  console.log('Result for:', name);
  console.log(JSON.stringify(data, null, 2));

  await browser.close();
}

testGoogleSocialSearch('Miami Smile Dental', 'Miami FL');
