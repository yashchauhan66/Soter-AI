# AI Security Risk Coverage Matrix

Legend: **Strong** = implemented with meaningful tests; **Partial** = implementation exists but coverage or production proof is incomplete; **Gap** = no reliable control found. Priorities reflect residual risk, not feature desirability.

| Risk | Framework mapping | Current coverage | Gap / control to add | API/UI/test change | Priority | User value |
|---|---|---|---|---|---|---|
| Direct prompt injection | OWASP LLM01; ATLAS LLM Prompt Injection | Partial | Raise independent recall; provenance-aware evidence | `/v1/guard`; finding evidence; external corpus gate | P1 | Fewer instruction hijacks |
| Indirect prompt injection | LLM01; ATLAS Prompt Infiltration | Partial | Mark untrusted source boundaries; scan tool/RAG/browser content | source metadata; trust-boundary UI; indirect dataset | P0/P1 | Stops hidden instructions |
| Jailbreak/role play | LLM01; ATLAS Jailbreak | Partial | Current benchmark subset recall is 36.36% | detector versions/confidence; jailbreak benchmark | P0/P1 | Lower bypass rate |
| Multi-turn/crescendo | Agent goal hijack/context poisoning | Partial | 60% recall on 5 attack sequences is insufficient | session risk API/timeline; larger adaptive suite | P0/P1 | Detects slow attacks |
| Encoding/Unicode/bidi/homoglyph | LLM01; ATLAS Obfuscation | Strong/Partial | Expand normalization invariants and multilingual FPR | normalized evidence hash; metamorphic tests | P1 | Resists cheap evasions |
| Markdown/HTML context injection | LLM01/LLM05 | Partial | Separate content from instruction channels | content provenance; renderer safety tests | P1 | Safer browsing/RAG |
| System prompt extraction | LLM07/ATLAS Extract System Prompt | Strong/Partial | Improve semantic coverage; never persist leaked text | leak category/version; regression corpus | P1 | Protects policies/IP |
| Secrets/API keys | LLM02 | Strong | Expand provider/token corpus and entropy calibration | redact/block policy; FP corpus | P1 | Prevents credential loss |
| General PII | LLM02; NIST privacy | Strong/Partial | Entity/context precision, locale policies | per-type action; redaction accuracy tests | P1 | Privacy and compliance |
| India PII | NIST privacy; DPDP context | Strong/Partial | Validate checksum/context and avoid identifier FPs | India template; Aadhaar/PAN/GSTIN/UPI test corpus | P1 | Regional differentiation |
| Unsafe output handling | LLM05 | Partial | Sink-aware output policy and safe rendering adapters | output context/sink field; XSS/code tests | P1 | Prevents downstream exploits |
| Harmful/phishing output | LLM02/LLM05 | Partial | Calibrated policy by use case; safe rewrite | category UI; phishing/social engineering suite | P2 | Safer user-facing output |
| Data exfiltration | LLM02; ATLAS Exfiltration | Partial | Universal semantic egress boundary | destination classification API; route E2E | P0/P1 | Stops sensitive outbound data |
| Tool-call injection/misuse | LLM06; OWASP ASI02 | Strong/Partial | Make pre-execution enforcement unavoidable | action check/capability token; execution E2E | P0/P1 | Prevents dangerous actions |
| Agent privilege escalation | ASI03; ATLAS Privilege Escalation | Partial | Short-lived scoped identities and privilege-diff enforcement | passport claims/UI; negative auth tests | P1 | Least privilege for agents |
| Agent goal hijack | ASI01 | Partial | Bind signed user intent to every consequential action | intent receipt; timeline; tamper/replay tests | P1 | Preserves user intent |
| Cross-agent contamination | ASI07 | Partial | Authenticate messages and sanitize delegated context | A2A envelope; topology UI; spoof tests | P1 | Safer multi-agent systems |
| Memory poisoning/exfiltration | ASI06 | Partial | Version, provenance, expiry, quarantine, rollback | memory check/store contract; persistence tests | P1 | Prevents durable compromise |
| Cascading failures | ASI08 | Partial | Circuit breakers, budgets, causal trace, compensation | cascade API/UI; chaos suite | P1 | Limits blast radius |
| Human-agent trust exploitation | ASI09 | Partial | Risk-aware approval UX; independent evidence | approval diff/rationale UI; social tests | P1 | Better human decisions |
| Rogue agent behavior | ASI10 | Partial | Behavioral baseline, kill switch, containment proof | heartbeat/quarantine; long-run tests | P1 | Stops anomalous autonomy |
| Unexpected code execution | ASI05; LLM05 | Partial | Real sandbox/OS isolation and command allowlists | dry-run sandbox receipt; escape tests | P0/P1 | Protects hosts |
| MCP/tool supply chain | ASI04; LLM03 | Partial | Signed manifests, publisher identity, version drift, CVEs | MCP registry/risk badge; malicious-server suite | P1 | Safer tool adoption |
| Model/provider supply chain | LLM03 | Partial | Provenance, signature, SBOM, vulnerability feed | model artifact scan API/UI; fixture suite | P1 | Safer model intake |
| Dataset/fine-tune poisoning | LLM04 | Partial/Gap | Dataset lineage, signed releases, anomaly/review workflow | dataset scan; provenance UI; poisoning corpus | P2 | Protects model integrity |
| RAG poisoning | LLM04; ATLAS RAG Poisoning | Strong/Partial | Independent recall; source signatures; rescan gates | quarantine/trust UI; poisoned corpus | P1 | Safer knowledge bases |
| Vector namespace isolation | LLM08 | Partial | Provider-native isolation/RLS and live two-tenant test | namespace health UI; Qdrant/pgvector E2E | P0/P1 | Prevents cross-tenant retrieval |
| Vector ACL/authorization continuity | LLM08 | Strong/Partial | Prove ACL changes propagate and caches invalidate | ACL version in retrieval result; continuity tests | P1 | Correct document access |
| Retrieval manipulation | LLM04/LLM08 | Partial | Diversity, trust weighting, anomaly detection | retrieval evidence; ranking attack tests | P2 | More reliable retrieval |
| Grounding/citation mismatch | NIST confabulation | Partial | Claim-source alignment and uncertainty policy | grounding score/evidence; benchmark | P1 | More trustworthy answers |
| Model denial of service/token flooding | LLM10 | Partial | Byte/token/tool/depth budgets and concurrency controls | budget headers/UI; load/abuse tests | P0/P1 | Availability and cost control |
| Cost exhaustion | LLM10; ATLAS Cost Harvesting | Partial | Atomic reservations, hard caps, anomaly response | cost firewall receipt; race tests | P1 | Predictable spend |
| Account/API-key abuse | Standard auth; ATLAS Valid Accounts | Partial | Scoped keys, rotation grace, anomaly and IP policy | key scopes/UI; stolen-key tests | P0/P1 | Limits credential blast radius |
| Tenant IDOR | LLM02/standard access control | Partial | Runtime two-tenant route matrix and DB backstop | consistent 404/403; all-ID negative suite | P0 | Protects customer data |
| Sensitive logging | LLM02; NIST privacy | Strong/Partial | Prove every event/worker/export path is safe | schema allowlists; secret canary tests | P0/P1 | Prevents secondary leaks |
| Webhook/SIEM SSRF | Standard SSRF | Partial | Central DNS-rebinding-safe egress gateway | egress policy UI; private-IP tests | P0 | Protects internal network |
| Event tampering/loss | NIST accountability | Partial | Append-only integrity, reconciliation, loss SLO | sequence/digest; chaos tests | P0/P1 | Defensible audit trail |
| Browser clipboard/file/page exfiltration | CSA browser risk; LLM02 | Partial | Host-minimal permissions and local-first scan | permission/data-flow UI; browser E2E | P0 | Safer employee AI use |
| Shadow AI | NIST Govern/Map | Partial | Inventory completeness, endpoint agent options, ownership | discovery dashboard; enterprise telemetry tests | P1 | Visibility and governance |
| Multimodal image/PDF injection | LLM01/LLM04 | Partial | Isolated extraction, provenance, adversarial image corpus | media findings; OCR/image tests | P1/P2 | Protects document workflows |
| Voice/audio/video injection | Emerging multimodal | Gap | Media transcription trust and hidden-channel detection | media scan API; dataset | P2 | Future multimodal safety |
| Insecure deserialization | LLM03/LLM05 | Partial | Scan actual artifacts and sandbox loading | artifact verdict; malicious fixtures | P1 | Prevents code execution |
| Output-generated insecure code | LLM05 | Partial | Language-aware SAST and context policy | code review API/UI; vulnerable-code corpus | P1 | Safer coding assistants |
| Policy bypass/transformation | LLM01 | Partial | Metamorphic and differential policy tests | policy simulator; invariance suite | P1 | Consistent enforcement |
| Insider misuse | NIST Govern; CSA AICM | Partial | Separation of duties, reason codes, UEBA, immutable logs | admin audit UI; abuse scenarios | P1 | Enterprise accountability |
| Compliance/auditability | NIST Govern/Measure | Partial | Evidence freshness, ownership, control tests, exports | assurance dashboard; evidence expiry tests | P1 | Faster audits |
| Non-human identity risk | ASI03 | Partial | Inventory, owner, rotation, capabilities, revocation | identity fabric UI; lifecycle E2E | P1 | Govern agent identities |
| Workflow automation abuse | ASI02/ASI08 | Partial | Step-level enforcement, idempotency, approval and rollback | n8n decision outputs; malicious workflow E2E | P1 | Safer automation |

