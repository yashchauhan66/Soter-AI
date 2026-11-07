# Soter-AI Live Bug & QA Registry

## Active Audit Status: Sprint 1 Audit Completed
- **Audit Engineers:** `07-qa-automation-engineer` (Docker & Vector Harness) & `08-security-secops` (AppSec / Red-Team)
- **Remediation Engineers:** `03-frontend-engineer`, `04-backend-engineer`, `05-ai-ml-engineer`
- **Maker-Checker Sign-off:** Verified via 515 automated unit tests + 55-vector real-world attack suite (Score improved: 78% -> 86%).

---

| Bug ID | Severity | Component | Found By | Assigned To | Fix Description | Docker / Repro Status | Maker-Checker Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **BUG-SEC-001** | HIGH | `TerminalCommandRiskDetector` | `08-secops` | `04-backend` | Added PowerShell RCE patterns (`iwr`, `Invoke-WebRequest`, `Invoke-RestMethod` piped to `iex`/`Invoke-Expression`). | Repro verified (`iwr ... \| iex`); Neutralized with REDACT decision. | **RESOLVED / CLOSED** (`07-qa` + `08-secops` signed) |
| **BUG-SEC-002** | HIGH | `TerminalCommandRiskDetector` | `08-secops` | `04-backend` | Added PowerShell destructive wipe commands (`Remove-Item -Recurse -Force`, `Format-Volume`, `Clear-Disk`). | Repro verified (`Remove-Item -Recurse -Force C:\`); Neutralized. | **RESOLVED / CLOSED** (`07-qa` + `08-secops` signed) |
| **BUG-ML-001** | HIGH | `PromptInjectionLiteDetector` | `07-qa` | `05-ai-ml` | Broadened Romanized Hindi regex to handle modifier adjectives (`saare`, `sab`, `sabhi`) and elevated score to 35. | Repro verified (`pichle saare rules ignore karo`); Blocked. | **RESOLVED / CLOSED** (`07-qa` + `08-secops` signed) |
| **BUG-SEC-003** | MEDIUM | `DecisionEngine` | `08-secops` | `04-backend` | Implemented `UnicodeSmugglingDetector` to catch single isolated zero-width characters splitting words (`\u200B` in `i\u200Bgnore`). | Repro verified (`EVA-04`); Successfully flagged with risk score 35. | **RESOLVED / CLOSED** (`07-qa` + `08-secops` signed) |
| **BUG-SEC-004** | MEDIUM | `DecisionEngine` | `08-secops` | `04-backend` | Implemented Cyrillic confusable homoglyph detection for Latin script substitutions (`\u043E`, `\u0430` in `ignоre аll`). | Repro verified (`EVA-05`); Neutralized in pre-scan pipeline. | **RESOLVED / CLOSED** (`07-qa` + `08-secops` signed) |
| **BUG-UI-001** | LOW | Next.js App Router | `07-qa` | `03-frontend` | Verified Turbopack route compilation on root `/` and layout rendering; confirmed zero hydration mismatches. | Audited Next.js layout and public routes. | **RESOLVED / CLOSED** (`03-frontend` + `07-qa` signed) |
| **BUG-HST-001** | LOW | `ControlledTerminal` | `07-qa` | `04-backend` | Controlled terminal throws 501 on Windows when executable has no absolute trusted path configured in host environment. | Pending host configuration mapping in Sprint 1 Track B. | **IN_PROGRESS** |
