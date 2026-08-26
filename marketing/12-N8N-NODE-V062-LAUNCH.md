# 12 — N8N NODE v0.6.2 STABLE LAUNCH KIT

**Created:** 2026-08-26 | **Trigger:** `n8n-nodes-soterai@0.6.2` npm `latest` par live (GitHub Actions provenance publish)
**Goal:** n8n channel se 100 installs / 14 din, 300+ / 30 din | **Budget:** ₹0
**Base:** `00-START-HERE-30-DAY-PLAN.md` (Day 19: "n8n = #1 organic channel, 1,361 downloads/month") + `11-ULTRA-MARKETING-BLITZ.md`

> **Yeh launch kyun different hai:** v0.6.2 pehla version hai jo REAL Docker n8n 2.27.4 par
> test hua — 8/8 correct verdicts across Cloud + Local engines (report:
> `SOTERAI-N8N-NODE-V062-REAL-DOCKER-TEST-REPORT-2026-08-26.md`). Ab hum claims nahi,
> evidence market karte hain.

## 🎯 Positioning (har post mein yahi 3 points)

1. **Offline LOCAL engine** — koi aur n8n security node air-gapped mode nahi deta. No credential, no network, ~46 ms/item.
2. **Do outputs: Safe + Flagged** — IF node ki zaroorat nahi; BLOCK/REDACT/ASK_APPROVAL verdicts khud route hote hain.
3. **India-grade PII** — Aadhaar, PAN, UPI, IFSC, Indian mobile detection (Hinglish rules included). Global tools mein yeh nahi hai.

---

## 🟠 PHASE 0 — n8n CREATOR PORTAL SUBMISSION (aaj, 30 min)

Official marketplace listing = free search traffic jab log n8n UI mein "security" search karte hain.

- [ ] Kholo: **https://creators.n8n.io** → n8n account se sign in
- [ ] **Submit a Node** → npm package: `n8n-nodes-soterai`
- [ ] Category: **Security** + **AI**
- [ ] Description (copy-paste ready):

> SoterAI adds one drop-in AI security gate to any n8n workflow. Detect prompt injection,
> jailbreaks, secrets, PII (including Aadhaar, PAN, UPI), unsafe tool calls, and RAG
> poisoning — before they reach your LLM or leave your instance.
>
> Two engines: Cloud (full ML engine with API key) and Local (bundled offline pattern
> engine — no network, no credential, air-gap friendly). Auto mode falls back honestly.
>
> Every node has two outputs — Safe and Flagged — so you can block, redact, or route to
> an approval branch without an IF node. Tested against real n8n 2.x with 8/8 correct
> verdicts across both engines. Free tier available at soterai.in.

- [ ] Screenshots (5): node panel card, Input Guard canvas with Safe/Flagged wiring, execution data showing BLOCK verdict, redaction output, Local mode notice
- [ ] Links: website `https://soterai.in/integrations/n8n`, npm `https://www.npmjs.com/package/n8n-nodes-soterai`, GitHub repo
- [ ] Submit → review 1–2 weeks; tab tak Phase 1–3 se traffic lao

---

## 🟧 PHASE 1 — n8n TEMPLATES PUBLISH (aaj, 1 hr) — SABSE BADA LEVER

n8n.io/templates search = highest-intent traffic (log install karne hi aate hain). Package mein **10 ready workflows** hain (`packages/integrations/n8n/examples/`). Pehle yeh 3 publish karo:

| Priority | Template file | Title (template gallery ke liye) |
|---|---|---|
| 1 | `soterai-guard-input-webhook.workflow.json` | "AI Security Gate: Block Prompt Injection Before Your LLM" |
| 2 | `soterai-secret-pii-redaction.workflow.json` | "Auto-Redact Secrets & PII (Aadhaar, API Keys) from AI Workflows" |
| 3 | `soterai-local-offline-engine.workflow.json` | "Offline AI Guardrails: No API, No Network, Air-Gapped Security" |

- [ ] https://n8n.io/workflows/ → **Submit workflow** (n8n account)
- [ ] Har template: import → apne instance par verify → screenshot → submit with description + node link
- [ ] Description mein `n8n-nodes-soterai` install note + soterai.in free tier mention
- [ ] Week 2 mein baaki 7 (universal AI firewall, RAG audit, output guard, error handling...)


---

## 🔴 PHASE 2 — n8n COMMUNITY FORUM POST (aaj, 20 min)

https://community.n8n.io → **Show & Tell** category. Ready-to-post:

**Title:** `I built an AI security node for n8n — now with a fully offline engine (v0.6.2)`

