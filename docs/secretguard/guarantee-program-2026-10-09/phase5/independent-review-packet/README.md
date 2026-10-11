# Independent Review Packet — SoterAI IDE Guard

## 1. Overview & Objective
This review packet contains the complete, self-contained materials for an independent security verification of SoterAI IDE Guard.
The verification is a defensive artifact and architectural review of the software against Threat Model T (defined in `targets/guarantee-spec.md`) and Acceptance Assertions A01–A30 (defined in `targets/acceptance-criteria.md`).

## 2. Reviewer Boundaries & Rules
1. **Defensive Verification Only:**
   - No exploit code, attack payloads, or weaponized scripts.
   - Do not attempt to bypass security controls by writing executable exploits.
   - Provide concrete, defensive recommendations and remediation advice for any identified gaps.
2. **Synthetic Data Only:**
   - Only synthetic test fixtures and simulated canaries may be used.
   - Never use or reference real secrets, API keys, credentials, or private tokens.
3. **Loopback & Isolation:**
   - If dynamic checks are executed, they must run strictly on loopback (127.0.0.1) in an isolated editor profile.
   - No external network connections, telemetry, or outbound egress.
4. **Safety Filter / Refusal Protocol:**
   - If any automated safety system, filter, or policy refusal occurs, record the exact refusal message verbatim.
   - Mark the affected item as `INCOMPLETE`.
   - Never attempt to rephrase, evade, or prompt-inject around safety boundaries.
5. **Accurate Status Labels:**
   - Use only official status labels: `PASS`, `FAIL`, `INCOMPLETE`, `UNTESTED`, `STATIC-ONLY`.
   - Any assertion that cannot be verified statically or without full OS/process isolation must be marked `STATIC-ONLY` or `UNTESTED`. Never convert unverified assumptions into `PASS`.

## 3. Packet Contents
- `README.md`: This file.
- `reviewer-prompt.md`: The self-contained instruction prompt for the independent verification session.
- `kit-manifest.json`: Cryptographic manifest of all files included in this review packet.
- `targets/`:
  - `guarantee-spec.md`: Formal specification of Threat Model T and Guarantees G1 through G6.
  - `acceptance-criteria.md`: Authoritative definitions of Acceptance Assertions A01 through A30.
- `product/`:
  - `package.json`: Extension manifest and configuration definitions.
  - `README.md`: Public extension documentation.
  - `dist/extension.js`: Bundled extension runtime artifact.
  - `dist/local-ai-broker.js`: Bundled local AI broker artifact.
  - `dist/soterai-mcp-server.js`: Bundled Model Context Protocol server artifact.
  - `media/`: Extension UI and walkthrough assets.
- `assertion-results-template.csv`: Standardized spreadsheet template for reporting A01–A30 evaluations.
- `expected-results.md`: Complete expected outcomes and positive controls for assertions A01–A30.
- `evidence-format.md`: Strict schema and reporting standards for review evidence.
