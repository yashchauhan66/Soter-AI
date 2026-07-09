# SoterAI IDE Guard for JetBrains — plugin plan

Status date: 2026-07-06. This is a design and scoping document, not a support claim. The adapter code exists at `extensions/jetbrains/` but has not been built with the IntelliJ Platform SDK, installed in a real IDE, run against a live broker, or Plugin-Verified in this environment. JetBrains support is not claimed until the release gate in `docs/cross-ide-support-tiering.md` is met.

## Architecture

The JetBrains plugin is a thin Kotlin adapter over the same local security plane used by the VS Code family. Detection, redaction, policy, Safe Mode, evidence minimization, and the ledger live in `guard-core` and the authenticated Local AI Broker. The plugin owns only host lifecycle, context collection (selection/document text), redacted rendering, credential pairing, and IDE actions.

- Runtime: IntelliJ Platform SDK, Kotlin/JVM, JDK 21 toolchain, Gradle IntelliJ Platform Plugin 2.x.
- Transport: `java.net.http.HttpClient` to `http://127.0.0.1:<port>` (default port `47321`), 2s connect timeout, 10s request timeout.
- Auth: `Authorization: Bearer <token>` on every authenticated request. The token is read from Password Safe at call time and is never held in plaintext settings.
- The broker is the enforcement boundary. The plugin does not run detectors, does not open a non-loopback socket, and does not send raw source, secrets, prompts, or terminal output to SoterAI Cloud.

### Broker contract used by the adapter

| Endpoint | Auth | Adapter use |
|---|---|---|
| `GET /health` | none | Tool window "Check Broker" |
| `GET /v1/safe-mode/status` | Bearer | Read current Safe Mode state |
| `POST /v1/safe-mode/enable` `{level}` | Bearer | Enable Safe Mode (level `developer`) |
| `POST /v1/scan` `{content}` | Bearer | Scan selection / current file |
| `POST /v1/redact` `{content}` | Bearer | Redact selection in place |
| `GET /v1/events/recent` | Bearer | Tool window "Memory / Ledger" |

Known contract gap: `BrokerClient.setSafeMode(false)` posts to `/v1/safe-mode/disable`, which is not part of the documented broker contract (only `enable` is defined). The disable path must be confirmed against the broker or the toggle must be reworked to a supported call before Safe Mode toggling can be reported as passing. Scan currently sends only `{content}`; the `{messages}` form and the richer `{decision, riskScore, categories, redacted, contentHash, safe, evidencePreview}` fields beyond `decision`/`riskScore`/`categories`/`evidencePreview` are not yet consumed.

## Target IDEs

One IntelliJ Platform plugin is intended to cover the JetBrains family, but each product is a separate test target. One passing IntelliJ IDEA run does not establish support for any other product.

| Product | Feasibility | Notes |
|---|---|---|
| IntelliJ IDEA (Community/Ultimate) | Primary target | Build/compile baseline is IntelliJ IDEA Community 2025.1.2 |
| PyCharm (Community/Professional) | High | Platform APIs only; verify both variants |
| WebStorm | High | Must not require closed-source JS APIs for core scanning |
| GoLand | Medium | Platform text scanning only; no Go PSI needed |
| PhpStorm | Medium | Product install/test capacity is the main constraint |
| CLion | Medium | Native-project scale/performance to watch |
| Rider | Conditional | IntelliJ frontend covered; .NET backend documents/actions need separate verification before any claim |

DataGrip is deferred because database console/result data needs a separate privacy design; the MVP scans editor documents only.

## MVP features — implemented vs planned

Implemented in `extensions/jetbrains/` today (pending real-host verification):

| Feature | Surface | Broker call |
|---|---|---|
| Scan Selection | Editor context menu | `POST /v1/scan` |
| Scan Current File | Tools menu | `POST /v1/scan` |
| Redact Selection for AI (in-place write) | Editor context menu | `POST /v1/redact` |
| Safe Mode toggle | Tools menu + status widget | `GET /v1/safe-mode/status`, `POST /v1/safe-mode/enable` |
| Broker health check | Tool window button | `GET /health` |
| Memory / Ledger view (recent events) | Tool window button | `GET /v1/events/recent` |
| Broker token storage | Settings page | Password Safe |
| Broker port configuration | Settings page | — |
| Status widget (Ready/Safe) | Status bar | reads local Safe Mode flag |

