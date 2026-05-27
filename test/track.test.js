#!/usr/bin/env node
'use strict';

const { track, trackAll, PROVIDERS } = require('../lib/tracker');

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

async function run() {
  console.log('\npostnet-cli tests\n');

  // Module exports
  assert(typeof track === 'function', 'track is a function');
  assert(typeof trackAll === 'function', 'trackAll is a function');
  assert(Array.isArray(PROVIDERS), 'PROVIDERS is an array');
  assert(PROVIDERS.length === 5, 'PROVIDERS has 5 entries');

  // Live tracking test (uses a known delivered parcel)
  console.log('\n  Live API:');
  const result = await track('PPA14811107154');
  assert(result !== null, 'track() returns a result for known parcel');
  if (result) {
    assert(Array.isArray(result.events), 'result.events is an array');
    assert(result.events.length > 0, 'result.events has entries');
    assert(typeof result.provider === 'string', 'result.provider is a string');

    const first = result.events[0];
    assert(typeof first.date === 'string', 'event has date');
    assert(typeof first.time === 'string', 'event has time');
    assert(typeof first.location === 'string', 'event has location');
    assert(typeof first.description === 'string', 'event has description');
  }

  // trackAll
  const allResults = await trackAll('PPA14811107154');
  assert(typeof allResults === 'object', 'trackAll returns an object');
  assert(Object.keys(allResults).length >= 1, 'trackAll has at least one provider result');

  // Bogus tracking number
  const bogus = await track('XXXXNOTREAL999');
  assert(bogus === null, 'track() returns null for unknown parcel');

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
