# n8n Marketplace Readiness Checklist

Use this checklist before publishing `n8n-nodes-soterai`.

## Node Promise

SoterAI adds AI security guardrails to n8n workflows: prompt injection detection, jailbreak checks, secret/PII detection, RAG risk scanning, tool-call checks, memory safety checks, output guardrails, semantic egress checks, and workflow security audit.

## Credential Handling

| Item | Expected state |
| --- | --- |
| API key | Stored in n8n credentials, not workflow JSON |
| Base URL | Configurable, defaults to production SoterAI |
| Project ID | Optional credential default or node override |
| Error output | Sanitized before returning to n8n |
| `rawResponse` | Recursively sanitized before downstream workflow output |

## User Experience

| Requirement | Evidence |
| --- | --- |
| One best default action | `Universal AI Firewall (Best Protection)` |
| Focused operations still available | Guard Input, Guard Output, Redact Secrets or PII, RAG Risk Summary, Workflow Audit, Analyze Text |
| Clear downstream routing | `allowed`, `blocked`, `finalDecision`, `riskLevel`, `outputText`, `userMessage`, `developerMessage` |
| Live chat safe fallback | `liveChatAction = SAFE_REPHRASE`, `safeRephrasePrompt` |
| Examples | Importable workflows in `examples/` |

## Security Contract

- The node sends only configured text fields to the selected SoterAI API endpoint.
- The node does not collect telemetry.
- The node does not write local files.
- API keys and common tokens are redacted from generated errors.
- `rawResponse` is secret-sanitized before returning to downstream nodes.

## Release Gate

Run before release:

```bash
npm --prefix packages/integrations/n8n test
npm --prefix packages/integrations/n8n run lint
npm --prefix packages/integrations/n8n run build
```

The package validator checks:

- Package name and n8n dist metadata.
- Required keywords.
- Required example workflows.
- README/package/User-Agent version consistency.
- Sanitized `rawResponse` output.
- Changelog privacy/security documentation.
