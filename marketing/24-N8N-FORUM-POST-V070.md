# 24 — n8n Community Forum Post (v0.7.0)

**Created:** 2026-09-12 | **Status:** READY TO POST
**Why this replaces `12-N8N-NODE-V062-LAUNCH.md` Phase 2:** that post was written for v0.6.2. The node is now **v0.7.0** (passports, presets, better verdicts) and npm shows 1,361 downloads/month — posting v0.6.2 copy would be stale.

**Where to post:** https://community.n8n.io/ → the forum's "Tips & Tricks"-style community-node announcements live alongside posts like "Introducing the SQLite3 Node for n8n" — model the post on that format. Category picker: **latest n8n community node posts use the `node` + `community-nodes` tags** — check the category list before posting (the forum's structure may have changed; search "Introducing" in the forum search bar to see the exact pattern used by the SQLite3 node post, which got 25 replies + 14,441 views — the exact template to follow).

---

## 📋 TITLE (copy this exactly)

```text
Introducing SoterAI — an AI security node for n8n (prompt injection, PII, secrets, agent passports)
```

## 📋 POST BODY (copy-paste, ready)

```markdown
Hey everyone 👋

I've been building AI workflows in n8n for a while, and kept running into the same uncomfortable question: **the text flowing through my AI nodes — does anything check it before it reaches the LLM, or after it leaves?**

The AI agents many of us build now (with tool access, memory, RAG retrieval) have a real risk surface. A chatbot that reads retrieved documents can follow injected instructions hidden in them. A workflow that passes customer records to an LLM can leak them straight into a prompt. And agent tool calls go out with no least-privilege control.

So I built a community node for it: **n8n-nodes-soterai** (free, MIT).

## What it does in a workflow

One node, drop it between your input and your AI app:

- **Input Guard** — inspect user prompts _before_ they reach your AI node (prompt injection, jailbreaks, exfiltration phrasing)
- **Output Guard** — inspect model output before it goes downstream (unsafe instructions, PII, secrets)
- **Redact** — clean test data in place (Aadhaar, PAN, GSTIN, UPI, IFSC, Indian mobile numbers — plus global PII)
- **RAG/Document risk** — trust scoring on retrieved documents (catch poisoned sources)
- **Tool-call / agent passports** — enroll an agent identity, issue a scoped passport (TTL + least-privilege policy), validate it, check each tool call, revoke when done
- **Workflow security audit** — one-click risk report of your AI workflow

## Three design decisions worth knowing

**1. Safe + Flagged outputs built in.** The node has two outputs. `On Threat` verdicts route the item to Flagged (Block empties the text, Redact returns the cleaned text on Safe). No extra IF node needed.

**2. A genuinely offline engine.** Cloud mode uses the full SoterAI engine (ML classifier, multi-turn correlation). But **Local mode runs the bundled detection engine inside your n8n process — zero network calls, no credential, no account.** For air-gapped hosts and data-residency rules, this is the whole feature. (~46 ms/item locally.) Auto mode falls back honestly — a degraded item is flagged `engineDegraded`, never silently passed as clean.

**3. India-grade PII.** Aadhaar, PAN, GSTIN, Voter ID/EPIC, driving licence, UPI IDs, IFSC, Indian mobile numbers — plus Hinglish rules. If your workflows touch Indian customer data, this coverage doesn't exist in any other tool I found.

## Verified on real n8n

Latest release (v0.7.0) was tested inside a real Docker n8n instance — 8/8 correct verdicts across cloud and local engines: injection → BLOCK, PII → REDACT, secrets → approval, safe text → ALLOW. Full passport lifecycle (enroll → issue → validate → tool-check → revoke) has an importable example workflow, no embedded credentials.

Honest limits: local engine is pattern+heuristic (no ML) and says so in its output — every local verdict lists what the cloud tier would have added. English/Hinglish rules; other languages only covered where the payload is machine-shaped.

**Install:** Settings → Community Nodes → `n8n-nodes-soterai` (or `npm i n8n-nodes-soterai` into `~/.n8n/nodes` on n8n 2.x)

Free tier at [soterai.in](https://soterai.in) — local mode needs no account at all.

I'd love brutal feedback — especially from anyone running AI agents in production: is the passport flow something you'd actually wire in, or overkill?
```

## 📋 FIRST COMMENT (post ke turant baad)

```markdown
Forgot to mention: there are 11 importable example workflows in the package, including the full passport lifecycle and a universal AI firewall (`soterai-universal-ai-firewall.workflow.json`). Also happy to answer setup questions here.
```

---

## 🎯 ENGAGEMENT RULES

- Har comment ka reply < 24h — n8n forum community slow-burn hai (SQLite3 node post 14K views over months)
- 3 din baad follow-up comment: template links + n8n.io/workflows submissions
- **Creator Portal submission** (`creators.n8n.io`) abhi pending hai (agar v0.7.0 submit nahi hua) — Phase 0 of file 12 wala process follow karo, sirf version references update karke

## 📊 SUCCESS METRICS (14 din)

| Metric                         | Target |
| ------------------------------ | ------ |
| Forum views                    | 2,000+ |
| Replies                        | 15+    |
| npm downloads (14d delta)      | +300   |
| Template submissions on n8n.io | 3      |
