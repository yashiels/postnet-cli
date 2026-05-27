#!/usr/bin/env node
'use strict';

const { track, trackAll } = require('../lib/tracker');

// ── Formatting ───────────────────────────────────────────────────────────────

function formatTable(events, { provider } = {}) {
  if (!events || events.length === 0) {
    console.log('No tracking events found.');
    return;
  }

  const latest = events[0];
  const statusMatch = latest.description.match(/^([^(]+)/);
  const status = statusMatch ? statusMatch[1].trim() : latest.description;

  console.log();
  if (provider) console.log(`  (provider: ${provider})`);
  console.log(`  📦 Status: ${status}`);
  console.log(`  📍 ${latest.location} — ${latest.date} ${latest.time}`);
  console.log();

  const dateW = Math.max(4, ...events.map((e) => `${e.date} ${e.time}`.length));
  const locW = Math.max(8, ...events.map((e) => e.location.length));

  console.log(`  ${'Date'.padEnd(dateW)}  ${'Location'.padEnd(locW)}  Description`);
  console.log(
    '  ' + '─'.repeat(dateW) + '  ' + '─'.repeat(locW) + '  ' + '─'.repeat(40),
  );

  for (const e of events) {
    const dt = `${e.date} ${e.time}`.padEnd(dateW);
    const loc = e.location.padEnd(locW);
    const desc = e.description.replace(/\s*\([^)]*\)\s*$/, '');
    console.log(`  ${dt}  ${loc}  ${desc}`);
  }
  console.log();
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
  postnet - Track PostNet parcels from the command line

  Usage:
    postnet track <tracking-number>                Track a parcel (auto-detects provider)
    postnet track <tracking-number> --json         Output raw JSON
    postnet track <tracking-number> --provider X   Use specific provider
    postnet track <tracking-number> --all          Query all providers

  Providers: aramex (default), dhl, cit, sprint, coastal

  Examples:
    postnet track PPA14811107154
    postnet track PPA14811107154 --json
    postnet track PPA14811107154 --all
`);
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === '--help' || cmd === '-h') {
    printHelp();
    process.exit(0);
  }

  if (cmd === '--version' || cmd === '-v') {
    const pkg = require('../package.json');
    console.log(pkg.version);
    process.exit(0);
  }

  if (cmd !== 'track') {
    console.error(`Unknown command: ${cmd}. Try: postnet --help`);
    process.exit(1);
  }

  const num = args[1];
  if (!num) {
    console.error('Error: tracking number required. Usage: postnet track <number>');
    process.exit(1);
  }

  const json = args.includes('--json');
  const all = args.includes('--all') || args.includes('--all-providers');
  const provIdx = args.indexOf('--provider');
  const provider = provIdx !== -1 ? args[provIdx + 1]?.toLowerCase() : undefined;

  if (all) {
    const results = await trackAll(num);
    if (json) {
      console.log(JSON.stringify(results, null, 2));
      return;
    }
    const found = Object.keys(results);
    if (found.length === 0) {
      console.log(`No results for ${num.toUpperCase()} across any provider.`);
      process.exit(1);
    }
    for (const p of found) {
      console.log(`━━━ ${p.toUpperCase()} ━━━`);
      formatTable(results[p]);
    }
    return;
  }

  const result = await track(num, { provider });
  if (!result) {
    console.log(`No tracking data for ${num.toUpperCase()}.`);
    process.exit(1);
  }

  if (json) {
    console.log(JSON.stringify(result.events, null, 2));
    return;
  }

  formatTable(result.events, {
    provider: result.provider !== 'aramex' ? result.provider : undefined,
  });
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
