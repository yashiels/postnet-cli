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
- Without `--provider`, `track` tries `aramex` first; if it returns nothing, the remaining providers (`dhl`, `cit`, `sprint`, `coastal`) are queried **concurrently** and the first in that order with events wins.
- With `--provider <name>`, only that courier is queried (no fallback). The name is validated against the provider list — an unknown name is a usage error (exit `2`), not a silent empty result. `--provider` cannot be combined with `--all`.
- `--all` fans out to every provider **concurrently** and prints one `━━━ PROVIDER ━━━` section per courier that returned data. With `--json` it emits a `{ provider: events[] }` map (`{}` when none found).
- Each event has the shape `{ date, time, location, description }`.
- Each HTTP request has a hard 15s deadline (not just an inactivity timeout) and follows at most 3 same-host HTTPS redirects; cross-host redirects are refused.

**Exit codes:** `0` = tracking data found · `1` = valid no-data (empty result) · `2` = usage error (missing/invalid arguments, unknown provider, unknown command) · `3` = upstream/network failure (non-2xx, non-JSON body, timeout, connection error). A genuine "parcel not found" (`1`) is distinct from "the lookup failed" (`3`) — an operational failure never masquerades as an empty result.

## Headless / agent usage

Fully safe unattended — this is a **read-only lookup tool**. There are no bookings, payments, or state-changing actions, and no credentials to seed:

- `postnet track <number>` and all its flags are safe to run in any headless/agent context. No TTY, config file, or first-run interactive step is ever needed.
- Use `--json` for machine-readable output. **JSON mode always emits valid JSON to stdout** — `track <number> --json` returns the event array (or `null` when not found); `track <number> --all --json` returns a provider→events map (or `{}`). Human-readable errors go to **stderr** only, so a `| jq` pipe never sees non-JSON.
- Branch on the exit code, not on stdout text: `0` found · `1` valid no-data · `2` usage error · `3` upstream/network failure. Critically, `1` (nothing to track) and `3` (the request failed) are different — retry on `3`, accept `1` as authoritative.
- Network calls hit `https://www.postnet.co.za` with a hard 15s per-request deadline. Providers are queried concurrently (fallback and `--all` alike), so worst-case latency is ~15s, not the sum of all providers. A transient upstream failure exits `3` (safe to retry); genuinely-not-found exits `1`.
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
