# n8n Marketplace Readiness Checklist

Use this checklist before publishing `n8n-nodes-soterai`.

Current package version: `0.8.7`.

## Node Promise

SoterAI adds AI security guardrails to n8n workflows: prompt injection detection, jailbreak checks, secret/PII detection, RAG risk scanning, tool-call checks, memory safety checks, output guardrails, semantic egress checks, and workflow security audit.

## Credential Handling

| Item | Expected state |
| --- | --- |
| API key | Stored in n8n credentials, not workflow JSON |
| Credential requirement | `SoterAI API Key (x-api-key)` is optional for Local/Workflow Audit; Cloud actions require it, while Auto may fall back only for analysis—not identity/passport creation |
| Base URL | Configurable, defaults to production SoterAI |
| Project ID | Optional credential default or node override |
| Error output | Sanitized before returning to n8n |
| `rawResponse` | Recursively sanitized before downstream workflow output |

## User Experience

| Requirement | Evidence |
| --- | --- |
| Smallest action that protects something is the default | Resource defaults to `guardrail`, operation defaults to `inputGuard` ("Guard Input"), not a report-only action |
| Focused operations still available | Guard Input, Guard Output, Universal AI Firewall, Redact Secrets or PII, Scan Document, Audit Workflow, Analyze Text, and complete agent-passport lifecycle (11 operations across 4 resources) |
| Enforcement is part of the node, not homework | Node version 3 presents Resource → Operation with a clean Options collection; retains version 2's named `Safe` / `Flagged` outputs; version 1 keeps its single output for existing workflows |
| Canvas legibility | Subtitle shows the human action label, the On Threat setting, and the engine when it is not Cloud (`Guard Input (block) · local`) |
| Clear downstream routing | Stable `verdictCode`, `enforcement.outcome`, `enforcement.routedTo`, plus backward-compatible legacy fields |
| Live chat safe fallback | `liveChatAction = SAFE_REPHRASE`, `safeRephrasePrompt` |
| Performance controls | Options collection: Items in Parallel, Layers in Parallel, Reuse Identical Items, Request Timeout, Include Raw API Response |
| Examples | 11 importable workflows, including credential-free Local mode, complete passport lifecycle, and production customer support agent |
| Passport UX | Read Only, Customer Support, and Coding Agent least-privilege presets; token fields are password inputs; raw responses sanitize token keys |

## Detection Engine

| Item | Expected state |
| --- | --- |
| Modes | Auto (cloud-first default), Cloud, Local |
| Local egress | None. The bundled rule engine runs in the n8n process; no API key, no network call |
| Local disclosure | Every local item carries `engine: "local"`, `engineDegraded`, and `engineDetail.limitations` |
| Auto fallback | Only when the cloud could not be *asked*: network failure, timeout, 5xx, 429, or no credential — item marked `engineDegraded: true` |
| Auto non-fallback | 401 / 403 / 400 fail the item; an authoritative refusal is never answered with a weaker engine |
| Lifecycle non-fallback | Identity enrollment and passport issue/validate/revoke always require server-side state and never fall back to Local |
| Unresolvable protected sources | Reported as `unresolvedSourceIds`, never as compared and clean |
| Finding shape | Type, label, severity, and match count only — never the matched text |

## Security Contract

- The node sends only configured text fields to the selected SoterAI API endpoint, and sends nothing at all in Local mode.
- The node does not collect telemetry.
- The node does not write local files.
- Zero runtime dependencies.
- API keys and common tokens are redacted from generated errors.
- `rawResponse` is secret-sanitized before returning to downstream nodes.
- Passport tokens are exposed only as the documented one-time issuance output; generic `rawResponse` token keys are redacted.
- Version 0.8.7 is verified in real Docker n8n 2.x/1.x: package load/import, Safe/Flagged execution, mixed India PII redaction, prompt injection firewall blocking, OpenAI GPT-4o customer support routing, live webhook responses, authenticated node metadata, and masked token fields. Cloud passport calls still require a live SoterAI backend for a separate end-to-end environment test.

## Release Gate

Run before release:

```bash
npm --prefix packages/integrations/n8n test
npm --prefix packages/integrations/n8n run lint
npm --prefix packages/integrations/n8n run build
```

`npm test` runs the validator, the TypeScript typecheck, the 286-test in-package unit suite, the 164-pattern ReDoS sweep, and the 24-case stress test suite; `prepublishOnly` runs the same gate, so a publish cannot skip it.

The package validator checks:

- Package name and n8n dist metadata.
- Required keywords.
- Required example workflows, including that the offline example still needs no credential.
- README/package/User-Agent version consistency.
- Sanitized `rawResponse` output and sanitized `continueOnFail` error items.
- Changelog privacy/security documentation.
- Local-engine honesty invariants: limitations attached to every local result, degraded marking on fallback, no fallback on an authoritative refusal, unresolved sources reported as unresolved, and findings that carry no matched text.
