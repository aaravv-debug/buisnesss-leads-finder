const puppeteer = require('puppeteer-core');
const { getBrowserExecutablePath, sleep } = require('../src/utils');

async function debugDetail() {
  const browser = await puppeteer.launch({
    executablePath: getBrowserExecutablePath(),
    headless: 'new',
    defaultViewport: { width: 1280, height: 800 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=en-US,en']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  const testPlaceUrl = 'https://www.google.com/maps/place/Miami+Strong+Gym/data=!4m7!3m6!1s0x88d9b5816d0d24e5:0x57aa62e96d8f5ef3!8m2!3d25.7941606!4d-80.1866841!16s%2Fg%2F11fk8bwnqj!19sChIJ5SQNbYG12YgR816Pbeliqlc?authuser=0&hl=en';
  await page.goto(testPlaceUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(2500);

  const data = await page.evaluate(() => {
    // Name
    const nameEl = document.querySelector('h1.DUwDvf, h1.fontHeadlineLarge, h1[class*="header"]');
    const name = nameEl?.innerText?.trim();

    // Category
    const categoryBtn = document.querySelector('button[jsaction*="pane.rating.category"], [class*="fontBodyMedium"] button');
    const category = categoryBtn?.innerText?.trim();

    // Address
    const addressBtn = document.querySelector('button[data-item-id="address"], button[aria-label*="Address:"]');
    const address = addressBtn?.getAttribute('aria-label')?.replace(/^Address:\s*/i, '').trim() || addressBtn?.innerText?.trim();

    // Website
    const websiteLink = document.querySelector('a[data-item-id="authority"], a[aria-label*="Website:"]');
    const website = websiteLink?.href;

    // Phone
    const phoneBtn = document.querySelector('button[data-item-id*="phone:tel:"], button[aria-label*="Phone:"]');
    const phone = phoneBtn?.getAttribute('aria-label')?.replace(/^Phone:\s*/i, '').trim() || phoneBtn?.innerText?.trim();

    // Rating
    const ratingEl = document.querySelector('div.F7nice span[aria-hidden="true"], span.ceNzKf');
    const rating = ratingEl?.innerText?.trim();

    // Reviews
    const reviewsEl = document.querySelector('div.F7nice span[aria-label*="review"], span[aria-label*="reviews"]');
    const reviews = reviewsEl?.getAttribute('aria-label') || reviewsEl?.innerText?.trim();

    return {
      name,
      category,
      address,
      website,
      phone,
      rating,
      reviews
    };
  });

  console.log('Extracted place details:', JSON.stringify(data, null, 2));
  await browser.close();
}

debugDetail().catch(console.error);
