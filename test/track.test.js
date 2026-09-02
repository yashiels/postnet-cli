#!/usr/bin/env node
'use strict';

const https = require('https');
const { track, trackAll, fetchProvider, UpstreamError, PROVIDERS } = require('../lib/tracker');
const cli = require('../bin/postnet.js');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  ✅ ${msg}`);
  } else {
    failed++;
    console.error(`  ❌ ${msg}`);
  }
}

async function rejects(fn, predicate, msg) {
  try {
    await fn();
    assert(false, `${msg} (expected throw)`);
  } catch (err) {
    assert(predicate(err), msg);
  }
}

// ── Mocked HTTPS transport ────────────────────────────────────────────────────

const realGet = https.get;

function providerOf(url) {
  return new URL(url).searchParams.get('provider');
}

function fakeRes({ status = 200, headers = {}, body = '' }) {
  const listeners = {};
  const res = {
    statusCode: status,
    headers,
    setEncoding() {},
    resume() {},
    on(ev, fn) {
      (listeners[ev] || (listeners[ev] = [])).push(fn);
      return res;
    },
  };
  res._emit = () =>
    process.nextTick(() => {
      if (body) (listeners.data || []).forEach((f) => f(body));
      (listeners.end || []).forEach((f) => f());
    });
  return res;
}

function installMock(handler) {
  https.get = (url, options, cb) => {
    if (typeof options === 'function') cb = options;
    const reqListeners = {};
    const req = {
      on(ev, fn) {
        (reqListeners[ev] || (reqListeners[ev] = [])).push(fn);
        return req;
      },
      destroy() {
        (reqListeners.close || []).forEach((f) => f());
      },
      setTimeout() {
        return req;
      },
    };
    process.nextTick(() => {
      const outcome = handler(url) || {};
      if (outcome.networkError) {
        (reqListeners.error || []).forEach((f) => f(new Error(outcome.networkError)));
        (reqListeners.close || []).forEach((f) => f());
        return;
      }
      const res = fakeRes(outcome);
      cb(res);
      res._emit();
      process.nextTick(() => (reqListeners.close || []).forEach((f) => f()));
    });
    return req;
  };
}

function restoreMock() {
  https.get = realGet;
}

const EVENT = {
  date: '01 Jan 2026',
  time: '10:00 AM',
  location: 'Cape Town',
  description: 'Delivered',
};
const foundBody = JSON.stringify([EVENT]);

// ── Console capture for CLI tests ─────────────────────────────────────────────

async function captureCli(argv) {
  const out = [];
  const err = [];
  const log = console.log;
  const error = console.error;
  console.log = (...a) => out.push(a.join(' '));
  console.error = (...a) => err.push(a.join(' '));
  let code;
  try {
    code = await cli.main(argv);
  } finally {
    console.log = log;
    console.error = error;
  }
  return { code, out: out.join('\n'), err: err.join('\n') };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function argParsing() {
  console.log('\n  Argument parsing:');
  const bad = (argv, why) =>
    assert(
      (() => {
        try {
          cli.parseTrackArgs(argv);
          return false;
        } catch (e) {
          return e instanceof cli.UsageError;
        }
      })(),
      why,
    );

  bad([], 'missing number → usage error');
  bad(['ABC', '--bogus'], 'unknown option → usage error');
  bad(['ABC', '--provider'], 'trailing --provider → usage error');
  bad(['ABC', '--provider', '--json'], '--provider --json → usage error');
  bad(['ABC', '--provider', 'bogus'], 'unknown provider → usage error');
  bad(['ABC', '--provider', 'dhl', '--all'], '--provider + --all → usage error');

  const parsed = cli.parseTrackArgs(['ABC', '--json', '--provider', 'DHL']);
  assert(
    parsed.number === 'ABC' && parsed.opts.json && parsed.opts.provider === 'dhl',
    'valid args parse (provider lowercased, json flag)',
  );
}

async function transport() {
  console.log('\n  Transport (fetchProvider):');
  installMock(() => ({ status: 200, body: foundBody }));
  assert((await fetchProvider('X', 'aramex'))?.length === 1, '200 + JSON array → events');

  installMock(() => ({ status: 200, body: '' }));
  assert((await fetchProvider('X', 'aramex')) === null, '200 + empty body → null (not found)');

  installMock(() => ({ status: 500, body: 'oops' }));
  await rejects(
    () => fetchProvider('X', 'aramex'),
    (e) => e instanceof UpstreamError,
    'HTTP 500 → UpstreamError',
  );

  installMock(() => ({ status: 200, body: '<html>error</html>' }));
  await rejects(
    () => fetchProvider('X', 'aramex'),
    (e) => e.upstream,
    'non-JSON body → UpstreamError',
  );

  installMock(() => ({ networkError: 'ECONNRESET' }));
  await rejects(
    () => fetchProvider('X', 'aramex'),
    (e) => e.upstream,
    'network error → UpstreamError',
  );

  installMock((url) =>
    url.includes('/redirected')
      ? { status: 200, body: foundBody }
      : {
          status: 302,
          headers: { location: 'https://www.postnet.co.za/redirected?provider=aramex' },
        },
  );
  assert((await fetchProvider('X', 'aramex'))?.length === 1, 'same-host redirect followed');

  installMock(() => ({ status: 302, headers: { location: 'https://evil.example.com/x' } }));
  await rejects(
    () => fetchProvider('X', 'aramex'),
    (e) => e.upstream,
    'cross-host redirect refused',
  );

  restoreMock();
}

async function trackLogic() {
  console.log('\n  track() / trackAll():');
  installMock((url) => (providerOf(url) === 'aramex' ? { body: foundBody } : { body: '' }));
  let r = await track('X');
  assert(r?.provider === 'aramex', 'default provider found first');

  installMock((url) => (providerOf(url) === 'dhl' ? { body: foundBody } : { body: '' }));
  r = await track('X');
  assert(r?.provider === 'dhl', 'falls back to dhl when aramex empty');

  installMock(() => ({ body: '' }));
  assert((await track('X')) === null, 'all-empty → null');

  installMock(() => ({ status: 503, body: '' }));
  await rejects(
    () => track('X'),
    (e) => e.upstream,
    'all providers failing → throws',
  );

  installMock((url) => (providerOf(url) === 'cit' ? { body: foundBody } : { body: '' }));
  r = await track('X', { provider: 'cit' });
  assert(r?.provider === 'cit', 'explicit provider queried directly');

  installMock((url) =>
    providerOf(url) === 'dhl' ? { body: foundBody } : { status: 500, body: '' },
  );
  const all = await trackAll('X');
  assert(all.found.dhl?.length === 1, 'trackAll collects found provider');
  assert(all.errors.length === 4, 'trackAll reports per-provider errors');

  restoreMock();
}

async function cliExitCodes() {
  console.log('\n  CLI exit codes & JSON contract:');
  installMock(() => ({ body: foundBody }));
  let r = await captureCli(['track', 'X', '--json']);
  assert(
    r.code === cli.EXIT.FOUND && Array.isArray(JSON.parse(r.out)),
    'found --json → array, exit 0',
  );

  installMock(() => ({ body: '' }));
  r = await captureCli(['track', 'X', '--json']);
  assert(r.code === cli.EXIT.NO_DATA && r.out === 'null', 'no-data --json → "null", exit 1');

  installMock(() => ({ body: '' }));
  r = await captureCli(['track', 'X', '--all', '--json']);
  assert(r.code === cli.EXIT.NO_DATA && r.out.trim() === '{}', 'empty --all --json → "{}", exit 1');

  installMock(() => ({ status: 500, body: '' }));
  r = await captureCli(['track', 'X', '--all', '--json']);
  assert(
    r.code === cli.EXIT.UPSTREAM && r.out.trim() === '{}',
    'all-error --all --json → "{}", exit 3',
  );

  installMock(() => ({ status: 500, body: '' }));
  r = await captureCli(['track', 'X', '--json']);
  assert(
    r.code === cli.EXIT.UPSTREAM && r.out === 'null',
    'upstream error --json → "null" (valid JSON), exit 3',
  );

  restoreMock();
  r = await captureCli(['track', 'X', '--provider', 'bogus']);
  assert(r.code === cli.EXIT.USAGE, 'unknown provider → exit 2');

  r = await captureCli(['boguscmd']);
  assert(r.code === cli.EXIT.USAGE, 'unknown command → exit 2');
}

async function liveApi() {
  if (!process.env.POSTNET_LIVE) {
    console.log('\n  Live API: skipped (set POSTNET_LIVE=1 to run)');
    return;
  }
  console.log('\n  Live API:');
  const result = await track('PPA14811107154');
  assert(result !== null, 'track() returns a result for known parcel');
  if (result) {
    assert(Array.isArray(result.events) && result.events.length > 0, 'result has events');
    const e = result.events[0];
    assert(
      ['date', 'time', 'location', 'description'].every((k) => typeof e[k] === 'string'),
      'event fields are strings',
    );
  }
}

async function run() {
  console.log('\npostnet-cli tests\n');

  assert(typeof track === 'function', 'track is a function');
  assert(typeof trackAll === 'function', 'trackAll is a function');
  assert(Array.isArray(PROVIDERS) && PROVIDERS.length === 5, 'PROVIDERS has 5 entries');

  try {
    await argParsing();
    await transport();
    await trackLogic();
    await cliExitCodes();
    await liveApi();
  } finally {
    restoreMock();
  }

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
