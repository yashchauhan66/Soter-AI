# Changelog

All notable changes to `@soterai/mcp-gateway` are documented here.

## [0.2.0] — 2026-08-01

Hardening pass against top competitors (Lasso, mcp-proxy, Kong with MCP
support, Palo Alto AIRS, Cisco AI Defense) for the inline MCP enforcement
proxy.

### Added
- **`publishConfig.access: "public"`** for the scoped name.
- **`engines: { "node": ">=18.0.0" }`** — the gateway uses native `fetch` and
  `crypto.randomUUID`.
- **README.md** — full usage docs, architecture overview, why-this-vs-raw-MCP
  comparison, evidence-envelope schema, HTTP endpoint reference.
- **CHANGELOG.md** — this file.
- **LICENSE** — MIT.
- **`sideEffects: false`** for cleaner bundling.
- **`exports` map** with an explicit `./package.json` subpath export.
- **`repository`, `homepage`, `bugs`** URLs for npm provenance and issue
  reporting.

### Changed
- **Removed the unused `@soterai/guard-core` dependency** — the gateway is
  self-contained, only Node builtins are imported in compiled code. This makes
  install trivial and eliminates a dependency-confusion attack surface.
- Version bumped from `0.1.0` to `0.2.0` to reflect the production-hardening
  pass.

### Notes
- The gateway itself ships no baked-in policy — it exposes an
  `evaluatePolicy` callback that you wire to your policy engine (Presidio,
  an LLM classifier, Open Policy Agent, custom rules, …). This is what makes
  it transport-pure and testable.
