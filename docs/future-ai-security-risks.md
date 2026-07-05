# Future AI Security Risks and Product Modules

The modules below are proposed defense-in-depth controls, not promises to eliminate the risk.

| Future risk | Product module | Why it matters | MVP | Advanced implementation | Tests | UI / plan |
|---|---|---|---|---|---|---|
| Agent privilege escalation | Capability Boundary | Agents inherit broad human/service credentials | Signed manifest + scoped tool/domain/file policy | Short-lived capability tokens, workload identity, continuous privilege diff | Stolen/replayed token, confused deputy, scope escalation | Capability graph; Agent/Enterprise |
| Autonomous destructive actions | Transaction Safety Rail | One bad decision can create irreversible impact | Risk classes + approval + dry-run | Postconditions, reversible ledger, compensating action orchestration | Delete/payment/deploy race and replay | Transaction inbox/timeline; Agent |
| MCP/plugin compromise | Tool Trust Registry | Tool descriptions, packages or runtime can change | Manifest snapshot, hash, publisher and drift alert | Signature/transparency log, sandbox and behavior attestation | Rug pull, tool shadowing, schema drift, malicious output | Trust badge/diff; Agent |
| Browser-agent exfiltration | Browser Action Firewall | Web content is untrusted while the agent sees private data | DOM/source trust tags and form action check | Isolated agent profile, information-flow labels, remote browser containment | Hidden prompt, cross-tab, upload, cookie/session abuse | Page risk banner; Enterprise |
| Multi-agent collusion/context poisoning | Agent Message Gateway | Compromise propagates across delegated agents | Signed sender/audience/intent envelope | Trust graph, taint propagation, consensus and anomaly detection | Spoof, replay, privilege laundering, cyclic delegation | Agent topology; Agent |
| Long-term memory poisoning | Memory Firewall | Malicious state persists beyond a session | Scan, provenance, TTL, quarantine and rollback | Versioned semantic diff, trust-weighted retrieval, periodic rescan | Slow poisoning, fake approval, hidden trigger | Memory change review; Agent |
| Synthetic/training/fine-tune poisoning | Dataset Trust | Poisoned examples create persistent backdoors | Dataset manifest, source/version/hash and review | Statistical outliers, influence analysis, signed lineage | Label flips, trigger/backdoor, provenance tamper | Dataset lineage; Enterprise |
| Image/PDF/audio/video injection | Multimodal Trust Gateway | Instructions can be hidden outside text | Isolated extraction + OCR/transcript scan | Steganalysis, layout/source provenance, cross-modal consistency | Invisible text, QR, adversarial image/audio, polyglot file | Media findings; RAG/Enterprise |
| AI phishing/scam workflows | Social Engineering Guard | Agents can personalize and automate fraud | Output and action policy for impersonation/payment | Campaign graph, destination reputation, human confirmation | BEC, invoice switch, credential harvest | Campaign incident; Guard/Agent |
| Malware/dual-use generation | Cyber Safety Policy | Code output can facilitate harm | Use-case policy and static code scan | Sandbox behavior analysis and intent/action correlation | Obfuscated payload, unsafe packages, living-off-land | Code verdict; Developer/Enterprise |
| Non-human identity sprawl | Agent Identity Fabric | Unknown agents and stale keys evade governance | Inventory, owner, status, scopes, expiry | Workload federation, risk-based auth, automated rotation | Orphan, owner change, stale privilege | NHI inventory; Enterprise |
| Shadow AI | AI Usage Governance | Unapproved tools receive company data | Browser discovery and approved destination list | Endpoint/network discovery and data classification | Unknown AI site, renamed domain, local model | Usage map; Enterprise |
| Enterprise AI leakage | Semantic Egress DLP | Exact regex misses paraphrased confidential content | Fingerprint + PII/secret redaction | Label-aware semantic fingerprints with privacy-preserving matching | Paraphrase, partial record, cross-source joins | Lineage incident; Data/Enterprise |
| Local-model jailbreak | Local Model Policy | No provider safety layer exists | Same input/output guard with model identity | Model-specific calibration and isolated execution | Offline model families, quantizations, prompt templates | Model posture; Developer |
| Model router/proxy compromise | Provider Integrity | Router can alter prompts, models or responses | TLS, allowlist, model/provider receipt | Signed request/response provenance and multi-provider anomaly | Downgrade, response swap, endpoint takeover | Provider trace; Enterprise |
| Prompt/template supply chain | Prompt Registry | Shared templates can hide instructions | Version/hash/review/owner | Signing, provenance, dependency graph, diff policy | Lookalike template, hidden Unicode, version takeover | Prompt diff; Developer |
| n8n/Zapier/Make abuse | Workflow Firewall | Low-code chains amplify permissions and retries | Per-step guard, approvals, idempotency | Workflow graph analysis, least-privilege credentials, rollback | Loop/cost attack, secret hop, approval bypass | Workflow risk map; Automation |
| Vector database poisoning | Retrieval Integrity | Poisoned chunks can dominate retrieval | Trust score, quarantine, namespace, ACL | Signed embeddings, diversity/anomaly controls, tombstone proof | Rank manipulation, cross-tenant insert, stale ACL | Retrieval evidence; RAG |
| Insecure generated code | Secure Coding Output | Users may execute flawed code directly | Language-aware unsafe-pattern detector | SAST/SCA sandbox and repository context | Injection, auth bypass, secret, vulnerable dependency | Code fix diff; Developer |

## Research watch process

1. Review OWASP GenAI/Agentic, MITRE ATLAS and CSA AICM changes monthly.
2. Record new techniques as versioned threat-intelligence rules with source, confidence, expiry and reviewer.
3. Add a failing regression before changing enforcement.
4. Re-run fixed holdout and false-positive suites.
5. Ship new hard-block behavior behind a monitor/feature flag until evidence meets the release gate.
