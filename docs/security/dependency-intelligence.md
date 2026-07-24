# Dependency Intelligence (Dependency Guard)

Date: 2026-07-23

## What this is

SoterAI Dependency Guard is **DETECTION_ONLY / advisory**. It is **not** a full SCA product (no SBOM graph, no transitive lockfile resolution, no license policy engine, no install blocking at the OS package manager).

## Sources

| Layer | When | What |
|---|---|---|
| Local heuristics | Always | Typosquat-like names, unpinned (`latest`/`*`), remote `git+`/HTTP installs, `curl\|sh` style install commands, pre/postinstall script mentions |
| [OSV](https://osv.dev) (`api.osv.dev`) | Optional online | CVE/GHSA IDs for **concrete** package versions |

Setting: `soterai.dependencyGuard.osvMode` = `ask` (default) | `always` | `never`.

Online mode sends **package name + version + ecosystem only** — no secrets, no source code.

## Ecosystems

Primary: **npm** (package.json + `npm/yarn/pnpm install`).

Also recognized in install-command parsing: **pip** (heuristic “unknown package” only).

OSV ecosystem map used by the client: `npm` → `"npm"`, with room for `PyPI` / `Maven` / `Go` / `crates.io` when callers pass them. Unpinned versions **skip** OSV (never invent CVEs).

## Enforcement honesty

- Cannot block `npm install` / `pip install` / OS package managers outside SoterAI-reviewed commands.
- Fail-closed on network errors: empty vulns + error string.
- Registry id: `dependency-guard` → `DETECTION_ONLY`, `wiredInRuntime: true`.

## Evidence

- `packages/vscode-extension/src/dep-guard/DepGuardCore.ts` (pure heuristics + OSV client)
- `packages/vscode-extension/src/__tests__/dep-guard.test.ts`
