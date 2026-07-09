# Publishing SoterAI IDE Guard to the Eclipse Marketplace

See `extensions/eclipse/docs/publishing-eclipse-marketplace.md` for the full publishing runbook.

Status: PLANNED. The adapter must pass its acceptance gate (build, install, broker scan, canary) before this path is executed.

## Summary

1. Build the p2 update site with Tycho: `mvn -B clean verify` from `extensions/eclipse/`.
2. Sign the feature and plugin JARs with `jarsigner` using the release keystore (never committed).
3. Host the signed p2 update site at a stable HTTPS URL.
4. Create the Eclipse Marketplace listing pointing to the update site URL.
5. Submit for Marketplace review.

**Credentials:** JAR signing keystore and password live only in the release environment. Never commit them.

**Limitations to state in the listing:** local-first, loopback broker, no raw source/secrets to cloud by default, no universal terminal interception, update-site installation required (no single universal JAR).
