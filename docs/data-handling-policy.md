# Data-handling policy — SoterAI IDE Guard

Status date: 2026-07-06. This document classifies every kind of data the IDE Guard adapters and Local AI Broker touch, states where each lives, how long it is kept, and — explicitly — what is **never uploaded**. It is the operational companion to the [privacy policy](privacy-policy-ide-plugins.md).

## Trust boundary

The IDE plugin is a thin client. The **Local AI Broker** (loopback, authenticated, default `http://127.0.0.1:47321`) is where detection, redaction, hashing, and policy run. All data below stays on the user's machine unless a specific opt-in remote feature is enabled.

## Data classes

| Class | Example | Where it lives | Leaves the machine? | Retention |
|---|---|---|---|---|
| Raw source / file content | code you scan | in-editor + transient broker request memory | No (not by default) | Not persisted by the broker beyond the request |
| Raw secret values | API keys, tokens found in a scan | transient broker memory; **Protected Vault** if you vault them | No | Transient in request; vault entries persist encrypted until you delete them |
| Prompt text | prompt you build/scan | in-editor + transient broker memory | No | Not persisted beyond the request |
| Terminal output (preflight) | command output you check | transient broker memory | No | Not persisted beyond the request |
| Canary values | planted decoy secrets | broker canary store (local) | No | Until you remove the canary |
| Broker auth token | loopback bearer token | `~/.soterai/broker/auth-token` (file) | No | Until rotated/deleted |
| Ledger entries ("What AI Saw") | decisions, content **hashes**, redacted evidence | local ledger store | No | Local retention window (configurable); no raw secrets stored |
| Memory / session inspector state | current session context view | in-memory session | No | Cleared when the session ends |
| Redacted telemetry (opt-in) | counts, decisions, timings, error categories | sent to SoterAI only if opted in | Only if opted in | Governed by the telemetry service's retention |

## Redaction and hashing

- **Redaction** happens in the broker before evidence is returned to the plugin or written to the ledger. The plugin renders redacted evidence; it does not render raw secret values.
- **Hashing** is used for ledger integrity and correlation: the ledger stores content/decision hashes, not raw content. Hashes let you correlate events without exposing secrets.
- Canary matches are stored as redacted evidence plus hashes, never as the raw canary string.

## Retention

- **Transient data** (raw source, prompts, terminal output, raw secret values in-flight) is held only for the duration of a broker request and is not persisted.
- **Ledger** entries persist locally within a configurable retention window; entries contain hashes and redacted evidence only.
- **Vault** entries persist encrypted until the user deletes them.
- **Canaries** persist until the user removes them.
- **Session/memory** state is cleared at session end.
- The user can inspect and delete local ledger, vault, and canary state directly.

## What is NEVER uploaded

- Raw source code or file contents.
- Raw secret values.
- Raw prompt text.
- Raw terminal output.
- Canary values.
- The broker auth token.
- File paths or workspace identifiers as part of default telemetry.

Opt-in remote features send only the specific data that feature requires, and secret values remain subject to redaction and vault protection. Nothing above is included in published artifacts, CI logs, or test reports.

## Alignment with existing controls

This policy reflects the shipped behavior documented in [`local-ai-broker-security-model.md`](local-ai-broker-security-model.md), [`what-ai-saw-ledger.md`](what-ai-saw-ledger.md), [`canary-secret-system.md`](canary-secret-system.md), and [`protected-secret-vault.md`](protected-secret-vault.md). Where an adapter cannot enforce a class boundary (e.g. it cannot stop another extension from reading an open file), that limitation is stated in [cross-ide-limitations.md](cross-ide-limitations.md) rather than implied away.
