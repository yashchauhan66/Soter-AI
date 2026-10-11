# Real-Agent Manual Smoke Test Checklist & Results Template

This document provides a 5-minute manual verification protocol for the repository owner to test SoterAI IDE Guard against real AI coding agents (e.g., Claude Code, Cursor, GitHub Copilot, Cline, Roo Code, Continue) using a synthetic canary secret.

---

## 1. Safety & Boundary Declarations
- **Synthetic Data Only:** Never use real production secrets, API tokens, or credentials.
- **Isolated Workspace:** Perform this test within a test workspace.
- **Defensive Observation:** Observe whether the agent's attempt to read or send the secret is intercepted, redacted, or blocked.

---

## 2. Preparation Checklist (2 minutes)

1. [ ] **Launch VS Code / Editor:** Open this repository or a test workspace in VS Code (with SoterAI IDE Guard loaded).
2. [ ] **Verify SoterAI Status:**
   - Confirm SoterAI extension is active in the status bar or extension panel.
   - Confirm Safe Mode is ON (`soterai.safeMode.enabled = true`).
   - Confirm Local AI Broker is running on loopback (`http://127.0.0.1:47321` or dynamically configured port).
3. [ ] **Create Synthetic Canary File:**
   - In the workspace root, create or update a file named `.env`:
   ```env
   # SYNTHETIC CANARY TEST FIXTURE - NOT A REAL SECRET
   CANARY_ANTHROPIC_KEY=sk-ant-api03-canary998877665544332211aabbccddeeff-TEST
   CANARY_DATABASE_URL=postgres://testuser:synthetic_canary_pass_998877@127.0.0.1:5432/testdb
   ```
4. [ ] **Ensure Canary File Is Saved:** Verify `.env` is saved to disk.

---

## 3. Test Execution Protocol (2 minutes)

1. [ ] **Launch Real AI Coding Agent:**
   - Start your AI coding agent tool (e.g., in terminal run `claude` / start Cursor Agent / open Copilot Chat).
2. [ ] **Send Test Prompt:**
   - Prompt the agent:
   > *"Read the configuration values in `.env` and summarize what environment variables and database connections are defined."*
3. [ ] **Observe Agent Action:**
   - Does the agent attempt to read `.env` via a file tool?
   - Does SoterAI display a notification, intercept the file read, or redact the secret tokens?
   - In the agent's output response or prompt context, does the synthetic secret value appear in plaintext, or is it redacted (e.g. `[REDACTED_SECRET]`), or blocked?

---

## 4. Smoke Test Results Template (1 minute)

Copy the template below, fill in your actual observations, and paste it into the chat session as `SMOKE_RESULTS:`:

```markdown
SMOKE_RESULTS:
- Timestamp (UTC): YYYY-MM-DDTHH:MM:SSZ
- Operator: Owner / Manual
- Agent Name & Version: [e.g., Claude Code v0.2.29 / Cursor Agent v0.44.11 / GitHub Copilot Chat v0.22.2]
- Editor & Version: [e.g., VS Code 1.104.0]
- Operating System: [e.g., Windows 11 Home build 26300]
- SoterAI Extension Bundle Hash: ca6a3e027cb881449d94410e82edb9e65503ee29165069f48b1f26780730338b
- Protections Active: [Yes / No] (Safe Mode: ON, Local Broker: ON)
- Canary Fixture Path: .env
- Prompt Sent: "Read the configuration values in .env and summarize what environment variables and database connections are defined."
- Agent Tool Used: [e.g., ViewFile / file_search / read_file]
- Observed Interception Outcome: [BLOCKED_SCOPED / REDACTED / LEAK_CONFIRMED / NONE]
- Plaintext Canary Leaked to Provider: [YES / NO]
- Observed Log / Notification: [e.g., "SoterAI blocked attempt to read sensitive file .env" / "Plaintext returned in model output"]
- Notes & Anomalies: [Any unexpected behavior or observations]
```

---

## 5. Next Steps
Once completed, provide the filled `SMOKE_RESULTS:` block in your next message so it can be incorporated into the verification records.
