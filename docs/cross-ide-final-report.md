# SoterAI IDE Guard — Cross-IDE final report

Status date: 2026-07-06.
Prepared by: SoterAI engineering.

This is the authoritative per-platform verdict. A platform is PASS only when its adapter builds, installs in a clean profile, completes a broker-backed scan, passes the canary privacy test, produces a distributable package, and has installation/privacy/limitation documentation. Everything else is PARTIAL PASS, FAIL, or PLANNED. No result is inferred from another platform.

---

## Summary table

| Platform | Adapter | Artifact | Build | Install | Broker scan | Canary | Docs | Verdict |
|---|---|---|---|---|---|---|---|---|
| VS Code | `packages/vscode-extension` | VSIX | ✅ | ✅ | ✅ | ✅ | ✅ | **PASS** |
| Cursor | same VSIX | VSIX | ✅ | NOT RUN | NOT RUN | NOT RUN | ✅ | **PLANNED** |
| Open VSX / VSCodium | same VSIX | VSIX | ✅ | NOT RUN | NOT RUN | NOT RUN | ✅ | **PLANNED** |
| Windsurf | same VSIX | VSIX | ✅ | NOT RUN | NOT RUN | NOT RUN | ✅ | **PLANNED** |
| JetBrains (all products) | `extensions/jetbrains` | plugin ZIP | NOT RUN | NOT RUN | NOT RUN | NOT RUN | ✅ | **PLANNED** |
| Visual Studio | `extensions/visual-studio` | VSIX | NOT RUN | NOT RUN | NOT RUN | NOT RUN | ✅ | **PLANNED** |
| Neovim | `extensions/neovim` | Git release | NOT RUN | NOT RUN | NOT RUN | NOT RUN | ✅ | **PLANNED** |
| Vim | `extensions/vim` | Git release | NOT RUN | NOT RUN | NOT RUN | NOT RUN | ✅ | **PLANNED** |
| Sublime Text | `extensions/sublime` | Package Control | NOT RUN | NOT RUN | NOT RUN | NOT RUN | ✅ | **PLANNED** |
| Eclipse | `extensions/eclipse` | p2 update site | NOT RUN | NOT RUN | NOT RUN | NOT RUN | ✅ | **PLANNED** |
| JupyterLab | `extensions/jupyterlab` | npm + PyPI | NOT RUN | NOT RUN | NOT RUN | NOT RUN | ✅ | **PLANNED** |
| CLI (`soterai-guard`) | `packages/soterai-cli` | npm binary | ✅ | ✅ | ✅ | ✅ | ✅ | **PASS** |

---

## Shared engine status

The shared security plane that all adapters depend on is complete and tested.

| Component | Location | Status |
|---|---|---|
| `@soterai/guard-core` | `packages/guard-core` | ✅ Built, tested, exported |
| `@soterai/local-ai-broker` | `apps/local-ai-broker` | ✅ Built, tested, loopback-only |
| `@soterai/ide-common` | `packages/ide-common` | ✅ Built, BrokerClient + token resolution |
| `@soterai/ide-protocol` | `packages/ide-protocol` | ✅ Built, broker contract schemas |
| `soterai-guard` CLI | `packages/soterai-cli` | ✅ Built, all commands implemented |

Detectors (secrets, PII, India PII, prompt injection, jailbreak, code risk, env file) live in `guard-core` and the broker. No adapter reimplements a detector.

---

## Per-platform detail

### VS Code — PASS

- Adapter: `packages/vscode-extension`
- Artifact: `soterai-ide-guard-0.1.0.vsix` (built, present in repo)
- Build: `npm run vscode:package` — passes
- Install: verified in VS Code clean profile
- Broker scan: verified against live broker
- Canary privacy: passes — raw canary absent from UI, reports, logs
- Marketplace: VS Code Marketplace publish path wired (`npm run vscode:publish`); Open VSX path wired (`npm run openvsx:publish`)
- Docs: `docs/publishing-vscode-marketplace.md`, `docs/vscode-family-test-report.md`
- Known limitations: cannot transparently intercept third-party AI extensions' private network calls or all terminal input; web/remote/restricted workspace hosts differ; Cursor/VSCodium/Windsurf are separate test targets

### Cursor / Open VSX / VSCodium — PLANNED

