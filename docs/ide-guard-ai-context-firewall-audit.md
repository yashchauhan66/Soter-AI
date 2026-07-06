# SoterAI IDE Guard — AI Context Firewall: Capability Audit (Phase 0)

_Last updated: 2026-07-05_

This document states honestly what SoterAI IDE Guard, as a **VS Code extension**,
can and cannot enforce when protecting developers from local AI coding
assistants that read workspace files, secrets, prompts, terminal output, and
context.

## The core technical truth

A normal VS Code extension runs in the same user/OS context as every other
extension. It **cannot reliably intercept or block another extension's internal
file reads.** If a secret file is present in the workspace and readable by the
user, another extension (including an AI assistant) can read it too, unless the
secret is **removed, moved, or virtualized** outside normal workspace access.

Therefore SoterAI does **not** claim to "block every extension." It provides the
strongest *practical* protection: remove secrets from files, gate/redact what
gets shared, detect leakage, and audit everything.

## What SoterAI can enforce directly today

| Capability | How |
|---|---|
| Remove raw secrets from workspace files | Protected Secret Vault migrates `.env`-style secrets to an encrypted store **outside** the workspace and leaves placeholders. |
| Guarantee SoterAI-built context is secret-free | `buildSafeContext` + `redactForSharing` fail closed; protected files are excluded, sensitive files summarized. Enforced by canary tests. |
| Keep raw secrets out of logs/cache/telemetry/ledger/export | Layered sanitizers (`sanitizeDecisionForCache`, `sanitizeLedgerEntry`, `findSurvivingSecrets`). |
| Encrypt the vault at rest | AES-256-GCM; key in VS Code SecretStorage, separate from the vault file. |
| Gate cloud/token features behind Workspace Trust | Vault + cloud disabled in untrusted workspaces. |

## What SoterAI can only warn / scan (best-effort, not enforcement)

| Capability | Limitation |
|---|---|
| Detect secrets/PII/injection in files & prompts | Heuristic detectors; not exhaustive. |
| Scan AI **output** for leaked secrets/canaries/exfiltration | Only scans output the user hands to SoterAI (paste/selection/clipboard). |
| Canary leak detection | Proves a leak *after* it appears in scanned output; cannot prevent the read. |
| MCP config risk | Regex/structural heuristics over config text. |

## What SoterAI **cannot** technically block as a VS Code extension

- Another extension reading a file the user can read (un-migrated secrets).
- An AI assistant's *internal* context gathering (open files, selection) that
  never passes through SoterAI.
- Network calls made by other extensions/processes.
- Terminal commands run outside SoterAI's check flow.

## What needs a Local Guard Agent (Phase 10, design only)

Stronger enforcement — mediating file access, brokering MCP/tool calls,
approving terminal commands, and virtualizing secrets at the OS/process
boundary — requires a local service outside the extension sandbox. See
[local-guard-agent-enforcement-plan.md](local-guard-agent-enforcement-plan.md).

## What needs a user workflow change

- Use **SoterAI: Migrate Secrets to Protected Vault** so AI tools see placeholders.
- Share context via **SoterAI: Build Safe AI Context / Build Safe *Prompt**
  instead of pasting raw files.
- Keep `.soterai/` (ledger, canary) gitignored.

## What needs tool-specific integration

- Direct hooks into a specific assistant's context pipeline (Copilot/Cursor/
  Claude) would require that tool's extension API or an MCP proxy — out of scope
  for the extension-only build.

See also: [ide-guard-limitations.md](ide-guard-limitations.md).
