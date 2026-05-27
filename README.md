# postnet-cli

Track PostNet parcels from the command line. No browser, no auth, just fast results.

## Install

```sh
npm install -g postnet-cli
```

Or run directly with npx:

```sh
npx postnet-cli track PPA14811107154
```

## Usage

```sh
# Track a parcel
postnet track PPA14811107154

# Output raw JSON (great for scripting / cron jobs)
postnet track PPA14811107154 --json

# Use a specific provider
postnet track PPA14811107154 --provider dhl

# Query all providers
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

## Programmatic usage

```js
const { track, trackAll } = require('postnet-cli');

const result = await track('PPA14811107154');
// { provider: 'aramex', events: [{ date, time, location, description }, ...] }

const all = await trackAll('PPA14811107154');
// { aramex: [...], dhl: [...], ... }
```

## Providers

PostNet routes parcels through multiple courier providers. The CLI tries **Aramex** first (most common for domestic PostNet-to-PostNet), then falls back through DHL, CIT, Sprint, and Coastal.

## How it works

Hits the same API endpoint as the [PostNet tracker page](https://www.postnet.co.za/tracker) — no scraping, no headless browser, no API key needed.

## License

MIT
