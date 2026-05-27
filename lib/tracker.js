const https = require('https');

const PROVIDERS = ['aramex', 'dhl', 'cit', 'sprint', 'coastal'];
const DEFAULT_PROVIDER = 'aramex';

/**
 * Fetch tracking events for a single provider.
 * Returns an array of { date, time, location, description } or null.
 */
function fetchProvider(trackingNumber, provider, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const url =
      `https://www.postnet.co.za/postnet-track/exit/?rawpost=1` +
      `&tracking_number=${encodeURIComponent(trackingNumber)}` +
      `&provider=${encodeURIComponent(provider)}`;

    const req = https.get(
      url,
      {
        headers: {
          Referer: 'https://www.postnet.co.za/tracker',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
            'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (!data.trim()) return resolve(null);
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(null);
          }
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error('request timed out'));
    });
  });
}

/**
 * Track a parcel. Tries the given provider first, then falls back through all providers.
 * Returns { provider, events } or null.
 */
async function track(trackingNumber, opts = {}) {
  const num = trackingNumber.replace(/\s/g, '').toUpperCase();
  const preferred = opts.provider || DEFAULT_PROVIDER;

  // Try preferred provider first
  try {
    const events = await fetchProvider(num, preferred, opts.timeoutMs);
    if (events && events.length > 0) return { provider: preferred, events };
  } catch {}

  // Fall back through the rest
  if (!opts.provider) {
    for (const p of PROVIDERS) {
      if (p === preferred) continue;
      try {
        const events = await fetchProvider(num, p, opts.timeoutMs);
        if (events && events.length > 0) return { provider: p, events };
      } catch {}
    }
  }

  return null;
}

/**
 * Query all providers and return a map of provider → events[].
 */
async function trackAll(trackingNumber, opts = {}) {
  const num = trackingNumber.replace(/\s/g, '').toUpperCase();
  const results = {};

  for (const p of PROVIDERS) {
    try {
      const events = await fetchProvider(num, p, opts.timeoutMs);
      if (events && events.length > 0) results[p] = events;
    } catch {}
  }

  return results;
}

module.exports = { track, trackAll, fetchProvider, PROVIDERS, DEFAULT_PROVIDER };