Planned, not yet implemented (do not describe as available):

- Scan Workspace Risk and Scan Git Changes.
- MCP scan, terminal command preflight, approval workflow.
- Structured AI Memory Inspector and What-AI-Saw ledger UI beyond the raw recent-events text dump.
- Report export, policy configuration UI, canary leak detection as a first-class feature (canary behavior is tested through the broker, see the test report).
- Broker lifecycle control. The plugin checks broker health and status; it does not start or stop the broker.

Feature parity symbols for JetBrains are the `B` (broker-required) / `P/B` targets in `docs/cross-ide-feature-parity-matrix.md`. Those are design targets, not passed tests.

## UI surfaces

- Tool window `SoterAI Guard` (right anchor): "Check Broker" (health) and "Memory / Ledger" (recent events), redacted output in a read-only text area.
- Editor context-menu actions: Scan Selection, Redact Selection for AI (enabled only with a selection).
- Tools-menu actions: Scan Current File, Toggle Safe Mode.
- Status-bar widget: shows `SoterAI: Safe` or `SoterAI: Ready` from the local Safe Mode flag.
- Settings page (`Settings | SoterAI IDE Guard`): loopback broker port (validated 1024–65535) and Password Safe token field.
- Balloon notifications in the `SoterAI Guard` notification group for scan results and errors.

Threading: broker calls run on a pooled thread; UI updates use `invokeLater`; in-place redaction uses `WriteCommandAction`. This must be re-checked against current platform read/write and EDT rules during Plugin Verifier and runtime testing.

## Security

- Token storage: IntelliJ Password Safe (`CredentialAttributes("SoterAI.LocalBroker.Token")`), never plaintext settings. The settings password field is cleared on `disposeUIResources`.
- No token in logs: there is no logging of the token or scanned content; the source-level `BrokerContractTest` asserts the absence of `println(token`/`logger.info(token` patterns. This is a static guard, not a runtime log audit — a real log review is still required.
- Loopback only: broker URL is fixed to `127.0.0.1`; `0.0.0.0` is asserted absent. No remote endpoint is contacted for scanning.
- No raw secret in reports: notifications and the tool window render only redacted broker output (`evidencePreview`, redacted events). Raw selected text and document content are sent to the loopback broker for scanning but are not written into reports, notifications, or the ledger UI.
- Default posture: no cloud upload by default; broker is the boundary. This must be re-verified at runtime — the static test cannot prove it.

## Plugin Verifier and compatibility range

- Current declared range in `plugin.xml`/`build.gradle.kts`: `sinceBuild = 251`, `untilBuild = 261.*`, built against IntelliJ IDEA Community 2025.1.2.
- Run IntelliJ Plugin Verifier against every product and build explicitly named in marketplace metadata, across the declared range, before any support claim.
- Prefer a conservative `untilBuild` and widen it only after verification, rather than claiming a range the plugin has not been verified on.
- Only `com.intellij.modules.platform` is depended on today. Any product-specific or optional-plugin dependency (for example a future Terminal integration) must be declared as an optional dependency so unrelated products still load the plugin.
- Keep the Kotlin/coroutines and bundled-library footprint minimal to reduce cross-product incompatibility surface.

## References

- [IntelliJ Platform plugin development](https://plugins.jetbrains.com/docs/intellij/developing-plugins.html)
- [Gradle IntelliJ Platform Plugin](https://plugins.jetbrains.com/docs/intellij/tools-gradle-intellij-plugin.html)
- [Plugin Verifier](https://plugins.jetbrains.com/docs/intellij/verifying-plugin-compatibility.html)
- [Password Safe / Credential Store](https://plugins.jetbrains.com/docs/intellij/persisting-sensitive-data.html)
- [Publishing a plugin](https://plugins.jetbrains.com/docs/intellij/publishing-plugin.html)