## OWASP LLM Top 10 2025 summary

| OWASP risk | SoterAI posture | Residual priority |
|---|---|---|
| LLM01 Prompt Injection | Broad direct/indirect/Unicode/multi-turn controls, uneven benchmark recall | P0/P1 |
| LLM02 Sensitive Information Disclosure | Strong redaction/log safety and egress modules, behavioral assurance incomplete | P0/P1 |
| LLM03 Supply Chain | Model/MCP modules exist, CI and artifact attestation incomplete | P0/P1 |
| LLM04 Data and Model Poisoning | RAG controls are meaningful; training/fine-tune controls partial | P1/P2 |
| LLM05 Improper Output Handling | Output/code detectors exist; sink-specific enforcement partial | P1 |
| LLM06 Excessive Agency | Agent control breadth is strong; mandatory runtime boundary is incomplete | P0/P1 |
| LLM07 System Prompt Leakage | Detector and safe logging exist; bypass calibration remains | P1 |
| LLM08 Vector and Embedding Weaknesses | Namespace/ACL/audit exist; provider-native proof incomplete | P0/P1 |
| LLM09 Misinformation | Grounding/hallucination indicators exist; claim verification evidence is limited | P1/P2 |
| LLM10 Unbounded Consumption | Rate/quota/cost controls exist; concurrency and race proof incomplete | P0/P1 |

## OWASP Agentic Top 10 2026 summary

SoterAI has named modules touching all ten agentic risks, which is a product strength. Coverage should not be marketed as complete: ASI01-ASI10 controls need an unavoidable enforcement point, persistent-state/race tests, live tool integrations, and containment evidence. The immediate order is ASI03 identity/privilege, ASI02 tool misuse, ASI01 goal hijack, ASI04 supply chain, and ASI06 memory/context poisoning.
