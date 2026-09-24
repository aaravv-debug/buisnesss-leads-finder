const axios = require('axios');
const cheerio = require('cheerio');

async function testBing(query) {
  try {
    const res = await axios.get(`https://www.bing.com/search?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 8000
    });

    const $ = cheerio.load(res.data);
    const links = [];
    $('li.b_algo h2 a').each((_, a) => {
      const href = $(a).attr('href');
      if (href) links.push(href);
    });

    console.log('Discovered Search Links for:', query);
    console.log(links);

    const ig = links.find(l => l.includes('instagram.com/'));
    const fb = links.find(l => l.includes('facebook.com/'));
    const li = links.find(l => l.includes('linkedin.com/'));
    const website = links.find(l => !l.includes('instagram.com') && !l.includes('facebook.com') && !l.includes('linkedin.com') && !l.includes('yelp.com') && !l.includes('mapquest.com'));

    console.log({
      discoveredWebsite: website || null,
      instagram: ig || null,
      facebook: fb || null,
      linkedin: li || null
    });
  } catch (err) {
    console.error('Bing error:', err.message);
  }
}

testBing('Miami Smile Dental Miami FL instagram facebook');
