# Publishing to the Eclipse Marketplace (PLANNED)

Status date: 2026-07-06. Planning only. Nothing below has been executed. Eclipse
distribution is a **p2 update site**, not a single universal JAR, and the
Marketplace listing points at that update site.

## Prerequisites (all currently unmet in this repo)

- A green Tycho build producing a bundle and a **feature** (`eclipse-feature`)
  plus an **update site / repository** (`eclipse-repository`). The current
  `pom.xml` builds only the plug-in module; feature + repository modules must be
  added before publishing.
- A signing certificate. Unsigned p2 artifacts trigger warnings on install; sign
  jars (jarsigner or the Tycho GPG/pack200 successors) before hosting.
- A stable hosting URL for the update site (GitHub Pages, S3/CloudFront, or an
  Eclipse-hosted site) that serves `content.jar`, `artifacts.jar`, and `plugins/`.
- An `eclipse.org` account to create the Marketplace listing.

## Build steps (once feature + repository modules exist)

```bash
mvn -f extensions/eclipse/pom.xml clean verify
# produces: <repository-module>/target/repository/  (the p2 update site)
```

Then sign and publish the `repository/` contents to the hosting URL. Verify a
clean Eclipse can install from `Help > Install New Software > <your URL>`.

## Marketplace listing

1. Sign in at https://marketplace.eclipse.org and "Add Content".
2. Provide the update-site URL, categories, license, and screenshots.
3. Include the honest limitations from the README (thin adapter, local-first, no
   universal interception, no "100% secure" claim).
4. Enable the "Drag to install" (MPC) button only after a clean-profile install
   test passes on each advertised Eclipse version.

## Do not publish until

- `docs/eclipse-test-report.md` shows PASS (with evidence) for compile/verify,
  clean-profile install, scan, redact, broker-boundary, and the blocking canary
  privacy test.
- The Plugin/API verification has run against every advertised Eclipse release.
- The listing copy makes no support/coverage claim beyond what was tested.
