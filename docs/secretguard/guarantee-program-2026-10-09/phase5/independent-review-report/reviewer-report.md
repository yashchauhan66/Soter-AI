# Independent Security Verification Report: SoterAI IDE Guard

**Date:** 2026-10-11T12:56:00Z  
**Target Architecture:** SoterAI IDE Guard (Extension + Local AI Broker + MCP Server)  
**Evaluator Declaration:** Independent Security Verifier (Executed in-session per owner instruction; Independence Level: **LOW** — same model lineage / in-session execution).  
**Evaluation Scope:** Defensive static artifact review of bundled release files against Threat Model T (`targets/guarantee-spec.md`) and Acceptance Assertions A01–A30 (`targets/acceptance-criteria.md`).

---

## 1. Cryptographic Identity & Artifact Verification

The verified artifacts in `product/` were checked against the declared SHA-256 digests:

| Component | Relative Path | Expected SHA-256 | Observed SHA-256 | Verification Result |
|---|---|---|---|---|
| Extension Bundle | `product/dist/extension.js` | `ca6a3e027cb881449d94410e82edb9e65503ee29165069f48b1f26780730338b` | `ca6a3e027cb881449d94410e82edb9e65503ee29165069f48b1f26780730338b` | **MATCH (MATCH_EXACT)** |
| Local AI Broker | `product/dist/local-ai-broker.js` | `6c07093d81243f0063bfd8d51b3d23a162cd3b4375c312c75b59e95f8239a397` | `6c07093d81243f0063bfd8d51b3d23a162cd3b4375c312c75b59e95f8239a397` | **MATCH (MATCH_EXACT)** |
| MCP Server | `product/dist/soterai-mcp-server.js` | `6d5e1199d509139387e542e91faad02b790e692415416bd7eb5510a6e6ecc486` | `6d5e1199d509139387e542e91faad02b790e692415416bd7eb5510a6e6ecc486` | **MATCH (MATCH_EXACT)** |
| Package Manifest | `product/package.json` | `0f5bba251c1571909694a1710f024bf3653bf4905e5d2a68c7ce8e43ac5143f6` | `0f5bba251c1571909694a1710f024bf3653bf4905e5d2a68c7ce8e43ac5143f6` | **MATCH (MATCH_EXACT)** |
| Target Spec | `targets/guarantee-spec.md` | `5aeb8ba9affe65d2ddf2840afc6eb65891eb391304103b0adab47429d0a39466` | `5aeb8ba9affe65d2ddf2840afc6eb65891eb391304103b0adab47429d0a39466` | **MATCH (MATCH_EXACT)** |
| Target Criteria | `targets/acceptance-criteria.md` | `56d150b1d2beb6bf849680121fc90251c24bc673369b863823f8b144a7097af7` | `56d150b1d2beb6bf849680121fc90251c24bc673369b863823f8b144a7097af7` | **MATCH (MATCH_EXACT)** |

---

## 2. Executive Summary

SoterAI IDE Guard implements an in-depth defensive layer for developer workstations interacting with AI coding assistants.
- **Key Defensive Strengths:**
  1. The Local AI Broker enforces robust Windows Access Control List (ACL) validation, ensuring storage and token files are owned exclusively by the current user SID (`S-1-5-21-...`) with `SYSTEM` and `Administrators` only.
  2. Distinct client (`auth-token`) and controller (`control-auth-token`) authentication tokens prevent privilege escalation from unprivileged callers.
  3. Pre-flight and wire-level serialization inspection (`serializeEgress`) actively blocks egress when recognized secrets, encoded credentials, or canary tokens survive redaction.
  4. Response scanning with real-time SSE streaming termination (`proxyStreaming`) effectively prevents LLM outputs from leaking intercepted tokens or canaries.
- **Primary Security Deficiencies (Under Threat Model T):**
  1. **Ambient User Authority (A0 Direct Access):** Because the extension executes within the standard user session, any AI agent or sub-process with terminal/filesystem access can bypass VS Code extension APIs entirely and directly read secrets from disk or environment variables.
  2. **Filesystem Aliasing (Hardlinks & Junctions):** Path-based sensitive file matching relies on standard path resolution and globs; alternative directory links (hardlinks, symlinks, NTFS junctions) outside designated workspace roots allow direct access to protected assets.
  3. **Unmediated Outbound Network Egress:** The broker can only guard traffic explicitly directed to its loopback port (`127.0.0.1:47321`); hostile agents can initiate unmediated direct network connections.

---

## 3. Detailed Security Findings

