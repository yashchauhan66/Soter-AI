# SoterAI IDE Guard for Eclipse (PLANNED / UNBUILT)

A thin Eclipse/OSGi adapter for SoterAI IDE Guard. It forwards content you
explicitly select or open to the authenticated loopback **Local AI Broker** and
shows the broker's redacted findings in a report view. All detection, redaction,
and policy logic lives in the shared broker — this plugin does not reimplement
any detector.

> **Status: scaffold only.** This directory has **not** been built or installed.
> No Eclipse PDE/Tycho target platform is available in this repository, so there
> is no compiled bundle, no update site, and no runtime evidence. "Eclipse
> supported" is **not** claimed. See `docs/eclipse-test-report.md` for the exact
> gates that must pass first.

## What it is meant to do

- **Scan Selection with SoterAI** — send the current selection to `POST /v1/scan`.
- **Scan Current File with SoterAI** — send the active document to `POST /v1/scan`.
- **Redact Selection for AI with SoterAI** — replace the selection with the
  broker's `POST /v1/redact` output.
- **Show SoterAI Broker Status** — `GET /health` and `GET /v1/safe-mode/status`.
- **SoterAI Guard Report** view — shows only redacted, display-safe results.

## What it deliberately does not do

- It does not classify, score, or redact content itself.
- It does not transparently intercept other AI assistants, code-completion
  plugins, or terminal commands. It only sees content routed through its own
  commands.
- It does not upload raw source, secrets, prompts, or outputs to SoterAI Cloud
  by default. The broker is the enforcement boundary and redacts its own ledger.
- It makes no "100% secure" claim.

## Broker contract used

Loopback base `http://127.0.0.1:47321` (port override via `SOTERAI_BROKER_PORT`).
Bearer token on every path except `GET /health`. The token is read from Eclipse
Secure Storage in the real build, falling back to the broker's on-disk token
file `~/.soterai/broker/auth-token`. The token is never written to the Eclipse log.

## Planned build

```bash
# Requires an Eclipse PDE workspace or a Tycho target platform (neither is
# present in this repo). See docs/eclipse-plugin-plan.md.
mvn -f extensions/eclipse/pom.xml clean verify
```

## Layout

```
extensions/eclipse/
  META-INF/MANIFEST.MF        OSGi bundle manifest
  plugin.xml                  commands, menus, handlers, view
  build.properties            PDE build inputs
  pom.xml                     Tycho build plan (unbuilt)
  src/ai/soterai/guard/
    Activator.java            bundle lifecycle
    BrokerClient.java         java.net.http client for the broker
    Json.java                 tiny in-bundle JSON reader (no external dep)
    handlers/                 command handlers + shared support
    views/SoterAIView.java    redacted report view
  docs/                       plan, honest test report, publishing guide
```
