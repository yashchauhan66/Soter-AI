# n8n Marketplace Readiness Checklist

Use this checklist before publishing `n8n-nodes-soterai`.

Current package version: `0.6.0`.

## Node Promise

SoterAI adds AI security guardrails to n8n workflows: prompt injection detection, jailbreak checks, secret/PII detection, RAG risk scanning, tool-call checks, memory safety checks, output guardrails, semantic egress checks, and workflow security audit.

## Credential Handling

| Item | Expected state |
| --- | --- |
| API key | Stored in n8n credentials, not workflow JSON |
| Credential requirement | Optional on the node: Local mode and Workflow Audit run with no credential; Cloud and Auto fail with a specific error when none is selected |
| Base URL | Configurable, defaults to production SoterAI |
| Project ID | Optional credential default or node override |
| Error output | Sanitized before returning to n8n |
| `rawResponse` | Recursively sanitized before downstream workflow output |

## User Experience

| Requirement | Evidence |
| --- | --- |
| Smallest action that protects something is the default | `action` defaults to `inputGuard` ("Guard Input (Start Here)"), not a report-only action |
| Focused operations still available | Guard Output, Redact Secrets or PII, RAG Risk Summary, Workflow Audit, Analyze Text, Universal AI Firewall (Advanced) |
| Enforcement is part of the node, not homework | Node version 2 has named `Safe` / `Flagged` outputs; version 1 keeps its single output for existing workflows |
| Canvas legibility | Subtitle shows the human action label, the On Threat setting, and the engine when it is not Cloud (`Guard Input (block) · local`) |
| Clear downstream routing | `allowed`, `blocked`, `primaryRiskType`, `finalDecision`, `riskLevel`, `outputText`, `userMessage`, `developerMessage` |
| Live chat safe fallback | `liveChatAction = SAFE_REPHRASE`, `safeRephrasePrompt` |
| Performance controls | Options collection: Items in Parallel, Layers in Parallel, Reuse Identical Items, Request Timeout, Include Raw API Response |
| Examples | 10 importable workflows in `examples/` (one legacy pattern kept for existing users), including one that runs with no credential at all |

## Detection Engine

| Item | Expected state |
| --- | --- |
| Modes | Cloud (default), Local, Auto |
| Local egress | None. The bundled rule engine runs in the n8n process; no API key, no network call |
| Local disclosure | Every local item carries `engine: "local"`, `engineDegraded`, and `engineDetail.limitations` |
| Auto fallback | Only when the cloud could not be *asked*: network failure, timeout, 5xx, 429, or no credential — item marked `engineDegraded: true` |
| Auto non-fallback | 401 / 403 / 400 fail the item; an authoritative refusal is never answered with a weaker engine |
| Unresolvable protected sources | Reported as `unresolvedSourceIds`, never as compared and clean |
| Finding shape | Type, label, severity, and match count only — never the matched text |

## Security Contract

- The node sends only configured text fields to the selected SoterAI API endpoint, and sends nothing at all in Local mode.
- The node does not collect telemetry.
- The node does not write local files.
- Zero runtime dependencies.
- API keys and common tokens are redacted from generated errors.
- `rawResponse` is secret-sanitized before returning to downstream nodes.

## Release Gate

Run before release:

```bash
npm --prefix packages/integrations/n8n test
npm --prefix packages/integrations/n8n run lint
npm --prefix packages/integrations/n8n run build
```

`npm test` runs the validator, the TypeScript typecheck, and the 54-test in-package suite; `prepublishOnly` runs the same gate, so a publish cannot skip it.

The package validator checks:

- Package name and n8n dist metadata.
- Required keywords.
- Required example workflows, including that the offline example still needs no credential.
- README/package/User-Agent version consistency.
- Sanitized `rawResponse` output and sanitized `continueOnFail` error items.
- Changelog privacy/security documentation.
- Local-engine honesty invariants: limitations attached to every local result, degraded marking on fallback, no fallback on an authoritative refusal, unresolved sources reported as unresolved, and findings that carry no matched text.
