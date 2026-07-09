# Eclipse adapter test report (HONEST)

Run date: 2026-07-06
Host OS: Windows 11, x64
Artifact: none produced

## Verdict

**UNBUILT / PLANNED.** No Eclipse PDE workspace or Tycho target platform is
available in this repository, so nothing here was compiled, packaged, installed,
or exercised. This is a scaffold. Do not describe Eclipse as supported or
publish-ready. Every row below that is not `NOT RUN` would be dishonest to mark
otherwise.

## Results

| Check | Target | Result | Notes |
|---|---|---|---|
| Java compile of `src/` | Bundle sources | NOT RUN | Requires the Eclipse Platform bundles on the classpath (org.eclipse.ui, jface.text, ...); not present here |
| Tycho `clean verify` | `pom.xml` | NOT RUN | No target platform / p2 mirror available offline |
| OSGi bundle resolves | MANIFEST.MF | NOT RUN | Requires a resolved target platform |
| Install into clean Eclipse | Eclipse 2024-06 | NOT RUN | No Eclipse install on this machine's PATH |
| Command/menu/view registration | Running workbench | NOT RUN | Requires an installed, launched Eclipse |
| Broker-backed scan smoke | Running workbench + broker | NOT RUN | Requires both an install and a running broker |
| Redaction round-trip | Running workbench + broker | NOT RUN | Requires install + broker |
| Canary privacy test | Running workbench + broker | NOT RUN | Must prove no raw content leaves the machine and none appears un-redacted in the view/log |
| Plugin/API verification | Target Eclipse versions | NOT RUN | Requires target platform + API tooling |

## Manual build + install procedure (to run on a real Eclipse machine)

1. Install "Eclipse IDE for RCP and RAP Developers" (2024-06 or later) with PDE.
2. Import `extensions/eclipse` as an existing project (it is a plug-in project).
3. Resolve the target platform: the bundles in `Require-Bundle` must be present.
   For a headless build instead, run `mvn -f extensions/eclipse/pom.xml clean verify`
   against a reachable p2 release repository.
4. Launch an Eclipse Application run configuration (self-hosting) with this bundle.
5. Start the SoterAI Local AI Broker locally; confirm `GET /health` returns 200
   and that `~/.soterai/broker/auth-token` (or Secure Storage) holds the token.

## Acceptance criteria to record a PASS

A row may only become PASS with reproducible evidence attached:

- **Compile/verify PASS**: Tycho `verify` succeeds and produces a bundle jar and
  (later) a p2 update site.
- **Install PASS**: the bundle resolves and activates in a clean Eclipse profile;
  `SoterAI` menu, editor popup entries, and the report view all appear.
- **Scan PASS**: selecting text and running "Scan Selection" produces a broker
  `decision` in the report view; the same for a whole-file scan.
- **Redact PASS**: "Redact Selection" replaces the selection with broker output
  and the original text is unchanged nowhere except the editor buffer.
- **Broker-boundary PASS**: with the broker stopped, every command fails with a
  clear "broker not reachable" message and no crash.
- **Canary privacy PASS (blocking):** open a notebook/file seeded with canary
  secrets (fake API keys, PII). After scan/redact:
  - the report view contains only redacted evidence previews and the content
    hash — never the raw canary values;
  - the Eclipse `.log` contains no canary values and no bearer token;
  - no network egress leaves `127.0.0.1` except calls to the local broker
    (verify with a loopback-only capture).

Until the canary privacy row is PASS with a capture attached, no "local-first /
no raw upload" guarantee may be stated for Eclipse beyond "by design, unverified".
