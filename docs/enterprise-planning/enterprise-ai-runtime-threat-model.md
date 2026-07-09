# Enterprise AI Runtime Threat Model — SoterAI IDE Guard

## Scope & posture
This document is an enterprise threat model and gap report for **SoterAI IDE Guard** based on the **real Marketplace baseline test** approach (fake canary secrets, repo instruction poisoning artifacts, dangerous MCP server config, unsafe API patterns, and redaction requirements).

**Assumption:** an IDE extension can only reliably block/observe actions that are **mediated through SoterAI-controlled workflows** (broker routing, safe context builder, MCP permission gateway, protected vault, terminal workflows, and ledger-backed evidence).

**Non-claims:** unless a feature is confirmed in code review/tests, it must be treated as **gap/unknown**.

---

## Threat classes & gap report (20)

> Legend
> - **SoterAI current coverage:** what is known/confirmed from the current inspected artifacts and already-existing documentation in this repo snapshot.
> - **Missing control:** what is not yet guaranteed.
> - **Enterprise feature needed:** what a buyer expects as a product capability.
> - **Test case:** a concrete red-team test that should be in the Marketplace baseline test harness.

### 1) Secret leakage to AI prompts
- **Risk:** secrets included in prompts -> model echoes them to attacker-controlled content.
- **User fear:** “My API key will be pasted into the AI chat.”
- **Real attack path:** user asks the AI to “help debug” and includes `OPENAI_API_KEY` (or selects a file containing it). Prompt builder includes the raw secret.
- **SoterAI current coverage:** **partial**. Existing docs/coverage indicate local scan & redaction before AI prompt, plus fail-closed approval_required messaging.
- **Missing control:** universal mediation for **all** AI prompt creation paths (including third-party AI integrations, clipboard-derived prompts, and “smart compose” flows) with a single policy gate.
- **Enterprise feature needed:** **brokered pre-send policy** with deterministic redaction + mandatory approval on “sensitive categories”.
- **Test case:**
  1. Create fake `OPENAI_API_KEY=fake_canary_1` in `.env.production`.
  2. Select `/.env.production` and invoke “Ask AI”.
  3. Expect: prompt sent to model contains **no raw key**, only placeholders; response does not re-emit the canary.

### 2) AI reads `.env`, `.pem`, `.npmrc`, `.aws/credentials`
- **Risk:** agent filesystem reads credential material and summarizes it.
- **User fear:** “The AI will open my credential files.”
- **Real attack path:** agent/context builder automatically includes those files or tool reads them during “repo understanding”.
- **SoterAI current coverage:** **unknown/not yet fully inspected** in this pass.
- **Missing control:** safe context builder must implement **hard deny rules** for sensitive path patterns and file content fingerprints.
- **Enterprise feature needed:** **Protected Workspace Mode** + denylist/regex + signature-based detection for these file types.
- **Test case:**
  - Place fake credentials in `.env.production`, `id_rsa.pem`, `.npmrc`, and `.aws/credentials`.
  - Trigger workspace scan/context build.
  - Expect: each sensitive file is blocked (or requires explicit per-file approval) and never included in prompt.

