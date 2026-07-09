# Privacy policy — SoterAI IDE Guard plugins

Status date: 2026-07-06. This policy covers the SoterAI IDE Guard adapters for VS Code, Cursor/VSCodium, JetBrains, Visual Studio, Sublime Text, Neovim/Vim, Eclipse, and JupyterLab. It describes what the plugins do with your data in precise terms. It is intentionally conservative: where a plugin *cannot* guarantee something, this policy says so rather than implying protection it does not provide.

## Summary

- **Local-first.** The IDE plugins are thin clients. All detection, redaction, and policy logic runs in the **Local AI Broker** on your machine, reached over an authenticated loopback endpoint (default `http://127.0.0.1:47321`).
- **No raw source, secrets, or prompts to SoterAI Cloud by default.** The plugins do not upload your raw code, detected secrets, or prompt text to any SoterAI cloud service by default.
- **You control what is scanned.** Scanning is explicit: a selection, a file, a cell, or a workspace action you invoke. The plugin does not silently stream your editor contents.
- **We are honest about scope.** The plugin mediates context that is explicitly scanned or routed through SoterAI. It cannot transparently intercept a third-party AI extension's own file reads or network calls, and it is not an OS-level sandbox. See [cross-ide-limitations.md](cross-ide-limitations.md).

## What stays on your machine

- Raw source code and file contents.
- Detected secrets and their raw values.
- Prompt text you build or scan.
- Terminal output you route through a preflight check.
- The broker auth token (stored at `~/.soterai/broker/auth-token`, never in plugin config or dotfiles when you use the default token-file flow).
- The "What AI Saw" ledger's decisions, hashes, and **redacted** evidence.

None of the above is uploaded to SoterAI Cloud by default. The plugin sends the content you explicitly scan to the **local** broker only.

## What the broker does

- Receives explicitly submitted content over the authenticated loopback endpoint.
- Runs detectors, redaction, canary checks, and policy locally.
- Returns decisions and redacted evidence to the plugin.
- Records ledger entries locally (decisions, content hashes, redacted evidence — never raw secrets).

The broker is the trust boundary. The plugins never reimplement detectors and never hold your secrets longer than needed to hand them to the local broker.

## Telemetry

- Telemetry is **off by default**.
- If you opt in, telemetry is **redacted-only**: counts, decisions, timings, and error categories. It never includes raw source, secret values, prompt text, file paths, or canary values.
- Opt-in telemetry can be disabled at any time in plugin settings.

## Canary handling

- Canaries are decoy secrets you plant so SoterAI can detect leakage in AI output.
- Canary **values are treated as sensitive**: they are not printed raw in logs, notifications, screenshots, listings, or the ledger. The ledger stores canary matches as redacted evidence and hashes.
- Detecting a canary in AI output tells you a leak path exists; it does not, by itself, transmit the canary value anywhere off your machine.

## Remote / cloud features (opt-in only)

Any feature that would send data beyond the local broker is **explicit opt-in**, clearly labeled in settings, and off by default. Remote escalation and cloud routing are not enabled silently. When enabled, only the specific data required by that feature is sent, and secret values remain subject to redaction and vault protection.

## What we cannot see

- We cannot see, at runtime, exactly what a third-party AI tool sent to a remote model.
- We cannot intercept another extension's internal file reads.
- We cannot guarantee that another extension in a trusted workspace will not read your open files.

## Data subject controls

- **Access / deletion:** the ledger and broker state live on your machine; you can inspect or delete them directly.
- **Retention:** see [data-handling-policy.md](data-handling-policy.md) for data classes and retention.
- **Contact:** the published support address in `docs/marketplace-assets/support-info.md`.

## Changes

Material changes to this policy are recorded in `CHANGELOG.md` and the release notes for the affected plugin versions. Credentials and tokens are never included in any published artifact, log, or report.
