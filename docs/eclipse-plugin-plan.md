# Eclipse plugin plan

See `extensions/eclipse/docs/eclipse-plugin-plan.md` for the full design record.

Status: PLANNED / UNBUILT. Source scaffold is at `extensions/eclipse/`. Nothing has been compiled, installed, or tested. Eclipse is Tier 3 (later support) per `docs/cross-ide-support-tiering.md`.

## Quick reference

- Adapter: `extensions/eclipse/` (Java, OSGi, Eclipse RCP, Tycho build)
- Broker client: `BrokerClient.java` — loopback-only, bearer auth, `java.net.http`
- Commands: Scan Selection, Scan File, Redact Selection, Broker Status
- View: `SoterAIView` — redacted report only
- Build: `mvn -B clean verify` (Tycho, requires Eclipse PDE target platform)
- Distribution: signed p2 update site → Eclipse Marketplace listing

## Acceptance gate

Plugin builds with Tycho, installs in a clean Eclipse instance, completes a broker-backed scan, passes the canary privacy test, and the p2 update site is distributable. See `extensions/eclipse/docs/eclipse-test-report.md` for the test procedure.
