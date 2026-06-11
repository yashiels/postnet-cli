# AGENTS.md — postnet

PostNet parcel tracker CLI. Pure Node.js, zero dependencies, hits the PostNet tracker API directly.

## Structure

```
postnet-cli/
├── bin/
│   └── postnet.js        # CLI entry point — argument parsing, output formatting
├── lib/
│   └── tracker.js        # Core tracking logic — fetchProvider, track, trackAll
├── test/
│   └── track.test.js     # Node built-in test runner (no test framework)
├── .github/
│   └── workflows/
│       ├── ci.yml        # Lint + test on push/PR
│       ├── ship.yml      # Version bump → Bun compile → GitHub Release → Homebrew tap
│       └── release-impl.yml
├── assets/
│   └── postnet-logo.png
├── docs/
│   └── assets/
├── AGENTS.md             # This file
├── CHANGELOG.md
├── Makefile
├── package.json
├── README.md
└── version.env
```

## Build / Test / Lint

```bash
make ci        # lint + test (full pre-push gate)
make lint      # node --check on all JS source files
make test      # node test/track.test.js
make fmt       # prettier --write (format all files)
make clean     # no build artefacts to clean (prints message)
```

All targets are also available as npm scripts (`npm run lint`, `npm test`, `npm run fmt`).

## Key Design Decisions

- **Zero dependencies** — pure Node.js, no npm runtime packages. `require('https')` and `require('node:test')` are the only imports. This is intentional and must stay.
- **Auto-provider detection** — `track()` tries Aramex first, then falls back through DHL → CIT → Sprint → Coastal until it gets results. The order matches PostNet's own default.
- **Standalone binaries** — release pipeline compiles with [Bun](https://bun.sh/) (`bun build --compile`) for macOS arm64 and Linux x64. Do not switch to `pkg`, `nexe`, or any other bundler.
- **`--all` flag** — `trackAll()` queries every provider in parallel and returns a map of provider → events. Display is a set of `━━━ PROVIDER ━━━` sections.
- **`--provider` flag** — skip auto-detection and target a specific provider directly.
- **`--json` flag** — raw JSON output for scripting and piping.

## Constraints

1. **Do not add npm runtime dependencies.** Zero-dep is a feature, not a gap. If you think you need a library, write the tiny helper inline.
2. **Do not remove multi-provider fallback.** The `PROVIDERS` array and the fallback loop in `track()` must stay intact.
3. **Keep `--json` and `--provider` flags.** Other tools and scripts depend on them.
4. **Binary builds use Bun, not pkg/nexe.** The `ship.yml` workflow uses `bun build --compile`. Do not change the compile step.
5. **Node ≥ 18 required.** `--check` flag and built-in test runner are used.

## CI

- **`ci.yml`** — runs `make ci` (lint + test) on every push to `main` and on all PRs.
- **`ship.yml`** — triggered manually or on version tag; bumps version, compiles with Bun, creates a GitHub Release, and updates the Homebrew tap (`yashiels/tap`).

Run the full gate locally before pushing:

```bash
make ci
```
