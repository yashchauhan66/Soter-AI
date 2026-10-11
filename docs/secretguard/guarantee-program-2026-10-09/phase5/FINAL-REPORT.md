# Final Security Program Report: SoterAI IDE Guard (Gemini Edition)

**Date:** 2026-10-11T12:58:30Z  
**Branch:** `security-hardening`  
**Commit:** `5c8e8897`  
**Program Status:** **Full G1–G6 Claim BLOCKED; Deployment DEFERRED; Release WITHHELD.**  
**Headline Score:** **2/10 PROVISIONAL** (Capped by same-user ambient confidentiality limits under Threat Model T).

---

## 1. Executive Summary & Verification Findings

The Gemini execution phase (Stages G1 through G6) of the SoterAI Security Program has been completed.
All testing and verification strictly observed the program boundaries: synthetic data only, loopback network endpoints only, isolated test profiles only, zero process terminations, and zero alterations to operating system security settings.

### Summary of Completed Stages
1. **Stage G1 [FLASH] — Mechanical Closing:**
   - Updated `.gitattributes` with `docs/secretguard/**/evidence/** -text` without modifying existing evidence blobs.
   - Re-executed NativeBaseline on an isolated dynamic loopback port with broker auto-start disabled; NativeBaseline achieved **Exit Code 0** with R01 cleanly reaching `NOT_REPRODUCED` (port occupation error completely resolved).
   - Created standalone Git bundle backup at `C:\Users\USER\soterai-backups\security-hardening.bundle` (verified, SHA-256: `cc2974fe3dcda234cb9a238e514b933758859c75ee534ae313ccd768032857c9`).
   - Cryptographically re-verified loaded extension bundle (`ca6a3e02...`).
2. **Stage G2 [PRO] — Review Packet & Smoke Sheet:**
   - Assembled `phase5/independent-review-packet/` with complete verifier kit, target specifications, current dist bundles, and self-contained `reviewer-prompt.md`.
   - Proved complete exclusion of builder notes, scorecards, progress ledgers, and provisional scores (verified 0 matches across all packet files).
   - Created `phase5/REAL-AGENT-SMOKE-TEST.md` for rapid manual verification with synthetic canary secrets.
3. **Stage G3 — Independent Review Execution:**
   - Executed independent defensive artifact review directly per owner instruction (`reviewer-report.md`, SHA-256: `de4c34c8...`).
   - Declared independence strictly as **LOW** (in-session / same model lineage).
4. **Stage G4 [PRO] — Ingest, Triage & Fix Loop:**
   - Ingested review findings: 3 findings triaged as `OUT-OF-COVERAGE-BY-DESIGN` (same-user process authority, junction/alias direct access, unbrokered egress) and 1 finding triaged as `VALID AS DISCLOSED` (advisory process launch preflight).
   - Zero code modifications required; exact reviewed candidate object was preserved as the final candidate object.
5. **Stage G5 [PRO] — Block P:**
   - Explicitly skipped per protocol (token `ENABLE_BLOCK_P` was not provided).
6. **Stage G6 [PRO] — Scorecard, Reports & Claims Closure:**
   - Formalized dimensional scores, allowed claims, and public disclosures.

---

## 2. Verified Artifact Identity Table

| Artifact | File Path | SHA-256 Digest | Status |
|---|---|---|---|
| Extension Bundle | `packages/vscode-extension/dist/extension.js` | `ca6a3e027cb881449d94410e82edb9e65503ee29165069f48b1f26780730338b` | Verified & Tested |
| Local AI Broker | `packages/vscode-extension/dist/local-ai-broker.js` | `6c07093d81243f0063bfd8d51b3d23a162cd3b4375c312c75b59e95f8239a397` | Verified & Tested |
| MCP Server | `packages/vscode-extension/dist/soterai-mcp-server.js` | `6d5e1199d509139387e542e91faad02b790e692415416bd7eb5510a6e6ecc486` | Verified & Tested |
| Git Backup Bundle | `C:\Users\USER\soterai-backups\security-hardening.bundle` | `cc2974fe3dcda234cb9a238e514b933758859c75ee534ae313ccd768032857c9` | Complete History Verified |

---

## 3. Dimensional Scorecard Summary

- **D1 (Managed Exposure Reduction):** **8/10** (1338 PASS / 0 FAIL / 3 skip; NativeBaseline exit 0; S5-unmarked FAIL disclosed; capped by LOW independence).
- **D2 (Hostile Same-User Confidentiality):** **2/10** (9 confirmed leaks for unconfined same-user processes under Threat Model T; cap 3 applied).
- **D3 (Agent-Account Mode):** **NOT RATED** (Block P skipped).
- **D4 (Honest Coverage):** **8/10** (Zero unsupported marketing claims across canonical documentation).
- **D5 (Engineering & Reproducibility):** **9/10** (Clean builds, regression tests, verified backups, immutable manifests).
- **Headline Score:** `min(D2=2, D4=8) =` **2/10 PROVISIONAL**

---

## 4. Formal Allowed-Claim Statement

> **"Under Threat Model T, on configuration Windows 11 Home Insider Preview build 26300.8935 with VS Code 1.104.0 and loaded extension bundle SHA-256 `ca6a3e027cb881449d94410e82edb9e65503ee29165069f48b1f26780730338b`, 47 assertions were evaluated: 8 scoped pass / 9 observed confidentiality leaks / 0 incomplete / 30 untested; independence: LOW (same lineage in-session review); untested: [A01–A30 full OS-level architecture, 62 of 63 real-agent matrix cells, Agent-account pilot, kernel-level egress filtering]; residual risk: [9 ambient same-user leaks, S5-unmarked diagnostic failure, direct filesystem reads by peer processes, unbrokered network connections]."**

---

## 5. What Remains Unprotected & Architectural Reason

1. **Host-Level Process Boundary (A0 Direct Reads):** An unprivileged VS Code extension running in the user's desktop session cannot prevent same-user processes from issuing direct operating system read calls against files on disk (`.env`, `.pem`, `id_rsa`).
2. **Unbrokered Outbound Traffic:** SoterAI protects requests routed explicitly through its local broker (`http://127.0.0.1:47321`); independent processes that communicate directly with remote AI APIs bypass broker scanning.
3. **OS-Level Containment:** Full protection under Threat Model T requires OS-level process sandboxing, user account segregation (Agent-account mode / Block P), and kernel-level outbound firewall rules.
