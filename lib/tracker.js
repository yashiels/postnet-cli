const https = require('https');
const { URL } = require('url');

const PROVIDERS = ['aramex', 'dhl', 'cit', 'sprint', 'coastal'];
const DEFAULT_PROVIDER = 'aramex';
const HOST = 'www.postnet.co.za';
const TRACKER_URL = `https://${HOST}/tracker`;
const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

class UpstreamError extends Error {
  constructor(message, provider) {
    super(message);
    this.name = 'UpstreamError';
    this.upstream = true;
    this.provider = provider;
  }
}

function providerUrl(trackingNumber, provider, token) {
  return (
    `https://${HOST}/postnet-track/exit/?rawpost=1` +
    `&tracking_number=${encodeURIComponent(trackingNumber)}` +
    `&provider=${encodeURIComponent(provider)}` +
    `&t=${encodeURIComponent(token)}`
  );
}

function requestText(url, headers, deadline, provider, redirectsLeft = MAX_REDIRECTS) {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      reject(new UpstreamError('request timed out', provider));
      return;
    }

    const req = https.get(url, { headers }, (res) => {
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
        resolve(requestText(target.toString(), headers, deadline, provider, redirectsLeft - 1));
        return;
      }

      if (status < 200 || status >= 300) {
        res.resume();
        reject(new UpstreamError(`HTTP ${status}${provider ? ` from ${provider}` : ''}`, provider));
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
        if (!aborted) resolve({ body: data, headers: res.headers });
      });
    });

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
}

async function fetchSession(timeoutMs = 15000, deadline = Date.now() + timeoutMs) {
  try {
    const { body, headers } = await requestText(
      TRACKER_URL,
      { Accept: 'text/html,application/xhtml+xml', 'User-Agent': USER_AGENT },
      deadline,
    );
    const tokenInput = body.match(/<input\b[^>]*\bid=(['"])track-token\1[^>]*>/i)?.[0];
    const token = tokenInput?.match(/\bvalue=(['"])([a-f0-9]{32})\1/i)?.[2];
    const setCookies = Array.isArray(headers['set-cookie'])
      ? headers['set-cookie']
      : [headers['set-cookie']].filter(Boolean);
    const sessionMatch = setCookies
      .map((value) => value.match(/(?:^|\s)PHPSESSID=([^;]+)/i))
      .find(Boolean);

    if (!token) throw new Error('track token missing');
    if (!sessionMatch) throw new Error('PHPSESSID cookie missing');

    return { token, cookie: `PHPSESSID=${sessionMatch[1]}` };
  } catch (err) {
    throw new UpstreamError(`session/token fetch failed: ${err.message}`);
  }
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
async function fetchProvider(
  trackingNumber,
  provider,
  timeoutMs = 15000,
  session,
  deadline = Date.now() + timeoutMs,
) {
  const activeSession = session || (await fetchSession(timeoutMs, deadline));
  const { body } = await requestText(
    providerUrl(trackingNumber, provider, activeSession.token),
    {
      Referer: TRACKER_URL,
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'application/json, text/plain, */*',
      'User-Agent': USER_AGENT,
      Cookie: activeSession.cookie,
    },
    deadline,
    provider,
  );
  const trimmed = body.trim();
  if (!trimmed) return null;

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new UpstreamError(`non-JSON response from ${provider}`, provider);
  }
  const events = normalizeEvents(parsed, provider);
  return events.length > 0 ? events : null;
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
  const timeoutMs = opts.timeoutMs ?? 15000;
  const deadline = Date.now() + timeoutMs;
  const session = await fetchSession(timeoutMs, deadline);

  if (opts.provider) {
    const events = await fetchProvider(num, opts.provider, timeoutMs, session, deadline);
    return events ? { provider: opts.provider, events } : null;
  }

  const preferred = DEFAULT_PROVIDER;
  const errors = [];

  try {
    const events = await fetchProvider(num, preferred, timeoutMs, session, deadline);
    if (events) return { provider: preferred, events };
  } catch (err) {
    errors.push(err);
  }

  const rest = PROVIDERS.filter((p) => p !== preferred);
  const settled = await Promise.allSettled(
    rest.map((p) => fetchProvider(num, p, timeoutMs, session, deadline)),
  );

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
  const timeoutMs = opts.timeoutMs ?? 15000;
  const deadline = Date.now() + timeoutMs;
  let session;
  try {
    session = await fetchSession(timeoutMs, deadline);
  } catch (err) {
    return {
      found: {},
      errors: PROVIDERS.map((provider) => ({ provider, message: err.message })),
    };
  }
  const settled = await Promise.allSettled(
    PROVIDERS.map((p) => fetchProvider(num, p, timeoutMs, session, deadline)),
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
  fetchSession,
  UpstreamError,
  PROVIDERS,
  DEFAULT_PROVIDER,
};
