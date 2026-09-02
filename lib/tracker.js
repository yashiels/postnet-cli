const https = require('https');
const { URL } = require('url');

const PROVIDERS = ['aramex', 'dhl', 'cit', 'sprint', 'coastal'];
const DEFAULT_PROVIDER = 'aramex';
const HOST = 'www.postnet.co.za';
const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 5 * 1024 * 1024;

class UpstreamError extends Error {
  constructor(message, provider) {
    super(message);
    this.name = 'UpstreamError';
    this.upstream = true;
    this.provider = provider;
  }
}

function providerUrl(trackingNumber, provider) {
  return (
    `https://${HOST}/postnet-track/exit/?rawpost=1` +
    `&tracking_number=${encodeURIComponent(trackingNumber)}` +
    `&provider=${encodeURIComponent(provider)}`
  );
}

function normalizeEvents(parsed, provider) {
  if (!Array.isArray(parsed)) {
    throw new UpstreamError(`unexpected response from ${provider}: not an event array`, provider);
  }
  return parsed.map((e) => {
    const o = e && typeof e === 'object' ? e : {};
    return {
      date: String(o.date ?? ''),
      time: String(o.time ?? ''),
      location: String(o.location ?? ''),
      description: String(o.description ?? ''),
    };
  });
}

/**
 * Fetch tracking events for a single provider.
 *
 * Resolves to a non-empty event array when the parcel is found, or `null`
 * when the provider cleanly reports no data (HTTP 200 with an empty body).
 * Rejects with an UpstreamError for any operational failure — non-2xx status,
 * a non-JSON body, a malformed payload, a redirect loop, or a timeout — so
 * callers can distinguish "not found" from "the lookup failed".
 */
function fetchProvider(trackingNumber, provider, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;

  const request = (url, redirectsLeft) =>
    new Promise((resolve, reject) => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        reject(new UpstreamError('request timed out', provider));
        return;
      }

      const req = https.get(
        url,
        {
          headers: {
            Referer: `https://${HOST}/tracker`,
            'X-Requested-With': 'XMLHttpRequest',
            Accept: 'application/json, text/plain, */*',
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
              'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
          },
        },
        (res) => {
          const status = res.statusCode || 0;

          if (status >= 300 && status < 400 && res.headers.location) {
            res.resume();
            if (redirectsLeft <= 0) {
              reject(new UpstreamError('too many redirects', provider));
              return;
            }
            let target;
            try {
              target = new URL(res.headers.location, url);
            } catch {
              reject(new UpstreamError('invalid redirect location', provider));
              return;
            }
            if (target.protocol !== 'https:' || target.hostname !== HOST) {
              reject(new UpstreamError('refused cross-host redirect', provider));
              return;
            }
            resolve(request(target.toString(), redirectsLeft - 1));
            return;
          }

          if (status < 200 || status >= 300) {
            res.resume();
            reject(new UpstreamError(`HTTP ${status} from ${provider}`, provider));
            return;
          }

          res.setEncoding('utf8');
          let data = '';
          let aborted = false;
          res.on('data', (chunk) => {
            data += chunk;
            if (data.length > MAX_BODY_BYTES && !aborted) {
              aborted = true;
              req.destroy();
              reject(new UpstreamError('response too large', provider));
            }
          });
          res.on('end', () => {
            if (aborted) return;
            const trimmed = data.trim();
            if (!trimmed) {
              resolve(null);
              return;
            }
            let parsed;
            try {
              parsed = JSON.parse(trimmed);
            } catch {
              reject(new UpstreamError(`non-JSON response from ${provider}`, provider));
              return;
            }
            const events = normalizeEvents(parsed, provider);
            resolve(events.length > 0 ? events : null);
          });
        },
      );

      req.on('error', (err) => reject(new UpstreamError(err.message, provider)));

      const guard = setTimeout(
        () => {
          req.destroy();
          reject(new UpstreamError('request timed out', provider));
        },
        Math.max(1, deadline - Date.now()),
      );
      req.on('close', () => clearTimeout(guard));
    });

  return request(providerUrl(trackingNumber, provider), MAX_REDIRECTS);
}

function normalizeNumber(trackingNumber) {
  return trackingNumber.replace(/\s/g, '').toUpperCase();
}

/**
 * Track a parcel.
 *
 * With an explicit `opts.provider`, only that courier is queried (no fallback).
 * Otherwise the default provider is tried first, then the remaining providers
 * concurrently, returning the first in PROVIDERS order that has events.
 *
 * Resolves to `{ provider, events }` when found, or `null` when every queried
 * provider cleanly reports no data. Rejects with an UpstreamError only when the
 * lookup could not be completed (every attempt failed operationally, with no
 * clean "not found" from any provider).
 */
async function track(trackingNumber, opts = {}) {
  const num = normalizeNumber(trackingNumber);

  if (opts.provider) {
    const events = await fetchProvider(num, opts.provider, opts.timeoutMs);
    return events ? { provider: opts.provider, events } : null;
  }

  const preferred = DEFAULT_PROVIDER;
  const errors = [];

  try {
    const events = await fetchProvider(num, preferred, opts.timeoutMs);
    if (events) return { provider: preferred, events };
  } catch (err) {
    errors.push(err);
  }

  const rest = PROVIDERS.filter((p) => p !== preferred);
  const settled = await Promise.allSettled(rest.map((p) => fetchProvider(num, p, opts.timeoutMs)));

  for (let i = 0; i < rest.length; i++) {
    const outcome = settled[i];
    if (outcome.status === 'fulfilled') {
      if (outcome.value) return { provider: rest[i], events: outcome.value };
    } else {
      errors.push(outcome.reason);
    }
  }

  if (errors.length === PROVIDERS.length) {
    throw new UpstreamError(`all providers failed: ${errors.map((e) => e.message).join('; ')}`);
  }

  return null;
}

/**
 * Query every provider concurrently.
 * Resolves to { found: { provider: events[] }, errors: [{ provider, message }] }.
 */
async function trackAll(trackingNumber, opts = {}) {
  const num = normalizeNumber(trackingNumber);
  const settled = await Promise.allSettled(
    PROVIDERS.map((p) => fetchProvider(num, p, opts.timeoutMs)),
  );

  const found = {};
  const errors = [];
  for (let i = 0; i < PROVIDERS.length; i++) {
    const p = PROVIDERS[i];
    const outcome = settled[i];
    if (outcome.status === 'fulfilled') {
      if (outcome.value) found[p] = outcome.value;
    } else {
      errors.push({ provider: p, message: outcome.reason.message });
    }
  }

  return { found, errors };
}

module.exports = {
  track,
  trackAll,
  fetchProvider,
  UpstreamError,
  PROVIDERS,
  DEFAULT_PROVIDER,
};
