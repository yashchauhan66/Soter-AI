# Cross-IDE real user test plan (Phase 13)

Status date: 2026-07-06. This is the test design for real-user, real-host validation across the SoterAI cross-IDE mission. It defines what must be exercised before any editor is described as supported. It is not itself a result; results are recorded per run in `docs/cross-ide-test-results-template.md`. No editor graduates from this plan on mocks, static checks, or a single-host pass.

## Ground rules

- A real person performs each scenario in a real, installed editor on a real OS. Automated mocks and CLI enumeration are supporting evidence, not a substitute.
- Every editor named in any marketplace listing is a separate target. Cursor, VSCodium, and Windsurf do not inherit VS Code results; PyCharm does not inherit IntelliJ IDEA results.
- No fake PASS. If a step cannot be run, record NOT-RUN or BLOCKED with the reason. A single leak of a canary or secret is a FAIL for that cell.
- Local-first: the broker listens on loopback only, requires a token, and nothing goes to SoterAI Cloud by default. Any observed non-loopback traffic during scanning is a FAIL.
- No "100% secure" or "full interception" language in any result note. Terminal checking is preflight/wrapped only.

## Editor × OS matrix

| Editor | Adapter | Windows | macOS | Linux |
|---|---|---|---|---|
| VS Code | VS Code VSIX | Required | Required | Required |
| Cursor | VS Code VSIX | Required | Required | Optional |
| VSCodium / Open VSX | VS Code VSIX | Required | Optional | Required |
| IntelliJ IDEA | JetBrains ZIP | Required | Required | Required |
| PyCharm | JetBrains ZIP | Required | Optional | Optional |
| WebStorm | JetBrains ZIP | Required | Optional | Optional |
| Visual Studio | VS extension | Required | n/a | n/a |
| Neovim | Lua adapter | Required | Required | Required |
| Vim | Vimscript adapter | Optional | Optional | Required |
| Sublime Text | Package Control | Required | Optional | Required |
| Eclipse | p2 site | Optional | Optional | Optional |
| JupyterLab | prebuilt extension | Optional | Optional | Required |

"Required" cells must be attempted before the editor is described as supported on that OS; "Optional" cells are recorded when a host is available and are not silently claimed otherwise. Visual Studio is Windows-only.

## Sample projects

Each scenario runs against a representative project so scan behavior is exercised on real files, not empty buffers.

| Project | Stack | Typical editors |
|---|---|---|
| Node / Next.js | JavaScript/TypeScript | VS Code family, WebStorm, Neovim, Sublime |
| Python / FastAPI | Python | PyCharm, VS Code, Neovim, JupyterLab |
| Java / Spring | Java | IntelliJ IDEA, Eclipse |
| Go | Go | GoLand, VS Code, Neovim |
| PHP / Laravel | PHP | PhpStorm, VS Code, Sublime |
| .NET | C# | Visual Studio, Rider |
| Data-science notebook | Python notebook | JupyterLab, VS Code |

Each sample project must contain a seeded canary string (`SOTERAI-CANARY-<uuid>`) and a fake secret-shaped value so redaction and no-leak behavior can be checked.

## The 18 scenarios

| # | Scenario | What it exercises |
|---|---|---|
| 1 | Install | Adapter installs into a clean profile from its real package (VSIX / ZIP / package manager) |
| 2 | Start / connect broker | Broker reachable on `127.0.0.1:47321`; token configured; health check succeeds |
| 3 | Scan selection with canary | Select seeded canary/secret, scan, get a decision, redacted evidence only |
| 4 | Redact | Redact selection; original secret replaced in buffer |
| 5 | Scan file | Scan the current file; decision returned; no raw secret surfaced |
| 6 | Scan workspace | Workspace/project-level scan where the adapter supports it (may be planned/partial) |
| 7 | Safe Mode | Read status, enable (level developer), confirm status change and UI reflects it |
| 8 | Memory inspector | Recent events / ledger shows redacted references only |
| 9 | MCP scan | MCP configuration/tooling scan where supported |
| 10 | Terminal check | Preflight/wrapped command check where the host exposes it (partial by design) |
| 11 | Git diff scan | Scan of staged/working changes where supported |
| 12 | Export report | Generate a redacted report; confirm no raw secret in it |
| 13 | Uninstall / reinstall | Clean removal and reinstall; settings/token behavior sane |
| 14 | Offline mode | No internet; local broker still serves scans; no cloud dependency |
| 15 | Broker-stopped mode | Broker down; adapter shows a clear error, does not crash or fall back to an insecure path |
| 16 | Wrong-token mode | Bad/blank token; adapter surfaces an auth/config error, never silently proceeds |
| 17 | Restricted-workspace mode | Untrusted/restricted workspace; adapter respects host trust; no unexpected execution |
| 18 | Performance | Scan latency on realistic files is acceptable and non-blocking to the UI |

Scenarios 6, 9, 10, 11, and 12 map to planned/partial features on several adapters (see `docs/cross-ide-feature-parity-matrix.md`). Where a feature is not implemented for an adapter, record NOT-RUN with "feature not implemented", not FAIL.

## Pass / fail criteria per scenario

- **PASS:** the scenario completes as intended, and — for any scenario touching content — no raw canary or secret appears in UI, report, ledger, or logs, and no non-loopback scan traffic is observed.
- **FAIL:** the scenario errors when it should succeed, the adapter crashes, an insecure fallback occurs, or a canary/secret leaks anywhere.
- **BLOCKED:** a dependency (host, broker, feature) prevents the run; the blocker is named.
- **NOT-RUN:** not attempted (optional cell, unimplemented feature, or host unavailable); the reason is named.

Security scenarios have stricter rules: scenario 15 must show a graceful, secure failure (never a silent insecure path); scenario 16 must never proceed with an invalid token; scenario 14 must not depend on cloud reachability; scenario 3/4/5/8/12 must never surface a raw secret.

## Compatibility score rubric

Per editor × OS, score after a run. Do not average away a security failure.

| Score | Meaning |
|---|---|
| 5 — Supported | All required scenarios PASS, including every security and canary scenario; adapter is distributable |
| 4 — Strong | All security/canary scenarios PASS; at most minor non-security scenarios partial, documented |
| 3 — Partial | Core scan/redact/Safe Mode + all security scenarios PASS; several features NOT-RUN/partial |
| 2 — Early | Installs and connects, but one or more non-security scenarios FAIL |
| 1 — Blocked | Cannot install/connect, or a scenario is blocked such that the adapter cannot be exercised |
| 0 — Failed gate | Any canary/secret leak, insecure fallback, or non-loopback scan traffic |

An editor may be described as "supported" on an OS only at score 5 for that OS, with the results recorded and linked. Score 0 overrides everything: a leak or insecure fallback fails the gate regardless of other passes.

## References

- `docs/cross-ide-feasibility-matrix.md` — capability and distribution constraints per platform.
- `docs/cross-ide-support-tiering.md` — the universal release gate and tier definitions.
- `docs/cross-ide-feature-parity-matrix.md` — per-feature target symbols to reconcile with results.
- `docs/cross-ide-test-results-template.md` — the blank results record to fill per run.
