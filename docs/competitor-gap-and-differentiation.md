# Competitor Gap and Differentiation

This is a category-level comparison based on publicly observable product patterns and the inspected repository. It is not a claim that every vendor in a category has every capability. Representative current patterns include [Prisma AIRS runtime and agent security](https://docs.paloaltonetworks.com/ai-runtime-security), [Microsoft Purview AI data security](https://learn.microsoft.com/en-ie/purview/ai-microsoft-purview), and [Protect AI model scanning](https://protectai.com/guardian).

Legend: **S** strong/common, **P** partial/varies, **—** usually outside category.

| Capability | AI firewall/gateway | Prompt scanner | RAG security | AI governance | DLP/SSE | Browser AI safety | Agent security | SIEM/SOC | Developer SDK | SoterAI today |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Input/output guard | S | S | P | P | P | P | P | — | S | S |
| Prompt/indirect injection | S | S | S | — | — | P | S | P | S | P/S |
| Jailbreak | S | S | P | — | — | P | P | P | S | P |
| Tool-call security | P | — | — | P | — | — | S | P | P | P/S |
| Agent approval/escrow | P | — | — | P | — | — | S | P | P | P/S |
| RAG scan/vector ACL | P | P | S | P | — | — | P | — | P | P/S |
| PII/secrets/DLP | S | P | P | P | S | S | P | P | P | S |
| Policy engine | S | P | P | S | S | S | S | S | P | S |
| Multi-tenant SaaS/RBAC | S | P | S | S | S | S | S | S | — | P/S |
| SDK/API/framework DX | S | S | P | P | P | — | P | P | S | S |
| n8n/low-code integration | P | P | — | P | P | — | P | P | P | S |
| Browser extension | — | — | — | P | P | S | — | — | — | S |
| SIEM/webhooks/audit | S | P | P | S | S | P | S | S | P | S |
| Compliance exports | P | — | P | S | S | P | P | S | — | P/S |
| Model/artifact scanning | P | — | — | P | — | — | P | P | — | P |
| Red-team/evaluation | P/S | P | P | P | — | — | P | P | P | P |
| Proven production scale | S for leaders | varies | varies | S for leaders | S for leaders | varies | emerging | S | varies | Not proven |

## Where SoterAI can win

SoterAI should not try to out-market established network/DLP vendors on global telemetry, appliance footprint, or compliance certifications before evidence exists. The defensible wedge is a unified, developer-first control plane for Indian SMEs and AI-automation builders that combines surfaces other vendors often sell separately.

1. **India-specific data protection:** checksum/context-aware Aadhaar, PAN, GSTIN, UPI and regional phone detection; Hindi/Hinglish attacks; DPDP-oriented policy/evidence packs. The claim must be measured by published corpora and redaction accuracy.
2. **Automation security:** first-class n8n workflows, then Zapier/Make, with input/output guard, tool-step approval, secret-safe logs, idempotency and rollback. This is more concrete than generic “agent security.”
3. **One policy across browser, API, RAG and agents:** a policy compiled to each enforcement point with the same version/digest and explainable action.
4. **Local-first privacy:** deterministic redaction in the extension/edge path; only hashes, categories and bounded evidence leave the device when policy permits.
5. **Developer experience:** additive unified API, generated typed SDKs, OpenAI-compatible proxy, framework middleware, copyable test cases, and a policy simulator.
6. **Agent transactions, not just prompts:** signed intent, capability-bound identity, chain risk, dry run, approval, escrow, execution receipt and compensating action.
7. **Affordable assurance:** transparent benchmarks, reproducible threat packs, customer-specific regression suites and evidence exports instead of absolute claims.

## Capability gaps versus leading category patterns

| Market expectation | SoterAI gap | Close with | Evidence required |
|---|---|---|---|
| Runtime leaders show transaction/session IDs and detailed violations | Guard contract lacks stable request/detector/policy versions | `/v1/guard` additive facade | Contract tests and trace correlation |
| DLP leaders integrate labels, endpoint controls and broad discovery | Extension is browser-centric and wildcard-heavy | Host-minimal local DLP + label/connectors roadmap | Browser E2E and privacy review |
| Agent leaders enforce every tool call | SoterAI APIs can be bypassed by integrations that do not call them | Mandatory proxy/hook/capability receipt | Real tool execution tests |
| Model-security leaders scan many formats locally in CI | Artifact scanning is partial | Isolated scanner, signed verdict, SBOM | Malicious model corpus |
| Enterprise platforms provide mature support/certification | SoterAI controls are not externally certified | Pilot evidence, SOC 2 program, SLAs | Independent audit |
| Mature platforms prove scale and regional deployment | SoterAI has component benchmarks | Staging load/chaos/cost suite | Reproducible environment and reports |

## Product packaging recommendation

| Plan | Primary buyer | Included differentiation |
|---|---|---|
| Developer | Individual/team | Guard API, SDKs, basic policies, local benchmark, limited logs |
| Automation | Agencies/SMEs | n8n/Flowise/Botpress, approvals, webhooks, India PII, reports |
| Data & RAG | Knowledge-app teams | ingestion quarantine, ACL/namespace, grounding, citation evidence |
| Agent Control | Agent builders | passports, intent, tool chain, dry-run, escrow, memory and MCP controls |
| Enterprise | Security/governance | SSO/SCIM, SIEM, retention, extension management, private deployment, evidence |

## Positioning language

Use: “SoterAI is a defense-in-depth AI security control plane for prompts, data, RAG, browsers, workflows and agent actions.”  
Avoid: “complete AI security,” “100% secure,” “zero risk,” “unbreakable,” or “best in the world.”  
Only compare measured capability, latency, recall, false-positive rate, deployment time, or price under a disclosed methodology.
