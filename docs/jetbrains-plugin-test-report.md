# JetBrains plugin test report

Run date: 2026-07-06
Host OS: Windows, x64
Adapter: `extensions/jetbrains/` (Kotlin, Gradle IntelliJ Platform Plugin 2.12.0)
Build baseline: IntelliJ IDEA Community 2025.1.2, declared range `since 251` / `until 261.*`

This report is deliberately incomplete. The plugin has **not** been built with the IntelliJ Platform SDK, installed in a real IDE, run against a live broker, or Plugin-Verified in this environment. No PASS is recorded for any check that requires those steps. JetBrains is **not** a supported platform under the release gate in `docs/cross-ide-support-tiering.md`.

## Results

| Check | Target | Result | Evidence / reason |
|---|---|---|---|
| Source-level broker contract test | `BrokerContractTest` | NOT RUN | Requires Gradle + IntelliJ Platform test framework download; the test only asserts source patterns (loopback, Bearer, no token logging), not runtime behavior |
| Plugin build | `./gradlew buildPlugin` | NOT RUN | Requires Gradle IntelliJ SDK download; no `build/distributions` artifact has been produced |
| Kotlin compile / unit tests | `./gradlew test` | NOT RUN | Requires IntelliJ Platform SDK + test framework |
| Plugin Verifier | Declared build range, per product | NOT RUN | Requires built artifact and verifier IDE downloads |
| Clean-profile install | IntelliJ IDEA / PyCharm / WebStorm / GoLand / PhpStorm / CLion / Rider | NOT RUN | Requires built artifact and a running IDE per product |
| UI smoke test | Tool window, actions, settings, status widget | NOT RUN | Requires `runIde` or a real install; CLI/static checks do not exercise the platform UI |
| Broker integration | `scan` / `redact` / Safe Mode / health / events | NOT RUN | Requires a running Local AI Broker on `127.0.0.1:47321` with a valid token |
| Canary privacy test | Broker + plugin report/logs | NOT RUN | Requires a running IDE and broker; procedure below |
| Safe Mode disable path | `POST /v1/safe-mode/disable` | BLOCKED | Endpoint not in the documented broker contract (only `enable` is defined); must be confirmed or the toggle reworked before it can PASS |

## Commands to reach a real result

Run from `extensions/jetbrains/`. A Gradle wrapper (`gradlew`/`gradlew.bat`) must be present; if it is not yet generated, generate it with a local Gradle before the first build.

```powershell
# Build the distributable ZIP (produces build/distributions/*.zip)
.\gradlew.bat buildPlugin

# Compile and run the source-level contract test
.\gradlew.bat test

# Launch a sandbox IDE with the plugin loaded for UI + broker smoke testing
.\gradlew.bat runIde

# Verify compatibility across the declared build range and every named product
.\gradlew.bat verifyPlugin
```

## Acceptance criteria (what PASS requires)

- **Build:** `buildPlugin` succeeds and emits a single ZIP under `build/distributions`; the ZIP contains only the plugin JAR, `plugin.xml`, and required libraries — no source, tokens, `.env`, or unrelated files.
- **Tests:** `test` passes, including `BrokerContractTest` (loopback fixed, Bearer present, `0.0.0.0` absent, no token logging).
- **Plugin Verifier:** no new compatibility problems across `251`–`261.*` for every product named in marketplace metadata; unresolved problems are documented, not ignored.
- **Install:** the ZIP installs from disk into a clean profile of each named product and loads without errors in the IDE log.
- **UI smoke:** tool window opens; "Check Broker" and "Memory / Ledger" return data; context-menu and Tools-menu actions appear and are enabled/disabled correctly; settings page saves port and token; status widget shows Ready/Safe.
- **Broker integration:** with a running broker and valid token, `scan` returns a decision, `redact` replaces the selection, Safe Mode status/enable behave; with a missing token the plugin shows the configure-token error, not a crash.
- **Canary privacy:** the canary procedure below passes on every named product before that product is described as supported.

## Canary privacy test procedure

Goal: prove that a known secret sent through the plugin is redacted by the broker and that the raw secret never appears in the plugin's notifications, tool-window output, or IDE logs.

1. Start the Local AI Broker on `127.0.0.1:47321` with a valid token; configure that token in `Settings | SoterAI IDE Guard`.
2. Create a file containing a unique canary string that no real system uses, for example `SOTERAI-CANARY-<random-uuid>` alongside a realistic secret-shaped value (fake API key / token pattern).
3. Select the canary text and run **Scan Selection with SoterAI**. Confirm the notification/tool-window shows a decision and only a redacted `evidencePreview` — the raw canary/secret must not be shown verbatim.
4. Run **Redact Selection for AI**. Confirm the selection is replaced with a redacted form and the original secret is gone from the buffer.
5. Open **Memory / Ledger** and confirm recent events contain redacted references only, never the raw canary.
6. Search the IDE log (`Help | Show Log in Explorer`) and the sandbox logs from `runIde` for the canary string and the secret value. Both must be absent.
7. Confirm no request left `127.0.0.1` (broker is loopback-only) and nothing was sent to SoterAI Cloud by default.

Record PASS only if the raw canary and secret appear nowhere in UI, reports, or logs, and redaction is confirmed at every surface. A leak at any surface is a FAIL for that product.

## Verdict

**NOT RUN.** The adapter is implemented but unbuilt and unverified. No support, compatibility, or privacy PASS is claimed. Build, test, Plugin Verifier, per-product clean install, UI smoke, broker integration, and the canary privacy test — plus resolution of the Safe Mode disable-path gap — are required before any JetBrains product can be described as supported.
