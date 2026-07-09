# Cross-IDE support tiering

Status date: 2026-07-06. Tiers express investment and service level, not present-tense compatibility. The final report and test evidence remain authoritative.

## Universal release gate

An IDE may be described as supported only when its real package builds, installs in a clean profile, connects to an authenticated loopback broker, completes a core scan, passes canary redaction/no-leak tests, can be distributed, and has installation, privacy, and limitation documentation. Automated mocks are useful but do not replace a real-host install test.

| Tier | Platforms | MVP | Publishing path | Required testing | Maintenance cost | User value | Monetization potential |
|---|---|---|---|---|---|---|---|
| Tier 1: first-class | VS Code; Cursor and named Open VSX-compatible forks after individual tests; IntelliJ IDEA, PyCharm, WebStorm, GoLand, PhpStorm, CLion, DataGrip, and Rider after product-specific verification | Selection/file/workspace/git scan; redaction; safe prompt; Safe Mode; context/memory inspector; broker control/status; MCP scan; terminal preflight where exposed; ledger/report; policy; canary tests | VS Marketplace + manual VSIX; Open VSX + manual VSIX; signed JetBrains ZIP + Marketplace | Windows/macOS/Linux where host exists; clean profiles; restricted/untrusted and remote topology tests; wrong-token/offline/stopped-broker cases; Plugin Verifier for declared JetBrains range; canary and package-content audit | High: two adapter families, rapid host updates, multiple product matrices | Highest reach and richest integration; covers mainstream AI-assisted development | High: team policy, audit, approval, and managed broker features fit paid plans |
| Tier 2: strong | Visual Studio; Neovim; Sublime Text | Selection/file scan; redaction; safe prompt; Safe Mode/broker status; report/memory view; git and terminal checks where APIs allow | Visual Studio Marketplace VSIX; GitHub tags/plugin-manager docs; Package Control | Clean experimental VS instance on supported Windows versions; Neovim headless plus real UI install on three OSes; local Sublime package plus Package Control-form package; auth/canary/offline tests | Medium-High: three runtimes and different release channels | Strong in .NET, terminal-first, and lightweight-editor segments | Medium-High: strong professional audiences, but lower centralized admin surface outside Visual Studio |
| Tier 3: later/basic | Eclipse; JupyterLab; Vim; Zed and Emacs only if feasibility gates pass | Explicit buffer/cell/selection scan; redaction; broker health; safe prompt; redacted report. No parity promise for terminal interception, native memory UI, or vault UX | Eclipse signed p2 site + Marketplace listing; JupyterLab prebuilt Python package/PyPI; Git-based Vim/Emacs distribution; Zed MCP/agent integration only if honestly labeled | Real local install; platform/version matrix; notebook output privacy; remote-Jupyter topology; Vim build-feature variants; canary/auth/offline tests | High relative to audience because APIs, packaging, and deployments fragment | Valuable niches, particularly data science and Java enterprise, but later ROI | Low-Medium initially; validate demand before deep parity work |

## Tier 1 operating definition

- Patch critical compatibility/security failures promptly and test prerelease host versions before major host releases.
- Keep feature behavior aligned through `ide-common` protocol contracts; allow honest platform-specific “partial” states.
- Test every IDE explicitly named in marketplace metadata. For JetBrains, one passing IntelliJ test does not establish Rider or DataGrip support.
- Cursor, VSCodium, and Windsurf are separate test targets even when the same VSIX is used.

## Tier 2 operating definition

- Support the documented MVP and broker protocol with regular releases, but accept reduced native enforcement surfaces.
- Prefer reliable commands and redacted panels over brittle hooks into private APIs.
- Publish compatibility windows and known gaps in each listing.

## Tier 3 promotion gates

A Tier 3 platform moves upward only after demand is measured, a maintainer owns its native runtime, CI can exercise meaningful behavior, a real install matrix exists, and the adapter can keep credentials out of plaintext configuration. JupyterLab additionally needs a resolved local/remote broker topology. Zed needs a documented general extension surface capable of the promised UI and editor context; an MCP server alone does not qualify as full IDE Guard support.

## Cost controls

- One versioned protocol and fixture suite for every adapter.
- Detectors, redaction, policy, Safe Mode, evidence minimization, and hash caching remain in `guard-core`/broker.
- Adapters own only host lifecycle, context collection, redacted rendering, credential pairing, and commands.
- Unsupported capabilities are represented in metadata and UI; adapters do not simulate success.