- Same VSIX as VS Code; package builds cleanly
- Per-host install, activation, broker, and canary tests have NOT been run in this environment
- Cursor marketplace proxy has review/indexing delay; do not claim availability until registry search/install succeeds in the product
- VSCodium qualification requires `SOTERAI_REQUIRE_EDITOR=1` so a missing host fails rather than skips
- Windsurf: do not claim support until a real Windsurf install and smoke test pass
- Blocking items: per-host test machines; Cursor/VSCodium/Windsurf installs

### JetBrains — PLANNED

- Adapter: `extensions/jetbrains` (Kotlin, IntelliJ Platform SDK, Gradle 8.9)
- Source complete: `BrokerClient.kt`, `GuardActions.kt`, `BrokerSettings.kt` (Password Safe), `SoterAIConfigurable.kt`, `SoterAIToolWindowFactory.kt`, `SoterAIStatusWidgetFactory.kt`, `plugin.xml`
- Test: `BrokerContractTest.kt` (static source assertions — loopback fixed, Bearer present, no token logging)
- Gradle wrapper: `gradlew` / `gradlew.bat` / `gradle/wrapper/gradle-wrapper.properties` present
- Build: `./gradlew buildPlugin` — NOT RUN (requires JDK 21 + IntelliJ Platform SDK download)
- Plugin Verifier: NOT RUN
- Install: NOT RUN in any IDE
- Broker integration: NOT RUN
- Canary privacy: NOT RUN
- Known gap: `POST /v1/safe-mode/disable` endpoint must be confirmed against the broker contract before Safe Mode toggle can be reported as passing
- Blocking items: JDK 21 + Gradle build environment; IntelliJ Platform SDK download; Plugin Verifier; per-product clean installs (IntelliJ IDEA, PyCharm, WebStorm, GoLand, PhpStorm, CLion, Rider); signing certs; Marketplace approval
- Docs: `docs/jetbrains-plugin-plan.md`, `docs/jetbrains-plugin-test-report.md`, `docs/publishing-jetbrains-marketplace.md`

### Visual Studio — PLANNED

