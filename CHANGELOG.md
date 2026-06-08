# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
