# 📦 postnet

**Track PostNet parcels in one command.**

Hits the PostNet tracker API directly — no browser, no auth, no API key. Zero dependencies.

![postnet CLI demo](docs/assets/screenshot.png)

## Install

```bash
brew install yashiels/tap/postnet
```

Or download a standalone binary from the [latest GitHub release](https://github.com/yashiels/postnet-cli/releases/latest) (macOS arm64, Linux x64).

Build from source:

```bash
git clone https://github.com/yashiels/postnet-cli.git
cd postnet-cli
npm install
```

## Quick Start

```bash
postnet track PPA14811107154
```

```
  📦 Status: Ready For Collection
  📍 Rondebosch, South Africa — 27 May 2026 09:59 AM

  Date                  Location                   Description
  ─────────────────────  ─────────────────────────  ────────────────────────────────────────
  27 May 2026 09:59 AM  Rondebosch, South Africa   Ready For Collection
  27 May 2026 09:18 AM  Cape Town                  Delivered
  27 May 2026 07:17 AM  Cape Town                  Out For Delivery
```

## Commands

```bash
postnet track <number>                    # track a parcel (auto-detects provider)
postnet track <number> --json             # machine-readable JSON output
postnet track <number> --provider <name>  # target a specific provider
postnet track <number> --all              # query all providers at once
postnet --version
postnet --help
```

| Flag | Description |
|------|-------------|
| `--json` | Output raw JSON array of tracking events |
| `--provider <name>` | Skip auto-detection. Options: `aramex`, `dhl`, `cit`, `sprint`, `coastal` |
| `--all` | Query every provider and display all results |

Providers: `aramex` (default), `dhl`, `cit`, `sprint`, `coastal`

Exit codes: `0` data found, `1` no data or request error.

## How It Works

PostNet's website exposes a lightweight JSON endpoint used by its own tracker page. `postnet` calls that endpoint directly with the same headers a browser would send. There's no account, no API key, and no scraping involved.

By default the tool tries **Aramex** first (handles most PostNet parcels), then falls back through DHL → CIT → Sprint → Coastal until it finds events or exhausts all providers. Pass `--provider` to skip straight to a specific courier. Pass `--all` to fan out to every provider in parallel and see everything at once.

## Development

```bash
npm run lint   # syntax check (node --check)
npm test       # unit + live API tests
```

Releases are automated. Go to **Actions → Ship**, pick `patch`, `minor`, or `major` — it bumps the version, builds standalone binaries with Bun, publishes a GitHub release, and updates the [Homebrew tap](https://github.com/yashiels/homebrew-tap).

## Disclaimer

Not affiliated with PostNet Southern Africa. Uses publicly accessible endpoints from the PostNet website.

## License

MIT — [Yashiel Sookdeo](https://github.com/yashiels)