- Adapter: `extensions/visual-studio` (C#, VS SDK, AsyncPackage)
- Source complete: `SoterAIGuardPackage.cs`, `GuardCommands.cs`, `BrokerClient.cs`, `SoterAIToolWindow.cs`, `SoterAIGuardPackage.vsct`
- Status: PLANNED / UNBUILT — source is idiomatic against the classic in-process VS SDK but has not been compiled
- Build: requires Visual Studio 2022+ with VSSDK workload; NOT RUN
- Install: NOT RUN in any VS experimental instance
- Blocking items: Windows + Visual Studio 2022 build environment; VSIX compilation; experimental instance install; broker integration; canary test
- Docs: `docs/visual-studio-extension-plan.md`, `docs/visual-studio-test-report.md`, `docs/publishing-visual-studio-marketplace.md`

### Neovim — PLANNED

- Adapter: `extensions/neovim` (Lua, dependency-free, curl-based async broker client)
- Source complete: `lua/soterai/init.lua` (config), `lua/soterai/broker.lua` (HTTP client), `lua/soterai/commands.lua` (all 9 commands), `plugin/soterai.lua` (bootstrap)
- Commands: `:SoterScanBuffer`, `:SoterScanSelection`, `:SoterRedactSelection`, `:SoterSafePrompt`, `:SoterBrokerStatus`, `:SoterSafeModeOn`, `:SoterSafeModeOff`, `:SoterMemory`, `:SoterScanGit`
- Lua syntax: passes `nvim --headless` load check in CI (`editor-adapter-syntax` job)
- Install: NOT RUN in a real Neovim config (lazy.nvim / packer / packpath)
- Broker integration: NOT RUN against a live broker
- Canary privacy: NOT RUN
- Blocking items: real Neovim install matrix (Windows/macOS/Linux); lazy.nvim install test; broker round-trip; canary test; tagged release
- Docs: `docs/neovim-plugin-plan.md`, `docs/neovim-test-report.md`, `docs/publishing-neovim-plugin.md`

### Vim — PLANNED

- Adapter: `extensions/vim` (Vimscript, curl-based synchronous broker calls)
- Source complete: `plugin/soterai.vim` (commands: `SoterScanBuffer`, `SoterScanSelection`, `SoterRedactRange`, `SoterBrokerStatus`, `SoterSafePrompt`), `autoload/soterai.vim`
- Requires Vim 8+ with `json_encode`/`json_decode` and `curl` on PATH
- Install: NOT RUN
- Broker integration: NOT RUN
- Canary privacy: NOT RUN
- Blocking items: Vim 8+ install; broker round-trip; canary test; tagged release
- Docs: `docs/vim-plugin-plan.md`, `docs/vim-test-report.md`
- Honest limitation: calls are synchronous (curl blocks Vim briefly); no rich UI; cannot observe AI extensions or terminals it does not itself wrap

### Sublime Text — PLANNED

- Adapter: `extensions/sublime` (Python, background-thread broker calls, Sublime plugin API)
- Source complete: `soterai_guard.py` (scan file, scan selection, redact selection, safe prompt, broker status, safe mode toggle), `broker_client.py`, `SoterAI Guard.sublime-settings`, `Main.sublime-menu`, `Context.sublime-menu`, `Default.sublime-commands`, `messages/install.txt`, `messages.json`
- Python syntax: passes `python3 -m compileall` in CI (`editor-adapter-syntax` job)
- Install: NOT RUN locally or via Package Control
- Broker integration: NOT RUN
- Canary privacy: NOT RUN
- Blocking items: local Sublime Text install; Package Control submission (GitHub repo + channel PR); broker round-trip; canary test
- Docs: `docs/sublime-package-plan.md`, `docs/sublime-test-report.md`, `docs/publishing-sublime-package-control.md`

### Eclipse — PLANNED

- Adapter: `extensions/eclipse` (Java, OSGi, Eclipse RCP extension points)
- Source complete: `BrokerClient.java`, `Json.java`, `Activator.java`, handlers (`ScanSelectionHandler.java`, `ScanFileHandler.java`, `RedactSelectionHandler.java`, `BrokerStatusHandler.java`, `HandlerSupport.java`), `SoterAIView.java`, `plugin.xml`, `pom.xml`
- Build: `mvn -B clean verify` (Tycho) — NOT RUN; requires Eclipse PDE / Tycho build environment
- Install: NOT RUN in any Eclipse instance
- Broker integration: NOT RUN
- Canary privacy: NOT RUN
- Blocking items: Tycho/Maven build environment; p2 update site generation; JAR signing; Eclipse install; broker round-trip; canary test; Eclipse Marketplace listing
- Docs: `docs/eclipse-plugin-plan.md`, `docs/eclipse-test-report.md`, `docs/publishing-eclipse-marketplace.md`

### JupyterLab — PLANNED

- Adapter: `extensions/jupyterlab` (TypeScript, JupyterLab 4.x extension API)
- Source complete: `src/index.ts` (7 commands: scan cell, scan selected cells, redact cell, scan notebook for secrets, safe prompt, output-leak monitor, open report), `src/broker.ts`, `src/report.ts`, `schema/plugin.json`, `package.json`, `tsconfig.json`
- Build: `jlpm install && jlpm run build:prod` — NOT RUN; requires JupyterLab dev environment
- Install: NOT RUN in any JupyterLab instance
- Broker integration: NOT RUN
- Canary privacy: NOT RUN
- Known topology gap: remote Jupyter servers cannot reach a developer's local loopback without explicit broker pairing; this must be resolved and documented before any remote-Jupyter support claim
- Blocking items: JupyterLab dev environment; prebuilt extension build; local install; broker round-trip; canary test; remote-topology resolution; npm + PyPI publish
- Docs: `docs/jupyterlab-extension-plan.md`, `docs/jupyterlab-test-report.md`

### CLI (`soterai-guard`) — PASS

- Package: `packages/soterai-cli`
- Commands: `scan file`, `scan text`, `redact file`, `broker start`, `broker status`, `safe-mode on/off/status`, `memory export`, `mcp scan`, `git scan`, `version`
- Build: `npm run build` — passes
- Broker integration: verified against live broker
- Canary: raw secrets never printed; only redacted decisions and evidence previews in output
- Cross-platform: Node.js; works on Windows/macOS/Linux wherever Node 18+ is available
- Docs: `docs/soterai-cli.md`

---

## CI/CD pipeline status

Pipeline: `.github/workflows/cross-ide-release.yml`

| Job | Status |
|---|---|
| `guard-core-tests` | ✅ Wired |
| `local-broker-tests` | ✅ Wired |
| `secret-scan` (gitleaks) | ✅ Wired |
| `canary-privacy-test` | ✅ Wired |
| `cli-tests` | ✅ Wired |
| `vscode-package` | ✅ Wired |
| `jetbrains-build` | ✅ Wired (`continue-on-error: true` until SDK available) |
| `editor-adapter-syntax` (Neovim Lua + Sublime Python) | ✅ Wired (`continue-on-error: true`) |
| `release-draft` (checksums + GitHub release) | ✅ Wired |

Secrets are never printed. Checksums are generated for every artifact. Publishing to any marketplace is a separate, human-approved step.

---

## Marketplace status

| Channel | Status | Blocking item |
|---|---|---|
| VS Code Marketplace | READY — publish path wired | Publisher PAT in release env |
| Open VSX | READY — publish path wired | `OVSX_PAT`; per-host smoke tests |
| JetBrains Marketplace | PLANNED | Gradle build + Plugin Verifier + signing + approval |
| Visual Studio Marketplace | PLANNED | Adapter not compiled |
| Sublime Package Control | PLANNED | Package Control channel PR |
| Neovim (GitHub release) | PLANNED | Tagged release + install matrix |
| Vim (GitHub release) | PLANNED | Tagged release |
| Eclipse Marketplace | PLANNED | p2 site + signing + listing |
| JupyterLab (npm + PyPI) | PLANNED | Build + remote topology resolution |

---

## Known limitations (all platforms)

- Terminal checking is preflight/wrapped only. No adapter can promise observation of every command typed into every terminal by every other extension.
- Context inspection shows context explicitly gathered or routed through SoterAI. It cannot reveal the private prompt construction of unrelated proprietary AI assistants (Cursor AI, Copilot, etc.).
- Remote IDE modes (SSH, containers, WSL, Gateway, hosted Jupyter) require an explicit broker topology. `localhost` is not assumed to mean the user's laptop.
- The LLM extension risk scanner inspects public manifests and known indicators. Cross-extension private runtime state and network traffic require a future OS/host agent.
- No "100% secure" claim is made anywhere. The benchmark (84% recall @ 1% FPR, ROC-AUC 0.92) is self-authored and may overestimate real-world performance against adaptive attacks.

---

## Next roadmap

### Immediate (before any new platform is claimed as supported)

1. Run `./gradlew buildPlugin` + `verifyPlugin` + per-product clean installs for JetBrains; resolve the `safe-mode/disable` contract gap.
2. Run Cursor, VSCodium, and Windsurf install + canary tests using the existing VSIX.
3. Run Neovim install matrix (lazy.nvim on Windows/macOS/Linux) + broker round-trip + canary.
4. Run Sublime Text local install + Package Control submission + canary.

### Short-term (Tier 2 completion)

5. Compile and test the Visual Studio extension in a VS 2022 experimental instance.
6. Complete Neovim tagged release and community index submission.
7. Resolve JupyterLab local-vs-remote broker topology; build and install the prebuilt extension.

### Medium-term (Tier 3)

8. Tycho build + p2 site for Eclipse; Eclipse Marketplace listing.
9. Vim install matrix and tagged release.
10. Zed MCP/agent-server integration (if Zed extension API matures to support the required surfaces).
11. Emacs package (MELPA) if maintainer capacity allows.

---

## Final verdict by platform

| Platform | Verdict | Reason |
|---|---|---|
| VS Code | **PASS** | Builds, installs, broker scan works, canary passes, VSIX distributable, docs complete |
| CLI (`soterai-guard`) | **PASS** | Builds, broker integration works, canary passes, cross-platform, docs complete |
| Cursor | **PLANNED** | VSIX builds; per-host install/canary NOT RUN |
| Open VSX / VSCodium | **PLANNED** | VSIX builds; per-host install/canary NOT RUN |
| Windsurf | **PLANNED** | VSIX builds; no real Windsurf install test run |
| JetBrains (all products) | **PLANNED** | Source complete, Gradle wrapper present; `buildPlugin` NOT RUN; no install or canary |
| Visual Studio | **PLANNED** | Source complete; not compiled; no install or canary |
| Neovim | **PLANNED** | Source complete, Lua syntax passes CI; no real install or canary |
| Vim | **PLANNED** | Source complete; no install or canary |
| Sublime Text | **PLANNED** | Source complete, Python syntax passes CI; no install or canary |
| Eclipse | **PLANNED** | Source complete; Tycho build NOT RUN; no install or canary |
| JupyterLab | **PLANNED** | Source complete; build NOT RUN; remote topology unresolved; no install or canary |
| Zed | **PLANNED** | No adapter; MCP/agent-server integration feasible but not equivalent to full Guard |
| Emacs | **PLANNED** | No adapter; feasibility prototype deferred |

A platform moves from PLANNED to PASS only after its real package builds, installs in a clean profile, completes a broker-backed scan, passes the canary privacy test, can be distributed, and has complete documentation — per the universal release gate in `docs/cross-ide-support-tiering.md`.
