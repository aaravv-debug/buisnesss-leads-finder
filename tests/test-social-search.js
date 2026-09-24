const axios = require('axios');

async function testSocialSearch(businessName, location) {
  const query = `"${businessName}" "${location}" (site:instagram.com OR site:facebook.com OR contact OR email)`;
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 8000
    });

    const html = res.data;
    const igMatches = html.match(/https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_.]+/gi) || [];
    const fbMatches = html.match(/https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9_.]+/gi) || [];
    const emailMatches = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi) || [];

    // Filter out generic links
    const cleanIg = igMatches.find(u => !u.includes('/p/') && !u.includes('/explore/') && !u.includes('/reels/'));
    const cleanFb = fbMatches.find(u => !u.includes('/sharer') && !u.includes('/login') && !u.includes('/help'));

    console.log('Search Results for:', businessName);
    console.log('Instagram:', cleanIg || 'Not found');
    console.log('Facebook:', cleanFb || 'Not found');
    console.log('Discovered Emails:', Array.from(new Set(emailMatches)));
  } catch (err) {
    console.error('Search error:', err.message);
  }
}

testSocialSearch('Miami Smile Dental', 'Miami FL');
