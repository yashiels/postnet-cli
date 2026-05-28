# postnet — track your parcel in one command

Track PostNet parcels from the command line. Hits the PostNet tracker API directly — no browser, no auth, no API key.

- **Zero dependencies** — pure Node.js standard library, no npm packages at runtime
- **Auto-fallback** — tries Aramex first, falls back through DHL → CIT → Sprint → Coastal automatically
- **Scriptable** — `--json` for machine-readable output; `--all` to query every provider at once

## Install

```bash
brew install yashiels/tap/postnet  # auto-taps yashiels/tap
```

Direct downloads from the [latest GitHub release](https://github.com/yashiels/postnet-cli/releases/latest).

Build from source:

```bash
git clone https://github.com/yashiels/postnet-cli.git
cd postnet-cli
npm install
```

## Quick Start

```bash
postnet track PPA14811107154
postnet track PPA14811107154 --json
postnet track PPA14811107154 --provider dhl
postnet track PPA14811107154 --all
```

Example output:

```
Status: Ready For Collection
Rondebosch, South Africa — 27 May 2026 09:59 AM

Date                  Location                   Description
27 May 2026 09:59 AM  Rondebosch, South Africa   Ready For Collection
27 May 2026 09:18 AM  Cape Town                  Delivered
27 May 2026 07:17 AM  Cape Town                  Out For Delivery
```

## Commands

| Command | Description |
|---------|-------------|
| `postnet track <number>` | Track a parcel (auto-detects provider) |
| `postnet track <number> --json` | Machine-readable JSON output |
| `postnet track <number> --provider <name>` | Use a specific courier provider |
| `postnet track <number> --all` | Query all providers and show results |
| `postnet --help` | Show help |
| `postnet --version` | Show version |

| Flag | Description |
|------|-------------|
| `--json` | Output raw JSON array of tracking events |
| `--provider <name>` | Skip auto-detection. Options: `aramex`, `dhl`, `cit`, `sprint`, `coastal` |
| `--all` | Query every provider and display all results |

Providers: `aramex` (default), `dhl`, `cit`, `sprint`, `coastal`
Exit codes: `0` data found, `1` no data / request error

## Disclaimer

Not affiliated with PostNet Southern Africa. Uses publicly accessible endpoints from the PostNet website.

## Development

```bash
npm install     # install dependencies
npm run lint    # syntax check
npm test        # run tests
```

Releases are automated via GitHub Actions. Go to **Actions → Ship**, pick `patch`, `minor`, or `major` — it bumps the version, builds a standalone binary, publishes a GitHub release, and updates the [Homebrew tap](https://github.com/yashiels/homebrew-tap).

## License

MIT — Yashiel Sookdeo
