# 18 — Awesome Lists & Open-Source PR Kit

**Why this is the highest-ROI channel you are not using.** An awesome-list entry is a permanent, high-authority backlink on a repo with tens of thousands of stars, placed in front of exactly the audience that installs things. One merged PR outperforms a month of social posting, and it keeps working forever.

**Effort:** 20–30 minutes per PR. **Merge rate:** high if you follow the rules below, near zero if you do not.

---

## The four rules that decide whether you get merged

1. **Read `CONTRIBUTING.md` first.** Most awesome lists have a strict one-line format, alphabetical ordering, and a rule against marketing language. Violating any of them gets an instant close.
2. **One PR, one entry.** Never add yourself to three sections in one PR.
3. **Describe the capability, not the company.** `Blocks prompt injection at input, output, and tool-call layers; self-hostable.` merges. `The world's best AI security platform!` does not.
4. **Contribute before you ask.** Fix a dead link or a stale description in the same list a week earlier, with a separate PR. Maintainers remember names.

---

## Target list, ranked by expected return

| Priority | List | Section to target | Notes |
|---|---|---|---|
| 1 | `awesome-llm-security` | Guardrails / Defense tooling | Most on-topic list that exists. Do this one first |
| 2 | `awesome-mcp-servers` | Security / Gateways | `@soterai/mcp-gateway` is published. Fastest-moving ecosystem right now |
| 3 | `awesome-ai-security` | Runtime protection | Directly relevant |
| 4 | OWASP LLM Top 10 tooling landscape | Detection & response | Highest credibility of any listing available to you |
| 5 | `awesome-langchain` | Guardrails / Safety | `@soterai/langchain-middleware` published |
| 6 | `awesome-llamaindex` | Integrations | `@soterai/llamaindex-middleware` published |
| 7 | `awesome-prompt-injection` | Defenses | Small list, highly targeted audience |
| 8 | `awesome-n8n` / n8n community node index | Nodes | You already have organic traction here |
| 9 | `awesome-selfhosted` | Security | Strict rules; requires a real self-host guide — you have `DEPLOY-GUIDE.md` |
| 10 | `awesome-devsecops` | AppSec tooling | Adjacent buyer, slower merge |
| 11 | `awesome-python` / `awesome-nodejs` | Security | Huge lists, low merge probability. Attempt last |

---

## Ready-to-paste entries

Match the surrounding formatting in the target file — these are the descriptions, not the final markup.

**For AI/LLM security lists:**
```markdown
- [SoterAI](https://github.com/yashchauhan66/Soter-AI) - Runtime AI security layer that inspects prompts, model outputs, retrieved RAG context, and agent tool calls from one policy engine. Detection runs locally on CPU with no network call. Self-hostable. Includes India-specific PII detection (Aadhaar-like, PAN, GSTIN, UPI, IFSC).
```

**For MCP lists:**
```markdown
- [SoterAI MCP Gateway](https://www.npmjs.com/package/@soterai/mcp-gateway) - Security gateway for MCP tool calls: classifies each call as reversible, compensating, or irreversible, and holds risky calls for human approval with a rollback window.
```

**For LangChain / LlamaIndex lists:**
```markdown
- [SoterAI](https://www.npmjs.com/package/@soterai/langchain-middleware) - Middleware that guards chain inputs and outputs against prompt injection, secret leakage, and PII exposure, with local CPU detection and no extra LLM round-trip.
```

**For self-hosted lists** (these lists require a licence and a stack tag):
```markdown
- SoterAI - AI security control layer for LLM apps, RAG pipelines, and autonomous agents. Blocks prompt injection, redacts secrets and PII, and gates agent tool calls behind human approval. `BUSL-1.1` `Docker/Node.js`
```

**For prompt-injection-specific lists:**
```markdown
- [SoterAI](https://soterai.in/playground) - Rules-first prompt injection and jailbreak detection with a public playground and a reproducible benchmark. Published results include the blind held-out score (61.54% on 26 novel cases) alongside the tuned aggregate (98.40% on 1,122), so the generalization gap is visible rather than hidden.
```

> That last entry is deliberately the most self-critical of the five. In a defenses list read by researchers, publishing the gap is what makes it credible — and it is the entry most likely to get quoted elsewhere.

---

## PR description template

```markdown
### What this adds

One entry for SoterAI under **<section name>**.

### Why it belongs in this list

<one sentence tying it to the list's stated scope>

- Source: https://github.com/yashchauhan66/Soter-AI
- Live playground (no signup): https://soterai.in/playground
- Reproducible benchmark + published limitations: https://soterai.in/benchmark

### Checklist

- [x] Read CONTRIBUTING.md
- [x] Entry placed in the correct section, alphabetical order preserved
- [x] Single entry, single PR
- [x] Description states capability, no marketing language
- [x] All links verified working

### Disclosure

I maintain this project.
```

**Always include the disclosure line.** Maintainers find out anyway, and undisclosed self-promotion gets you banned from the list permanently.

---

## Beyond awesome lists — contributions that earn the right to be listed

These take longer but compound harder, because they make you a participant rather than a submitter.

| Contribution | Where | Why it pays |
|---|---|---|
| Publish the red-team corpus as a standalone dataset repo | Your own GitHub, MIT or CC-BY | Researchers cite datasets. Citations are the strongest discovery signal available |
| PR a SoterAI guard example into LangChain / LlamaIndex docs | Their repos | Puts you in the framework's own documentation |
| Write a detector for a reported bypass, credit the reporter in `CHANGELOG.md` | Your repo | Reporters tell people. This is how security tools actually get known |
| Answer prompt-injection questions in adjacent repos' Discussions | Their repos | No link, no pitch. Reputation only. The long game |
| Submit a talk to a local OWASP or Null chapter | India first | In-person credibility converts far above its impression count |

---

## Tracking

| List | PR opened | Status | Merged date | Referral sessions | Activated users |
|---|---|---|---|---|---|
| awesome-llm-security | | | | | |
| awesome-mcp-servers | | | | | |
| awesome-ai-security | | | | | |
| OWASP LLM tooling | | | | | |
| awesome-langchain | | | | | |

One PR per week. Eleven weeks and you are in every list that matters, permanently.
