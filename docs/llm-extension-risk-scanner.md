# LLM Extension Risk Scanner

SoterAI IDE Guard surfaces which installed VS Code extensions are **AI coding
assistants** (they can read your workspace code and context) and gives each a
**heuristic** risk score.

> **Heuristic, not malware detection.** Scores are derived from local extension
> metadata only. A high score means "broad footprint / verify the source",
> never "this extension is malicious". SoterAI makes no malware claims without
> evidence.

## Commands (Phase 8)

| Command | What it does |
| --- | --- |
| **SoterAI: Scan Installed Extensions Risk** | Full heuristic risk table for third-party extensions (built-ins hidden). |
| **SoterAI: Show AI Extensions** | Lists just the AI coding assistants that can read your code. |
| **SoterAI: Generate Extension Risk Report** | Opens a secret-free Markdown report you can save or share. |

## Signals used

The scanner (`ExtensionRiskScanner` in `@soterai/guard-core`) inspects each
extension's manifest and raises weighted signals:

- **AI assistant** — id/name/description/category matches a known AI tool.
- **Broad / wildcard activation** — `*` or `onStartupFinished` (runs on every
  workspace, can read files eagerly).
- **Terminal integration** — can read/inject terminal content.
- **Extension dependencies / packs** — expanded attack surface.
- **Unverified publisher** and **no source repository** — provenance heuristics.
- **Possible impersonation** — name references a well-known AI brand but the
  (unverified) publisher does not match.

Built-in / bundled extensions short-circuit to **info** (trusted).

Levels: `info` (0) → `low` (1–19) → `medium` (20–44) → `high` (≥45).

## What it does *not* do

- It cannot block or uninstall another extension.
- It cannot see another extension's runtime file reads.
- Detection of "is this AI" is pattern-based and may miss brand-new tools.

For real protection against what AI tools can read, move secrets into the
[Protected Secret Vault](protected-secret-vault.md) and share only SoterAI-built
safe context. See [ide-guard-limitations.md](ide-guard-limitations.md).