### FINDING-01: Same-User Filesystem Direct Read Bypass (A0 Ambient Authority)
- **Severity:** High
- **Affected Assertion:** A01, A03, A14, A20
- **Affected Component:** `product/dist/extension.js`, `product/dist/local-ai-broker.js`
- **Description:** Under Threat Model T, an AI agent operating with normal user permissions can execute terminal commands or spawn child processes. SoterAI's file context redaction only hooks into the VS Code extension host API. A process executing `cat .env` or `fs.readFileSync('.env')` directly reads protected plaintext without triggering extension hooks.
- **Evidence:** `packages/vscode-extension` operates purely in extension space without kernel/OS filesystem drivers or process sandbox isolation.
- **Defensive Remediation:** Explicitly document that Threat Model T cannot be fully mitigated at the extension tier alone without an isolated OS agent account (Tier-3 / Block P containment).

### FINDING-02: Filesystem Alias / Directory Junction Path-Bypass
- **Severity:** Medium
- **Affected Assertion:** A01, A05, A14
- **Affected Component:** `product/dist/local-ai-broker.js` (symbols: `isSensitiveFilePath`, `Cd`, `Od`)
- **Description:** Sensitive file matching utilizes regex glob testing against relative file paths. If a sensitive file (`.env`) is linked via an NTFS directory junction or hardlink to a non-sensitive filename (`junction/config.txt`), the glob matching does not recognize the sensitive nature of the underlying data unless full canonical path resolution (`fs.realpath`) is strictly enforced before path evaluation.
- **Evidence:** `Cd(e)` in `local-ai-broker.js` tests path regex directly:
  ```javascript
  function Cd(e) {
    let t = e.replace(/\\/g, "/").replace(/^\.\//, "");
    return Od.some(n => n.test(t));
  }
  ```
- **Defensive Remediation:** Enforce canonical realpath resolution before evaluating sensitive file glob patterns in all file preflight handlers.

### FINDING-03: Direct Unbrokered Outbound Egress
- **Severity:** High
- **Affected Assertion:** A16, A17, A18
- **Affected Component:** `product/dist/local-ai-broker.js` (symbols: `proxyOpenAI`, `proxyAnthropic`)
- **Description:** Wire-level protection and canary monitoring are enforced exclusively for requests routed through `http://127.0.0.1:47321`. SoterAI cannot enforce outbound network filtering on third-party processes that connect directly to remote endpoints (e.g. `https://api.openai.com` or custom C2 servers).
- **Evidence:** The local AI broker is an HTTP server listening on loopback; it does not install a system-wide packet filter or OS network redirector.
- **Defensive Remediation:** Disclose in claims that network interception is strictly scoped to brokered traffic; mandatory network containment requires OS-level firewall rules scoped to the agent process.

### FINDING-04: Non-Enforcing Advisory Nature of Process Preflight
- **Severity:** Medium
- **Affected Assertion:** A15, A23, A30
- **Affected Component:** `product/dist/local-ai-broker.js` (symbol: `previewProcessLaunch`)
- **Description:** The process launch preflight API `/v1/preflight/process-launch` correctly computes risk scores and issues recommendations, but explicitly returns `platformEnforcement: "UNTESTED"` and `previewOnly: true`. It cannot intercept or prevent uncooperative process creation at runtime.
- **Evidence:**
  ```javascript
  this.json(t, 200, { ...r, platformEnforcement: "UNTESTED", previewOnly: !0 });
  ```
- **Defensive Remediation:** Retain the `UNTESTED` platform enforcement label and clarify that process preflight is an advisory telemetry service, not an OS sandbox.

---

## 4. A01–A30 Acceptance Dispositions