> Hi n8n folks 👋
>
> I've been building **SoterAI**, a community node that guards AI workflows against
> prompt injection, jailbreaks, secret/PII leakage, and RAG poisoning. Today v0.6.2
> landed as stable, and I wanted to share what's different about it:
>
> **1. A truly offline engine.** Most security nodes need a cloud API. SoterAI ships a
> bundled local engine — no credential, no network call, works on air-gapped instances
> (~46 ms/item). Every local result honestly lists what the cloud-only tier would have added.
>
> **2. Safe/Flagged outputs built in.** The node routes items itself — Block empties the
> text and sends the item to Flagged; Redact returns cleaned text on Safe. No IF node needed.
>
> **3. Tested on real n8n 2.x.** This release was verified inside a real Docker n8n
> 2.27.4: 8/8 correct verdicts across cloud and local engines (injection → BLOCK, PII →
> REDACT, secrets → approval/REDACT, safe text → ALLOW).
>
> Install: Settings → Community Nodes → `n8n-nodes-soterai` (or `npm i n8n-nodes-soterai`
> into `~/.n8n/nodes` on n8n 2.x). Free tier at soterai.in; local mode needs no account at all.
>
> Brutal feedback welcome — especially on the local engine's detection coverage.

- [ ] Post karne ke baad har comment ka reply <24 hr (trust engine)
- [ ] 3 din baad template links comment mein add karo

---

## 🟡 PHASE 3 — SOCIAL AMPLIFICATION (aaj + kal)

### X/Twitter thread (ready-to-post, 4 posts)

> **1/4** Our n8n AI security node just hit stable v0.6.2 🛡️
> One node that blocks prompt injection, jailbreaks, and leaks before they reach your LLM.
> Now with something no other n8n security node has: a fully OFFLINE engine. 🧵
>
> **2/4** Tested inside a real Docker n8n 2.27.4 — 8/8 correct verdicts:
> • "Ignore all previous instructions…" → BLOCK (risk 100)
> • email + phone in text → auto-REDACT
> • sk_live_… secret → held for approval
> • normal question → ALLOW
>
> **3/4** Air-gapped n8n? Local mode runs the bundled detection engine with zero network
> calls and no account — ~46 ms per item. Cloud engine adds the ML classifier when you want it.
>
> **4/4** Two outputs: Safe + Flagged. Wire your chatbot through it and stop wiring IF nodes.
> Free tier: soterai.in · Install: Community Nodes → n8n-nodes-soterai
> [screenshot: Safe/Flagged canvas + BLOCK execution data]

### LinkedIn post (ready-to-post)

> Most AI security tools assume you can send every prompt to their cloud.
>
> What if your n8n instance can't? (Banks, healthcare, govt, air-gapped dev boxes.)
>
> Today our n8n community node — SoterAI — hit stable v0.6.2 with a fully offline
> detection engine: prompt injection, jailbreaks, secrets, and PII (including Aadhaar,
> PAN, UPI) caught inside your instance, no network call, no account.
>
> We verified this release inside a real Docker n8n 2.27.4: 8/8 correct verdicts across
> both engines. Honest by design — every offline result lists exactly what the cloud
> tier would have added.
>
> If you run AI workflows in n8n, I'd love brutal feedback: Settings → Community Nodes
> → n8n-nodes-soterai. Free tier at soterai.in.

### Reddit r/n8n (value-first, rules check karo — self-promo sirf Show & Tell flair)

**Title:** `I built a community node that guards AI workflows — now with an offline engine (v0.6.2 stable)`
Body = forum post wala content (upar). First comment mein 2 template links.

### Reddit r/AutomateYourself + r/nocode (kal)

Shorter angle: "Added security to my AI chatbot workflow with one node — blocks prompt
injection and redacts PII automatically. Free."

---

## 🟢 PHASE 4 — 14-DIN COMPOUNDING

| Day | Action |
|---|---|
| D+2 | Templates #1–3 gallery mein live? Share links on X + forum comment |
| D+3 | YouTube Short #1: 25-sec "prompt injection vs SoterAI node" screen-rec (canvas + BLOCK) |
| D+5 | Dev.to article: "Securing n8n AI workflows: prompt injection, PII, and the air-gap problem" (canonical → soterai.in/integrations/n8n) |
| D+7 | Metrics fill (neeche). Best channel ×2. Baaki 7 templates mein se 2 aur publish |
| D+10 | n8n newsletter/community digest pitch (templates ke saath) |
| D+14 | Creator Portal review status check; user feedback → GitHub issues (public replies = trust) |

---

## 📊 KPIs (is file mein fill karo)

| Metric | D0 (2026-08-26) | D+7 | D+14 | D+30 |
|---|---|---|---|---|
| npm downloads `n8n-nodes-soterai`/week | baseline: `npm view` se | | | |
| n8n template installs (3 templates) | 0 | | | |
| Forum post views / replies | 0 | | | |
| Creator Portal status | submitted? | | | approved? |
| Signups via soterai.in/integrations/n8n | — | | | |

**Red flags:** npm downloads <50/week after templates live → template titles weak, rewrite.
Forum <10 replies in 3 din → title rewrite + 5 n8n power-users ko personal DM (feedback language).

---

## ✅ AAJ KI CHECKLIST (2.5 hrs total)

- [ ] Phase 0: Creator Portal submit (30 min)
- [ ] Phase 1: 3 templates publish (1 hr)
- [ ] Phase 2: Forum post (20 min)
- [ ] Phase 3: X thread + LinkedIn (20 min)
- [ ] Is file mein D0 baseline numbers fill karo
