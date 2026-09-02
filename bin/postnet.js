#!/usr/bin/env node
'use strict';

const { track, trackAll, PROVIDERS } = require('../lib/tracker');

// Exit codes: 0 found · 1 valid no-data · 2 usage error · 3 upstream/network failure
const EXIT = { FOUND: 0, NO_DATA: 1, USAGE: 2, UPSTREAM: 3 };

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
  console.log('  ' + '─'.repeat(dateW) + '  ' + '─'.repeat(locW) + '  ' + '─'.repeat(40));

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
    postnet track <tracking-number> --provider X   Use specific provider (no fallback)
    postnet track <tracking-number> --all          Query all providers

  Providers: ${PROVIDERS.join(', ')} (default: ${PROVIDERS[0]})

  Exit codes:
    0  tracking data found
    1  no tracking data (valid empty result)
    2  usage error (bad arguments)
    3  upstream / network failure

  Examples:
    postnet track PPA14811107154
    postnet track PPA14811107154 --json
    postnet track PPA14811107154 --all
`);
}

class UsageError extends Error {}

function parseTrackArgs(args) {
  const opts = { json: false, all: false, provider: undefined };
  let number;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') {
      opts.json = true;
    } else if (a === '--all' || a === '--all-providers') {
      opts.all = true;
    } else if (a === '--provider') {
      const val = args[i + 1];
      if (val === undefined || val.startsWith('-')) {
        throw new UsageError('--provider requires a value');
      }
      opts.provider = val.toLowerCase();
      i++;
    } else if (a.startsWith('-')) {
      throw new UsageError(`unknown option: ${a}`);
    } else if (number === undefined) {
      number = a;
    } else {
      throw new UsageError(`unexpected argument: ${a}`);
    }
  }

  if (number === undefined) {
    throw new UsageError('tracking number required. Usage: postnet track <number>');
  }
  if (opts.provider && opts.all) {
    throw new UsageError('--provider cannot be combined with --all');
  }
  if (opts.provider && !PROVIDERS.includes(opts.provider)) {
    throw new UsageError(`unknown provider: ${opts.provider} (valid: ${PROVIDERS.join(', ')})`);
  }

  return { number, opts };
}

async function runTrack(args) {
  const { number, opts } = parseTrackArgs(args);
  const upper = number.toUpperCase();

  if (opts.all) {
    const { found, errors } = await trackAll(number);
    const providers = Object.keys(found);

    if (opts.json) {
      console.log(JSON.stringify(found, null, 2));
    }

    if (providers.length === 0) {
      if (errors.length === PROVIDERS.length) {
        console.error(
          `Error: all providers failed for ${upper}: ` +
            errors.map((e) => `${e.provider}: ${e.message}`).join('; '),
        );
        return EXIT.UPSTREAM;
      }
      if (!opts.json) console.log(`No results for ${upper} across any provider.`);
      return EXIT.NO_DATA;
    }

    if (!opts.json) {
      for (const p of providers) {
        console.log(`━━━ ${p.toUpperCase()} ━━━`);
        formatTable(found[p]);
      }
    }
    return EXIT.FOUND;
  }

  let result;
  try {
    result = await track(number, { provider: opts.provider });
  } catch (err) {
    if (opts.json) console.log('null');
    console.error(`Error: ${err.message}`);
    return EXIT.UPSTREAM;
  }

  if (!result) {
    if (opts.json) console.log('null');
    else console.log(`No tracking data for ${upper}.`);
    return EXIT.NO_DATA;
  }

  if (opts.json) {
    console.log(JSON.stringify(result.events, null, 2));
    return EXIT.FOUND;
  }

  formatTable(result.events, {
    provider: result.provider !== PROVIDERS[0] ? result.provider : undefined,
  });
  return EXIT.FOUND;
}

async function main(argv = process.argv.slice(2)) {
  const args = argv;
  const cmd = args[0];

  if (!cmd || cmd === '--help' || cmd === '-h') {
    printHelp();
    return EXIT.FOUND;
  }

  if (cmd === '--version' || cmd === '-v') {
    console.log(require('../package.json').version);
    return EXIT.FOUND;
  }

  if (cmd !== 'track') {
    console.error(`Unknown command: ${cmd}. Try: postnet --help`);
    return EXIT.USAGE;
  }

  try {
    return await runTrack(args.slice(1));
  } catch (err) {
    if (err instanceof UsageError) {
      console.error(`Error: ${err.message}`);
      return EXIT.USAGE;
    }
    if (err && err.upstream) {
      console.error(`Error: ${err.message}`);
      return EXIT.UPSTREAM;
    }
    console.error(`Error: ${err.message}`);
    return EXIT.UPSTREAM;
  }
}

if (require.main === module) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      console.error(`Error: ${err.message}`);
      process.exitCode = EXIT.UPSTREAM;
    },
  );
}

module.exports = { main, parseTrackArgs, formatTable, UsageError, EXIT };