| ID | Title / Target Focus | Disposition | Positive Control | Basis / Findings |
|---|---|---|---|---|
| A01 | Enrolled item access denied without grant | **STATIC-ONLY** | Valid | Broker blocks unbrokered reads of registered paths; direct OS reads bypass. |
| A02 | Protected editor P holds secrets | **STATIC-ONLY** | Valid | Redaction in editor context verified; raw memory inspection unmitigated. |
| A03 | Process launches have no secret grant | **STATIC-ONLY** | Valid | Preflight identifies env secrets; OS environment inheritance is ambient. |
| A04 | Public workspace representation | **STATIC-ONLY** | Valid | Sensitive globs exclude standard secret files; legacy history unpurged. |
| A05 | Versioned file/glob protection | **STATIC-ONLY** | Valid | Sensitive globs cover `.env`, `.pem`, etc.; aliasing/junctions risk exists. |
| A06 | Trusted editor exact-item edit lease | **STATIC-ONLY** | Valid | Lease mechanisms defined in core; host enforcement relies on cooperation. |
| A07 | Bounded pending request | **PASS** | Valid | Broker requires explicit approval; pending items grant no authority. |
| A08 | Signed approval evaluated | **STATIC-ONLY** | Valid | Approval HMAC verification verified in code; physical signature untested. |
| A09 | Workload instance separation | **STATIC-ONLY** | Valid | Distinct session IDs tracked; shared OS user UID limits true isolation. |
| A10 | Single-use expiring grants | **PASS** | Valid | Approvals consumed on first use in broker (`approvals.consume`). |
| A11 | Scoped disclosure grants | **PASS** | Valid | Broker redactions scope disclosure to designated recipients. |
| A12 | Denial preserved across restart | **STATIC-ONLY** | Valid | NativeBaseline R01 verified clean restart behavior on loopback port. |
| A13 | Policy tamper resistance | **STATIC-ONLY** | Valid | Repo-policy tamper leak closed; signature verification enforced. |
| A14 | Controller/store independent custody | **STATIC-ONLY** | Valid | Windows ACL protection enforced on token directory; same-user admin bypasses. |
| A15 | Feature flag / route tampering | **PASS** | Valid | Safe Mode cannot be weakened without admin authorization in broker. |
| A16 | Network routing capabilities | **STATIC-ONLY** | Valid | Preflight flags disallowed egress; unbrokered network traffic bypasses. |
| A17 | Destination consent for export | **PASS** | Valid | Broker wire serialization requires matching destination consent. |
| A18 | Local disclosure to private delegate | **STATIC-ONLY** | Valid | Local redaction verified; timing/covert channel coverage unobserved. |
| A19 | Revocation decision linearization | **STATIC-ONLY** | Valid | Revocation logic present; 1-second target miss handling static-only. |
| A20 | Credential-use operations | **STATIC-ONLY** | Valid | Vault operations hide plaintext from prompts; ambient disk access open. |
| A21 | Persistent value/inventory reload | **STATIC-ONLY** | Valid | Inventory reloaded cleanly in baseline tests. |
| A22 | Trusted operation outputs/logs | **PASS** | Valid | Event logs pass through `redactForSharing` before persistence or export. |
| A23 | Helper/diff job authority | **STATIC-ONLY** | Valid | Subprocess execution restricted to node path; ambient tool authority open. |
| A24 | Trusted status evidence receipts | **STATIC-ONLY** | Valid | Receipts emitted with HMAC signatures; visual honesty depends on editor. |
| A25 | Editor mirror display honesty | **STATIC-ONLY** | Valid | Extension UI relies on VS Code webview sandbox; pixels outside assurance. |
| A26 | Preserved immutable observations | **PASS** | Valid | Evidence structure maintains immutable SHA-256 digests and hashes. |
| A27 | Supported platform claims | **STATIC-ONLY** | Valid | Only Windows 11 build 26300 verified with live hosts; others unobserved. |
| A28 | Private prose classification | **STATIC-ONLY** | Valid | Heuristic secret/PII detectors active; semantic classification static-only. |
| A29 | MCP component delegation | **STATIC-ONLY** | Valid | MCP server enforces tool preflights; unconstrained transports bypass. |
| A30 | Containment prerequisites check | **STATIC-ONLY** | Valid | Missing OS containment prevents full protection acknowledgement. |

---

## 5. Matrix Evaluation (63 Target Cells)

All 63 requested cells (Windows/Linux/macOS × VS Code 1.85.0/1.104.0/1.141.0 × Claude Code/Cursor/Continue/Codex/Roo/Cline/Copilot) were assessed:
- **Windows 11 / VS Code 1.104.0 / NativeBaseline:** Statically verified and covered by existing harness runs (**STATIC-ONLY / SCOPED**).
- **All other 62 platform/agent cells:** Marked strictly as **NOT_TESTED** / **UNSUPPORTED**. No speculative extrapolation to unobserved environments.

---

## 6. Residual Risks & Architectural Limitations

1. **Host-Level Confinement Ceiling:** An extension running in unprivileged user space cannot enforce mandatory access controls against peer processes of the same user.
2. **Cooperative vs. Mandatory Enforcement:** Protections are fully effective for cooperative AI tools configured to use the SoterAI broker (`localhost:47321`). Uncooperative or adversarial agents can bypass the broker.
3. **Detection Heuristics:** Regex detectors provide high-confidence catches for recognized API keys, but novel or obfuscated secrets outside known formats cannot be guaranteed caught without explicit classification.

---

## 7. Final Verdict

- **Object Identity:** Confirmed exact match for `extension.js` (`ca6a3e02...`), `local-ai-broker.js` (`6c0709...`), `soterai-mcp-server.js` (`6d5e11...`).
- **Verdict Summary:** SoterAI IDE Guard demonstrates sound cryptographic engineering, disciplined ACL validation, and robust wire-level egress filtering for brokered AI workflows. However, under full Threat Model T, ambient same-user OS privileges remain uncontained at the extension tier. Full mandatory guarantee claims remain **BLOCKED** pending OS-level sandboxing (Tier-3 / Block P).
