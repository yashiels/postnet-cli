# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- AGENTS.md for agentic development context
- Makefile with standard `install`, `fmt`, `lint`, `test`, `ci`, and `clean` targets
- Prettier dev dependency and `.prettierrc` config (`singleQuote`, `trailingComma: all`, `printWidth: 100`)
- Granular exit codes for headless/agent use: `0` found · `1` valid no-data · `2` usage error · `3` upstream/network failure (previously `0`/`1` only)
- Provider validation — an unknown `--provider` name is now a usage error instead of a silent empty result; `--provider` + `--all` and unknown flags are rejected
- Same-host HTTP redirect following (max 3 hops; cross-host redirects refused so the tracking number is never leaked to another host)
- Deterministic mocked-transport and CLI exit-code tests; the live API test is now opt-in via `POSTNET_LIVE=1`

### Changed
- Provider fallback and `--all` now issue requests **concurrently** instead of sequentially — worst-case latency ~15s rather than ~75s
- JSON mode always writes valid JSON to stdout (`null` / `{}` when not found); human-readable errors go to stderr, so `| jq` pipelines never break
- Operational failures (non-2xx status, non-JSON body, timeout, connection error) are now surfaced as exit `3` instead of being silently indistinguishable from "not found"
- Per-request timeout is now a hard overall deadline, not just an inactivity timeout

### Fixed
- `--all --json` no longer exits `0` when nothing is found (now exits `1`)
- `track <n> --json` on no-data no longer prints a plain-text line to stdout (now prints `null`)
- Response body decoded with `setEncoding('utf8')` to avoid corrupting UTF-8 split across chunks; upstream event payloads are shape-validated; response size is capped

## [1.0.0] — 2026-06-08

### Added
- `postnet track <number>` command with auto-provider detection
- Automatic fallback across five courier providers: Aramex → DHL → CIT → Sprint → Coastal
- `--json` flag for machine-readable output
- `--provider <name>` flag to target a specific courier directly
- `--all` flag to query every provider and display all results side-by-side
- Zero-dependency pure Node.js implementation (no npm runtime packages)
- Homebrew formula via `yashiels/tap` for one-line macOS install
- Standalone binaries for macOS arm64 and Linux x64 built with Bun
- Automated release pipeline (GitHub Actions: Ship workflow → version bump → GitHub Release → Homebrew tap update)

[1.0.0]: https://github.com/yashiels/postnet-cli/releases/tag/v1.0.0
