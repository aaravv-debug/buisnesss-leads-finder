const axios = require('axios');
const cheerio = require('cheerio');

async function testDecodedBing(query) {
  const res = await axios.get(`https://www.bing.com/search?q=${encodeURIComponent(query)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  const $ = cheerio.load(res.data);
  const links = [];

  $('li.b_algo h2 a').each((_, a) => {
    let href = $(a).attr('href') || '';
    if (href.includes('&u=a1')) {
      try {
        const match = href.match(/&u=a1([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          const base64 = match[1].replace(/-/g, '+').replace(/_/g, '/');
          href = Buffer.from(base64, 'base64').toString('utf-8');
        }
      } catch (_) {}
    }
    links.push(href);
  });

  console.log('Decoded search links:');
  console.log(links.slice(0, 5));
}

testDecodedBing('Miami Smile Dental Miami FL instagram facebook');
