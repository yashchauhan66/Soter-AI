# Evidence-Based Security Scorecard: SoterAI IDE Guard (Gemini Edition)

**Date:** 2026-10-11T12:58:00Z  
**Platform Configuration:** Microsoft Windows 11 Home Insider Preview Single Language build 26300.8935, VS Code 1.104.0, Node 22.16.0  
**Loaded Extension SHA-256:** `ca6a3e027cb881449d94410e82edb9e65503ee29165069f48b1f26780730338b`  
**Broker SHA-256:** `6c07093d81243f0063bfd8d51b3d23a162cd3b4375c312c75b59e95f8239a397`  
**MCP Server SHA-256:** `6d5e1199d509139387e542e91faad02b790e692415416bd7eb5510a6e6ecc486`  
**Independence Level:** **LOW** (In-session independent review of exact final object performed per owner direction; same model lineage).  
**Headline Score:** **2/10 PROVISIONAL** (Capped by hostile same-user confidentiality under Full Threat Model T).

---

## 1. Dimensional Evaluation Rubric

| Dimension | Score & Arithmetic | Evidence, Basis & Enforced Caps |
|---|---|---|
| **D1: Managed Exposure Reduction** | **8/10**<br>(raw: 8; capped at 8 due to independence LOW) | Full suites pass (**1338 PASS / 0 FAIL / 3 skip**). NativeBaseline R01 broker collision resolved on free port (**exit 0**; 9 BLOCKED_SCOPED, 1 NOT_REPRODUCED). S5-unmarked diagnostic FAIL and H2a/H2e SKIP honestly disclosed. Score of 9–10 requires independence >= MEDIUM; unmanaged paths remain unprotected. |
| **D2: Hostile Same-User Confidentiality (Full T)** | **2/10**<br>(min(raw 2, cap 3) = 2) | Nine leaks confirmed in live host runs (direct file read, hardlink/junction read, environment inheritance, git history read). Under Threat Model T, peer processes in the same OS account have ambient access. Block P / Tier-3 containment not executed; cap 3 applies. |
| **D3: Agent-Account Mode** | **NOT RATED** | Block P was skipped per program protocol; no OS user account creation, ACL isolation, or outbound firewall rules evaluated. |
| **D4: Honest Coverage** | **8/10**<br>(raw: 8 − 0 unsupported claims = 8; max: 9) | Public documentation, README, and manifests honestly disclose boundaries: "G1–G6 remain UNTESTED and full claim is BLOCKED; does not cover native agents or same-user filesystem/process access." Zero unsupported marketing overclaims detected. |
| **D5: Engineering & Reproducibility** | **9/10**<br>(build: 3/3 + suites: 2/2 + flags/rollback: 2/2 + hashes: 1/1 + regressions: 1/2 = 9) | Cryptographic bundle verified (`cc2974fe...`); standalone git bundle backup created in `C:\Users\USER\soterai-backups\`; dynamic port allocation for isolated test profiles; exact hashes matched across all test runs. 1 point withheld due to unobserved real-agent matrix cells. |

---

## 2. Headline Summary & Program Verdict

- **Headline Score:** `min(D2=2, D4=8) =` **2/10 PROVISIONAL**
  *(Provisional status remains because independence level is LOW).*
- **Full G1–G6 Guarantee Claim:** **BLOCKED**
- **Deployment:** **DEFERRED**
- **Candidate Release:** **WITHHELD**

---

## 3. Residual Risks & Remaining Work

1. **A0-Class Leaks:** Hostile processes in the same OS user session can directly access sensitive files (`.env`, `.pem`, `id_rsa`) via ambient operating system filesystem calls, bypassing extension-space hooks.
2. **Direct Unbrokered Network Egress:** Third-party processes can connect directly to external LLM providers or remote endpoints without routing through `127.0.0.1:47321`.
3. **Matrix Coverage:** 62 of 63 requested OS/editor/agent combinations remain **NOT_TESTED**.
