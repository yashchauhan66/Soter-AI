# Publishing SoterAI IDE Guard to the JetBrains Marketplace

This runbook packages the adapter at `extensions/jetbrains/`. Publishing is intentionally separate from building and testing, and no credential is stored in the repository. Do not publish until the test report (`docs/jetbrains-plugin-test-report.md`) records real PASS results for build, Plugin Verifier, per-product install, UI smoke, broker integration, and the canary privacy test.

## Prerequisites

- A JetBrains Marketplace vendor profile that owns the plugin ID `ai.soterai.jetbrains.guard`. The first upload of a new plugin is a manual submission and is subject to JetBrains review.
- A JDK 21 toolchain and network access for the Gradle IntelliJ Platform SDK download.
- Marketplace-safe listing assets: plugin icon (`pluginIcon.svg` / `pluginIcon_dark.svg` in `META-INF`, per JetBrains icon guidelines), listing screenshots, a written description, and a privacy statement.
- A signing certificate chain and private key for signed distribution (JetBrains supports signed plugins; unsigned uploads are discouraged).
- Completed privacy, limitations, changelog, and clean-profile test evidence.

## Build the distributable

Run from `extensions/jetbrains/`.

```powershell
.\gradlew.bat clean buildPlugin
.\gradlew.bat verifyPlugin
```

`buildPlugin` produces the plugin ZIP under `build/distributions/`. This ZIP is the artifact uploaded to the Marketplace. Inspect it before upload: it must contain only the plugin JAR, `plugin.xml`, and required libraries — no source, tokens, `.env`, test fixtures, or unrelated monorepo files.

## Metadata and listing

- **ID / name / vendor:** `ai.soterai.jetbrains.guard`, "SoterAI IDE Guard", vendor SoterAI (`https://soterai.in`) — must match `plugin.xml`.
- **Compatibility range:** publish only the `sinceBuild`/`untilBuild` range that Plugin Verifier passed (currently `251`–`261.*`). Do not widen the range in metadata beyond what was verified.
- **Description:** state that it is local-first, connects to an authenticated loopback broker, and does not transparently intercept every third-party AI assistant or terminal command. Do not claim "100% secure" or full interception.
- **Icons:** provide the required light/dark plugin icons; the in-product SVG is not a substitute for marketplace listing assets.
- **README / documentation:** link installation, limitations, and privacy docs.
- **Changelog:** maintain a per-version changelog; each upload needs a unique version (`gradle.properties` `version`).
- **Privacy policy:** describe what stays local (raw source, secrets, prompts, terminal output by default), what the broker does (loopback, authenticated, redacted ledger), and that nothing is sent to SoterAI Cloud by default.

## Signing and publishing

Signing and publishing read secrets from the release environment only. The `build.gradle.kts` wires these to environment variables:

```powershell
$env:CERTIFICATE_CHAIN      = '<injected by secret store>'
$env:PRIVATE_KEY            = '<injected by secret store>'
$env:PRIVATE_KEY_PASSWORD   = '<injected by secret store>'
$env:PUBLISH_TOKEN          = '<injected by secret store>'

.\gradlew.bat signPlugin
.\gradlew.bat publishPlugin
```

For the first release, prefer a manual upload of the signed ZIP through the vendor portal so JetBrains review runs before automation is enabled.

Never place `PUBLISH_TOKEN`, the private key, or the key password in `gradle.properties`, `build.gradle.kts`, a committed command, a screenshot, or a test report. Rotate any credential that is exposed.

## Marketplace checklist

- [ ] Bump a unique version and update the changelog/release notes.
- [ ] Confirm vendor ownership of plugin ID `ai.soterai.jetbrains.guard`.
- [ ] `buildPlugin` succeeds; inspect the ZIP for excluded source/tokens/unrelated files.
- [ ] Plugin Verifier passes for every product and build named in metadata; document any residual problems.
- [ ] Clean-profile install + UI smoke + broker integration + wrong-token/offline + canary privacy test pass on each named product (see test report).
- [ ] Confirm default no-cloud posture and loopback-only broker traffic.
- [ ] Confirm no broker token, private key, or raw secret appears in the ZIP, IDE logs, tool window, notifications, reports, or test artifacts.
- [ ] Listing states SoterAI protects context routed through SoterAI and cannot intercept every third-party AI assistant or terminal command.
- [ ] Provide required light/dark icons and HTTPS listing images.
- [ ] After approval, install the Marketplace copy into another clean profile and compare version/checksum with the release record.
- [ ] Record rollback/unpublish ownership and support contact.

## References

- [JetBrains — Publishing a plugin](https://plugins.jetbrains.com/docs/intellij/publishing-plugin.html)
- [Plugin signing](https://plugins.jetbrains.com/docs/intellij/plugin-signing.html)
- [Marketplace plugin overview / listing requirements](https://plugins.jetbrains.com/docs/marketplace/plugin-overview-page.html)
- [Plugin icon guidelines](https://plugins.jetbrains.com/docs/intellij/plugin-icon-file.html)
- [Verifying plugin compatibility](https://plugins.jetbrains.com/docs/intellij/verifying-plugin-compatibility.html)
