const puppeteer = require('puppeteer-core');
const { getBrowserExecutablePath, sleep } = require('../src/utils');

async function debug() {
  const browser = await puppeteer.launch({
    executablePath: getBrowserExecutablePath(),
    headless: 'new',
    defaultViewport: { width: 1280, height: 800 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=en-US,en']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  console.log('Navigating to Google Maps search...');
  await page.goto('https://www.google.com/maps/search/gyms+in+Miami+FL?hl=en', { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(3000);

  const feedExists = await page.$('div[role="feed"]');
  console.log('Feed exists:', Boolean(feedExists));

  const sampleItems = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('div[role="feed"] a[href*="/maps/place/"]'));
    return anchors.slice(0, 3).map(a => {
      const card = a.closest('div[jsaction]') || a.parentElement;
      return {
        anchorAriaLabel: a.getAttribute('aria-label'),
        anchorHref: a.href,
        cardInnerText: card ? card.innerText.split('\n').slice(0, 5) : [],
        qBF1PdText: card?.querySelector('.qBF1Pd')?.innerText || null,
        fontHeadlineSmallText: card?.querySelector('.fontHeadlineSmall')?.innerText || null,
        allH3orH2: Array.from(card?.querySelectorAll('h1, h2, h3, div[role="heading"]') || []).map(h => h.innerText)
      };
    });
  });

  console.log('Sample feed items:', JSON.stringify(sampleItems, null, 2));

  // Now click the first item to see what detail pane looks like
  if (sampleItems.length > 0) {
    console.log('Clicking first item...');
    await page.evaluate((url) => {
      const a = document.querySelector(`a[href="${url}"]`);
      if (a) a.click();
    }, sampleItems[0].anchorHref);
    await sleep(3000);

    const detailInfo = await page.evaluate(() => {
      const h1s = Array.from(document.querySelectorAll('h1')).map(h => ({
        tag: h.tagName,
        className: h.className,
        text: h.innerText
      }));
      const fontHeadlineLarge = document.querySelector('.fontHeadlineLarge')?.innerText;
      const DUwDvf = document.querySelector('.DUwDvf')?.innerText;
      return {
        h1s,
        fontHeadlineLarge,
        DUwDvf,
        url: window.location.href
      };
    });

    console.log('Detail info after click:', JSON.stringify(detailInfo, null, 2));
  }

  await browser.close();
}

debug().catch(console.error);
