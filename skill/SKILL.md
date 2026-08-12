---
name: postnet
description: Track PostNet (South Africa) parcels from the terminal. One command, no login — hits the PostNet tracker API directly across Aramex, DHL, CIT, Sprint, and Coastal.
---

# postnet skill

Track PostNet Southern Africa parcels from the command line. `postnet track <number>` calls PostNet's own tracker JSON endpoint directly (the same one the website uses) and prints a status summary plus a full event history. It auto-detects the courier behind the parcel, falling back through providers until it finds events. Pure Node.js, zero runtime dependencies, no browser.

## Install

```bash
brew install yashiels/tap/postnet
```

Or download a standalone binary (macOS arm64, Linux x64) from the [latest release](https://github.com/yashiels/postnet-cli/releases/latest).

**Build from source** (Node ≥ 18 required):

```bash
git clone https://github.com/yashiels/postnet-cli.git
cd postnet-cli
npm install
npm link   # puts `postnet` on your PATH
```

## Credentials

**No login required.** PostNet's tracker endpoint is public — there is no account, API key, config file, or environment variable to set. Nothing is cached or written to disk. Every command works out of the box, headless included.

## Commands

Single command — `track`:

| Command | Description |
|---------|-------------|
| `postnet track <number>` | Track a parcel; auto-detects the provider |
| `postnet track <number> --json` | Emit raw JSON array of tracking events |
| `postnet track <number> --provider <name>` | Skip auto-detection; query one courier |
| `postnet track <number> --all` | Query every provider and print all results |
| `postnet --help` (`-h`) | Show usage |
| `postnet --version` (`-v`) | Print version |

Providers: `aramex` (default), `dhl`, `cit`, `sprint`, `coastal`.

**Behaviour notes:**

- The tracking number is whitespace-stripped and upper-cased before the request.
- Without `--provider`, `track` tries `aramex` first, then falls back through `dhl` → `cit` → `sprint` → `coastal`, returning the first provider with events.
- With `--provider <name>`, only that courier is queried (no fallback).
- `--all` fans out to every provider and prints one `━━━ PROVIDER ━━━` section per courier that returned data. With `--json` it emits a `{ provider: events[] }` map.
- Each event has the shape `{ date, time, location, description }`.

**Exit codes:** `0` = tracking data found · `1` = no data found, request error, missing tracking number, or unknown command.

## Headless / agent usage

Fully safe unattended — this is a **read-only lookup tool**. There are no bookings, payments, or state-changing actions, and no credentials to seed:

- `postnet track <number>` and all its flags are safe to run in any headless/agent context. No TTY, config file, or first-run interactive step is ever needed.
- Use `--json` for machine-readable output. `track <number> --json` returns the event array; `track <number> --all --json` returns a provider→events map.
- Check the exit code to distinguish "found" (`0`) from "no data / error" (`1`) — on no data the tool prints `No tracking data for <NUMBER>.` and exits `1`.
- Network calls hit `https://www.postnet.co.za` with a 15s per-request timeout; a timeout surfaces as `Error: request timed out` and exit `1`. `--all` and multi-provider fallback issue one request per provider sequentially, so a fully-failing lookup can take up to ~75s.
- No confirm-gating required for any command.

## Typical flow

```bash
# Track a parcel (auto-detect provider)
postnet track PPA14811107154

# Scripted / agent use — JSON out, check exit code
postnet track PPA14811107154 --json | jq '.[0].description'

# Not found on the default courier? Fan out to all providers
postnet track PPA14811107154 --all

# Or target one courier directly
postnet track PPA14811107154 --provider dhl
```
