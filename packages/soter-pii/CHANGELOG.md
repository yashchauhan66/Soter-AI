# Changelog

All notable changes to `soter-pii` are documented here.

## [1.1.0] — 2026-08-01

Major hardening pass: the package now matches the feature/precision bar set by
the top competitors (Microsoft Presidio, AWS Comprehend, Google DLP) while
staying zero-dependency and deterministic.

### Added
- **Checksum validators** — `luhnCheck` and `verhoeffCheck` exported publicly;
  credit-card matches must pass Luhn + carry a known IIN/BIN prefix, and
  Aadhaar matches must pass Verhoeff. This eliminates the classic "any 13–19
  digit run" false-positive.
- **`RedactionOptions`** — `include`, `exclude`, `allowlist`, `mode` (`labelled`
  or `masked`), `maskChar`, and `customRules` (with validators).
- **New detection categories** — IPv6, MAC, IBAN (mod-97 validated), SWIFT/BIC,
  Card CVV, US SSN (structure-validated), Passport number, AWS keys, GitHub
  PAT/OAuth tokens, OpenAI / Anthropic / Slack / Google API keys, JWT, PEM
  private-key headers, and generic `api_key|secret|token|password=…` secrets.
- **`redactDeep`** — recursive PII redaction for JSON-like objects.
- **`containsPII`** — boolean gate for hot-path decisions.
- **`isReDoSSafe`** — exposes the custom-rule ReDoS screening heuristic.
- **Result metadata** — `matchCount` and per-label `counts` on the result.
- **ReDoS safety screening** for `customRules` — patterns with known
  catastrophic-backtracking shapes are rejected at registration time.
- Published metadata — `exports` map, `files`, `engines`, `sideEffects: false`,
  repository/homepage/bugs URLs.

### Changed
- Result object gained `matchCount` and `counts` (additive, non-breaking).
- All bundled patterns audited for ReDoS-safety (linear-time only); a fresh
  `RegExp` instance is used per rule per call to eliminate shared mutable
  `lastIndex` state under concurrency.

## [1.0.0] — 2026-06-01

Initial public release with Email, Phone, IPv4, Credit Card, DOB, Address, PAN
and Aadhaar detection.
