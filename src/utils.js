const fs = require('fs');
const path = require('path');

/**
 * Automatically locate Chrome or Edge executable on Windows/Mac/Linux
 */
function getBrowserExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (process.env.CHROME_BIN) {
    return process.env.CHROME_BIN;
  }

  const commonPaths = [
    // Windows Chrome
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe') : null,
    // Windows Edge
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium'
  ].filter(Boolean);

  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  throw new Error('Google Chrome or Microsoft Edge was not found in common system paths. Please ensure Chrome is installed.');
}

/**
 * Async sleep helper
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Clean & normalize text
 */
function cleanText(text) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Break down a Google Maps address into structured fields:
 * street, city, state, zipCode, country
 */
function parseAddress(fullAddress) {
  if (!fullAddress) {
    return { street: '', city: '', state: '', zipCode: '', country: '', fullAddress: '' };
  }

  const parts = fullAddress.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) {
    return { street: '', city: '', state: '', zipCode: '', country: '', fullAddress };
  }

  let country = '';
  let state = '';
  let zipCode = '';
  let city = '';
  let street = '';

  const knownCountries = ['United States', 'USA', 'U.S.A.', 'Canada', 'United Kingdom', 'UK', 'Australia', 'India', 'Germany', 'France', 'Spain', 'Italy', 'Mexico', 'Brazil'];

  let remaining = [...parts];

  // 1. Check if the last part is a country (no digits and either in known countries or 4+ parts)
  if (remaining.length > 1) {
    const last = remaining[remaining.length - 1];
    const hasDigits = /\d/.test(last);
    if (!hasDigits && (knownCountries.includes(last) || remaining.length >= 4)) {
      country = remaining.pop();
    }
  }

  // 2. Look for State + Zip, e.g. "FL 33132" or "FL 33156" or "California 90210"
  if (remaining.length > 0) {
    const candidate = remaining[remaining.length - 1];
    const match = candidate.match(/^([A-Za-z\s]{2,20})\s+([0-9]{5}(?:-[0-9]{4})?|[A-Za-z0-9-]+)$/);
    if (match) {
      state = match[1].trim();
      zipCode = match[2].trim();
      remaining.pop();
    } else if (/^[0-9]{5}(?:-[0-9]{4})?$/.test(candidate)) {
      zipCode = remaining.pop();
      if (remaining.length > 0 && /^[A-Za-z]{2}$/.test(remaining[remaining.length - 1])) {
        state = remaining.pop();
      }
    } else if (/^[A-Za-z]{2}$/.test(candidate)) {
      state = remaining.pop();
    }
  }

  // 3. City is the element right before State/Zip
  if (remaining.length > 1) {
    city = remaining.pop();
    street = remaining.join(', ');
  } else if (remaining.length === 1) {
    if (/\d/.test(remaining[0])) {
      street = remaining[0];
    } else {
      city = remaining[0];
    }
  }

  if (!country && (state || zipCode)) {
    country = 'United States';
  }

  return {
    street,
    city,
    state,
    zipCode,
    country,
    fullAddress
  };
}

module.exports = {
  getBrowserExecutablePath,
  sleep,
  cleanText,
  parseAddress
};
