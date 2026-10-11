# Independent Security Review Prompt: SoterAI IDE Guard

## Reviewer Instructions

You are acting as an Independent Security Verifier conducting a rigorous, defensive verification of SoterAI IDE Guard.
Your task is to independently analyze the bundled software artifacts in this packet against the security specifications and acceptance criteria provided in the `targets/` directory.

---

### 1. Verification Scope & Rules
1. **Defensive Assessment Only:**
   - Conduct a defensive review of the owner's own software.
   - Do NOT produce exploit code, weaponized attacks, or bypass payloads.
   - For every finding, provide actionable defensive recommendations and remediation guidance.
2. **Synthetic Data & Loopback Only:**
   - All tests, fixtures, and evaluations must use synthetic dummy values.
   - Never use, read, or transmit real API keys, tokens, or credentials.
   - Dynamic checks, if conducted, are strictly restricted to loopback (127.0.0.1) inside an isolated test environment.
3. **Safety Filters & Refusals:**
   - If any automated safety policy or system filter triggers, record the exact refusal text verbatim.
   - Mark the affected assessment as `INCOMPLETE`. Never attempt to circumvent or rephrase around safety restrictions.
4. **Honest Labeling:**
   - Classify each evaluated assertion using only: `PASS`, `FAIL`, `INCOMPLETE`, `UNTESTED`, `STATIC-ONLY`.
   - Never mark an item `PASS` based on assumption or absence of evidence. If dynamic runtime enforcement is required but unverified, mark it `STATIC-ONLY` or `UNTESTED`.

---

### 2. Verified Object Identity

Verify that the artifacts under review match the following cryptographic identity:

- **Source Git Commit:** `e795827fba9b0bbd8d389bd92492cb38528cc54d`
- **Extension Bundle:** `product/dist/extension.js`
  - SHA-256: `ca6a3e027cb881449d94410e82edb9e65503ee29165069f48b1f26780730338b`
- **Local AI Broker:** `product/dist/local-ai-broker.js`
  - SHA-256: `6c07093d81243f0063bfd8d51b3d23a162cd3b4375c312c75b59e95f8239a397`
- **MCP Server:** `product/dist/soterai-mcp-server.js`
  - SHA-256: `6d5e1199d509139387e542e91faad02b790e692415416bd7eb5510a6e6ecc486`
- **Package Manifest:** `product/package.json`

#### Build Instructions (Reproducibility Verification)
- **Prerequisites:** Node.js v22.16.0+, npm v10.9.2+, TypeScript v5.7.2
- **Build Execution:**
  ```bash
  npm ci
  npm run build
  ```
- **Verification:** Recompute SHA-256 hashes of compiled artifacts using `Get-FileHash` or `sha256sum` to confirm exact matching.

---

### 3. Review Reference Materials
- **Threat Model T & Guarantees G1–G6:** See `targets/guarantee-spec.md`.
  - Assumes a hostile normal USER-level agent, malicious extensions, and MCP components with access to filesystem, terminal, Git, network, and editor commands within the user session.
- **Acceptance Assertions A01–A30:** See `targets/acceptance-criteria.md` and `expected-results.md`.
- **Evidence Contract:** See `evidence-format.md`.
- **Results Template:** See `assertion-results-template.csv`.

---

### 4. Required Report Structure

Deliver your complete independent review report in Markdown using the following structure:

#### Section 1: Reviewer Declaration & Setup
- Independent Reviewer declaration (model name, version, session timestamp UTC).
- Confirmation of fresh session state without inherited assumptions.
- Cryptographic hash verification table confirming the SHA-256 of all reviewed files.

#### Section 2: Detailed Security Findings
For each identified security gap, vulnerability, or architectural bypass, document:
- **Finding ID:** Unique ID (e.g., `FINDING-01`, `FINDING-02`)
- **Severity:** `Critical` | `High` | `Medium` | `Low` | `Informational`
- **Affected Assertion:** Specific assertion(s) from A01–A30
- **Affected Component:** File path and symbol/line reference in `product/dist/`
- **Description:** Explanation of the mechanism and threat condition
- **Evidence:** Exact code snippet or observed behavior
- **Defensive Remediation:** Recommended defensive architectural or code fix

#### Section 3: A01–A30 Acceptance Dispositions
Provide a structured table evaluating all 30 acceptance criteria:
- Columns: `Assertion ID` | `Status` (`PASS` / `FAIL` / `INCOMPLETE` / `UNTESTED` / `STATIC-ONLY`) | `Positive Control` | `Observation & Evidence Summary`
- Explicitly distinguish between statically verifiable protections and runtime boundaries requiring operating system confinement.

#### Section 4: Real-Agent & Platform Matrix Status
- Document evaluation status across requested platforms (Windows, Linux, macOS) and AI agent integrations (Claude Code, Cursor, Continue, Copilot, Cline, Roo Code).
- Mark unobserved matrix cells as `NOT_TESTED` or `UNSUPPORTED`.

#### Section 5: Residual Risks & Architectural Limitations
- Document explicit limitations of extension-space security versus kernel/operating-system level process containment.
- Detail risks regarding same-user process memory inspection, direct disk reads, and process token inheritance.

#### Section 6: Final Independent Verdict
- Concise summary of overall defensive posture, validated strengths, and key open risks.
