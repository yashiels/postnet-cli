<p align="center">
  <img src="assets/postnet-logo.svg" alt="PostNet" width="280" />
</p>

<h1 align="center">postnet-cli</h1>

<p align="center">
  Track PostNet parcels from the command line.<br/>
  No browser. No auth. No scraping. Just fast results.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/postnet-cli"><img src="https://img.shields.io/npm/v/postnet-cli?color=cb3837&label=npm" alt="npm version" /></a>
  <a href="https://github.com/yashiels/postnet-cli/blob/main/LICENSE"><img src="https://img.shields.io/github/license/yashiels/postnet-cli?color=blue" alt="license" /></a>
  <img src="https://img.shields.io/badge/dependencies-0-brightgreen" alt="zero dependencies" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white" alt="node >= 18" />
</p>

---

## How it works

```mermaid
sequenceDiagram
    participant User
    participant CLI as postnet-cli
    participant API as PostNet API
    participant Providers as Courier Providers

    User->>CLI: postnet track PPA148...
    CLI->>API: GET /postnet-track/exit/?tracking_number=...&provider=aramex
    API->>Providers: Query Aramex
    Providers-->>API: Tracking events JSON
    API-->>CLI: [ { date, time, location, description }, ... ]
    CLI-->>User: 📦 Status table
    Note over CLI,API: Falls back through DHL → CIT → Sprint → Coastal<br/>if the primary provider returns empty
```

## Install

```sh
npm install -g postnet-cli
```

Or run directly without installing:

```sh
npx postnet-cli track PPA14811107154
```

## Usage

```sh
# Track a parcel
postnet track PPA14811107154

# JSON output — great for scripting and cron jobs
postnet track PPA14811107154 --json

# Force a specific courier provider
postnet track PPA14811107154 --provider dhl

# Query all five providers at once
postnet track PPA14811107154 --all
```

### Example output

```
  📦 Status: Ready For Collection
  📍 Rondebosch, South Africa — 27 May 2026 09:59 AM

  Date                  Location                   Description
  ────────────────────  ─────────────────────────  ────────────────────────────────────────
  27 May 2026 09:59 AM  Rondebosch, South Africa   Ready For Collection
  27 May 2026 09:18 AM  Cape Town                  Delivered
  27 May 2026 07:17 AM  Cape Town                  Out For Delivery
  26 May 2026 11:14 PM  Cape Town                  Shipment Inbound Received
  26 May 2026 03:10 PM  Stellenbosch               Picked Up From Shipper
  26 May 2026 10:17 AM  Gordons Bay, South Africa  Shipment Created
```

## Providers

PostNet routes parcels through multiple courier networks. The CLI auto-detects which one has your data.

```mermaid
graph LR
    P[postnet-cli] --> A[Aramex<br/><i>default</i>]
    P --> B[DHL]
    P --> C[CIT]
    P --> D[Sprint]
    P --> E[Coastal]

    style A fill:#2563eb,color:#fff,stroke:none
    style B fill:#6b7280,color:#fff,stroke:none
    style C fill:#6b7280,color:#fff,stroke:none
    style D fill:#6b7280,color:#fff,stroke:none
    style E fill:#6b7280,color:#fff,stroke:none
    style P fill:#ef4444,color:#fff,stroke:none
```

Most domestic PostNet-to-PostNet parcels use **Aramex**, so it's tried first. If it returns empty, the CLI falls back through the remaining providers automatically.

## Programmatic API

```js
const { track, trackAll } = require('postnet-cli');

// Track with auto-detection
const result = await track('PPA14811107154');
// → { provider: 'aramex', events: [{ date, time, location, description }, ...] }

// Query all providers
const all = await trackAll('PPA14811107154');
// → { aramex: [...], dhl: [...], ... }

// Specific provider + custom timeout
const dhl = await track('PPA14811107154', { provider: 'dhl', timeoutMs: 10000 });
```

## CLI reference

```
postnet track <number>              Track a parcel (auto-detects provider)
postnet track <number> --json       Machine-readable JSON output
postnet track <number> --provider X Use a specific provider
postnet track <number> --all        Query all providers
postnet --help                      Show help
postnet --version                   Show version
```

| Flag | Description |
|------|-------------|
| `--json` | Output raw JSON array of tracking events |
| `--provider <name>` | Skip auto-detection, use: `aramex`, `dhl`, `cit`, `sprint`, `coastal` |
| `--all` | Query every provider and show all results |

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success — tracking data found |
| `1` | No tracking data or error |

## Architecture

```mermaid
graph TD
    CLI[bin/postnet.js<br/><i>CLI entry + formatter</i>]
    LIB[lib/tracker.js<br/><i>API client + provider fallback</i>]
    API[PostNet Web API<br/><i>postnet.co.za/postnet-track/exit/</i>]

    CLI --> LIB
    LIB -->|HTTPS GET| API

    style CLI fill:#1e293b,color:#fff,stroke:none
    style LIB fill:#334155,color:#fff,stroke:none
    style API fill:#dc2626,color:#fff,stroke:none
```

Zero dependencies. Uses Node's built-in `https` module. The entire package is two files:

- **`lib/tracker.js`** — API client with provider fallback logic. Importable for programmatic use.
- **`bin/postnet.js`** — CLI wrapper with human-readable table formatting.

## Contributing

Pull requests welcome. The project uses no build step — edit, test, ship.

```sh
git clone https://github.com/yashiels/postnet-cli.git
cd postnet-cli
npm test
```

## License

[MIT](LICENSE) — Yashiel Sookdeo
