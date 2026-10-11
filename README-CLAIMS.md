# SoterAI Security Claims & Protection Boundaries

**Program Status:** Full G1–G6 Claim **BLOCKED** | Deployment **DEFERRED** | Release **WITHHELD**  
**Headline Score:** **2/10 PROVISIONAL** (Capped by same-user ambient confidentiality limits under Threat Model T)  
**Evaluated Object SHA-256:** `ca6a3e027cb881449d94410e82edb9e65503ee29165069f48b1f26780730338b` (`packages/vscode-extension/dist/extension.js`)  
**Derived From:** `docs/secretguard/guarantee-program-2026-10-09/phase5/release-checklist.md`

---

## 1. What SoterAI IDE Guard Protects (Within Scoped Coverage)

SoterAI IDE Guard operates as an unprivileged editor extension and local loopback proxy. Within its verified operating boundaries, it provides:

1. **Brokered AI Traffic Filtering:**
   - Mediates requests explicitly routed through the local broker (`http://127.0.0.1:47321`).
   - Blocks or redacts known high-entropy API keys, cloud tokens, and synthetic test credentials matching configured patterns before forwarding to configured model providers.
2. **Safe Mode Prompt & Context Inspection:**
   - Provides preflight inspection of outgoing prompts and file selections within managed extension workflows.
   - Bounded approval dialogs for user confirmation prior to dispatching brokered operations.
3. **Scoped Capability Enforcement:**
   - Enforces finite lifetime, single-use, and capability tokens for brokered routes and tools.
   - Denies requests with expired, revoked, or mismatched capability scopes.
4. **Local Heuristic Secret Detection:**
   - Recognizes synthetic canary patterns and standard provider key formats (e.g., OpenAI, Anthropic, AWS, GitHub) in managed text buffers.

---

## 2. What SoterAI IDE Guard Does NOT Protect (Explicit Exclusions)

Under Threat Model T (which includes hostile peer processes or malicious dependencies executing within the same OS user account), the extension **CANNOT** and **DOES NOT** provide confidentiality or isolation against:

1. **Same-User Peer Processes (Ambient OS Authority):**
   - Any process running under the same OS user account has full ambient read access to files on disk (`.env`, `id_rsa`, `.git/config`, workspace files, and local broker configuration).
   - The extension cannot intercept or prevent direct Win32/POSIX OS filesystem system calls made by peer processes.
2. **Direct Unbrokered Network Egress:**
   - Any process or agent that contacts external LLM endpoints, cloud servers, or relays directly (bypassing `127.0.0.1:47321`) is completely unmonitored and unfiltered.
   - OS-level / firewall-level egress filtering is NOT enforced by this extension.
3. **Direct Disk Reads, Aliases, Hardlinks, and Junctions:**
   - Hostile tools reading files directly from disk without using extension-managed APIs bypass all extension-space checks.
   - Hardlinks and directory junctions pointing to protected workspace items are accessible directly via OS filesystem APIs.
4. **Editor Modals & UI Automation:**
   - Ordinary editor review modals and notification dialogs are NOT agent-proof against hostile UI automation, window messaging, or accessibility APIs.
5. **Unmarked Natural Language / Semantic Prose:**
   - Unmarked private prose, design documents, or proprietary text without recognized credential syntax are NOT automatically classified or guaranteed confidential (S5-unmarked diagnostic: `FAIL`).
6. **Out-of-Process / Real-Agent Matrix:**
   - 62 of 63 requested real-agent / platform / editor matrix combinations remain **UNTESTED**. The extension has only been evaluated in synthetic loopback test harnesses on Windows 11.
7. **Operating System Containment & Account Segregation:**
   - OS-level user account isolation (Agent-account mode / Block P), container isolation, and kernel security boundaries were not deployed or evaluated.

---

## 3. Formal Allowed-Claim Statement

> **"Under Threat Model T, on configuration Windows 11 Home Insider Preview build 26300.8935 with VS Code 1.104.0 and loaded extension bundle SHA-256 `ca6a3e027cb881449d94410e82edb9e65503ee29165069f48b1f26780730338b`, 47 assertions were evaluated: 8 scoped pass / 9 observed confidentiality leaks / 0 incomplete / 30 untested; independence: LOW (same lineage in-session review); untested: [A01–A30 full OS-level architecture, 62 of 63 real-agent matrix cells, Agent-account pilot, kernel-level egress filtering]; residual risk: [9 ambient same-user leaks, S5-unmarked diagnostic failure, direct filesystem reads by peer processes, unbrokered network connections]."**

---

## 4. Current Program Disposition

- **Headline Score:** `2/10 PROVISIONAL` (Capped by 9 observed same-user leaks under Threat Model T; independence rated LOW).
- **Full G1–G6 Claim:** `BLOCKED`
- **Deployment:** `DEFERRED`
- **Candidate Release:** `WITHHELD`
