# 04 — Product Hunt + Hacker News Launch Kit (v2 — updated with live benchmark + n8n/Make/Zapier)

**Goal:** PH = 100–250 users | HN = 50–150 users | **Timing:** PH = Tue/Wed (Day 9–10), HN = Tue/Wed/Thu (Day 11–13)
**Verified numbers (benchmarks/results/latest.json, Aug 2026):** 3,200 cases (2,200 attacks / 1,000 benign) → precision 1.000, recall 1.000, F1 1.000, FPR 0.000, latency p50 9.3ms / p95 17.8ms. All 10 attack families at 100% recall (prompt injection, jailbreak, RAG poisoning, secret/PII, system-prompt leak, tool abuse, MCP risk, data exfiltration, unicode obfuscation, Hinglish multilingual).

---

# 🟠 PART A — PRODUCT HUNT LAUNCH

## Pre-launch checklist (Day 8, must be 100% done)

- [ ] Maker account ready (profile photo, bio, Twitter/X linked)
- [ ] Product page scheduled for **12:01 AM PST (12:31 PM IST)**
- [ ] **Thumbnail:** 240×240 GIF of a block-in-action (animated thumbnails get ~2x clicks)
- [ ] **Gallery (5 assets):**
  1. Hero GIF: paste Aadhaar key → instant block (3-sec loop)
  2. Screenshot: Playground detection output with decoded payload
  3. Screenshot: benchmark results table (numbers visible — 100% recall, 0% FP, 9.3ms)
  4. Screenshot: agent approval queue (payment held)
  5. Screenshot: n8n node in an editor canvas (workflow-builder audience is huge on PH)
- [ ] **Video (optional but 2x engagement):** 45-sec Loom — you speaking to camera, screen showing 3 attacks blocked + n8n node drag-in
- [ ] Topics: AI, Developer Tools, Privacy, Open Source, Security, No-Code
- [ ] Pricing: "Free"
- [ ] First comment pre-written (below)

## Launch copy (final)

**Product name:** SoterAI
**Tagline (60 chars, primary):**
> Open-source AI security layer — blocks prompt injection & data leaks

**Alt taglines (A/B in comments):**
- "The OSS guard for ChatGPT-era apps — 100% benchmark recall, 0% FP"
- "AI agents that can't leak, jailbreak, or spend without approval"
- "Prompt injection, PII leaks & rogue agents — blocked before they reach your AI"

**Description (260 chars):**
> SoterAI protects chatbots, RAG apps & AI agents from prompt injection, jailbreaks, data leaks & rogue agent actions. Public reproducible benchmark: 3,200 cases, 100% recall, 0% FP, 9.3ms p50. 79 languages incl. Hinglish. Aadhaar/PAN/GSTIN detection. Native n8n/Make/Zapier nodes. Self-host in 1 command. Free tier.

**First comment (post immediately as maker):**
> Hey Product Hunt! 👋 I'm Yash, solo founder of SoterAI.
>
> **The origin story:** I asked 10 founders "what stops someone from jailbreaking your AI chatbot?" — every single answer was a version of "the system prompt says don't." That's not security, that's a wish. So I spent months building the defense layer.
>
> **What makes us different from the 190+ funded companies in AI security:**
> 1. 🔓 Open source — detection code is readable, not a black box
> 2. 📊 A benchmark **you can run yourself** — 3,200 cases, 100% recall, 0% false positives, raw JSON committed to the repo
> 3. 🌐 Only tool detecting attacks in Hinglish + 79 languages (India = 100M weekly ChatGPT users)
> 4. 🇮🇳 Only tool detecting Aadhaar/PAN/GSTIN leaks
> 5. 🤖 Agent control: your AI can't charge a card or send an email without human approval
> 6. ⚙️ Works where your AI works: API, browser, IDE, **and native n8n / Make / Zapier nodes** (n8n node: 18 releases, installable in 2 clicks)
> 7. 📋 We publish a LIMITATIONS page — security you can't verify is marketing
>
> **Honest numbers:** ~100+ users, no funding, no logos, 1,032 passing tests + a reproducible benchmark. I'm here to earn trust in public.
>
> Free to try — playground needs no signup: soterai.in/playground
>
> I'll be here ALL day. Roast the product, question the benchmark, break the playground — brutal feedback > polite upvotes. What would make this a must-install for your team?

## Launch day timeline (IST)

| Time | Action |
|------|--------|
| 12:31 PM | Launch goes live. Post first comment immediately. |
| 12:40 PM | X/Twitter announcement + LinkedIn post (link producthunt.com/posts/soterai in comment) |
| 1:00 PM | 20 personal DMs: "We just launched on PH — would genuinely love your feedback: [link]" (NEVER say "upvote", PH bans explicit asks) |
| 2–6 PM | Reply to EVERY comment <15 min. Thoughtful replies > "Thanks!" |
| 7 PM | X: mid-day milestone ("Top 5 so far — the feedback has been 🔥") |
| 10 PM | Thank-you comment + still replying. PH day ends at 12:01 PM next day. |

## PH rules that get launches killed
- ❌ Never ask for upvotes directly (DM, WhatsApp, anywhere) — "check it out + feedback" only
- ❌ No paid upvotes/rings (detection = permanent ban)
- ❌ No fake accounts
- ✅ DO ask people to comment & review — comments are legal and weighted heavily
- ✅ Hunter: self-hunt is fine; a known hunter helps but isn't required

---

# 🟧 PART B — SHOW HN (HACKER NEWS)

**When:** Tuesday–Thursday, 9–11 AM ET = **6:30–8:30 PM IST.** HN rewards weekday-morning-US launches.
**Critical:** Use a personal account with some history. Zero-history accounts posting "Show HN" get flagged.

## Title options (≤80 chars, no clickbait, HN hates marketing-speak)

**Recommended:**
> Show HN: Open-source LLM security layer – reproducible benchmark, 3,200 cases

**Alternates:**
> Show HN: I built a prompt-injection guard and benchmarked 3,200 attacks (OSS)
> Show HN: SoterAI – prompt injection/jailbreak defense with public benchmark

## Post as TEXT post (Show HN requires link; use this flow):

**URL:** https://github.com/yashchauhan66/Soter-AI (repo > marketing site on HN. Developers trust repos.)

**First comment (post within 1 min of submitting):**
> Hi HN, maker here. Context and honest framing:
>
> **What it is:** a defense layer for LLM apps — prompt injection + jailbreak detection (10+ families), obfuscation decoding (base64/hex/morse/zero-width-unicode/homoglyphs), PII leak blocking, and an agent action-control layer (payments/emails held for human approval).
>
> **The benchmark:** 3,200 synthetic cases (2,200 attacks / 1,000 benign) → precision 1.000, recall 1.000, FPR 0.000, 9.3ms p50 / 17.8ms p95. Fully reproducible: `node scripts/phase-9-run-public-benchmark.js`, raw JSON committed. 10 attack families all at 100% recall including Hinglish multilingual and unicode obfuscation.
>
> **The caveats (I'll say them before you do):** it's a self-maintained synthetic dataset — not an independent audit and not production-traffic measured. 0% FP on synthetic controls ≠ 0% FP in the real world. The value is that the methodology is reproducible and the dataset is open, so you can extend and break it.
>
> **Architecture note:** decode-then-classify pipeline. We normalize all encodings to canonical text before classification — signature-matching raw text is nearly useless against obfuscation. Classification is staged: cheap regex/heuristics first (~5ms), ML classifier only for the residual (~10% of traffic).
>
> **Stack:** TypeScript/Next.js, npm packages for LangChain/LlamaIndex/Vercel AI SDK, browser extension (100% local), native n8n node (n8n-nodes-soterai, 18 releases) + Make/Zapier modules, Docker self-host.
>
> Rough edges: solo project, no independent security audit yet. Things I'd love broken: the multilingual classifier and the agent revert engine. Issues and PRs very welcome.
>
> Happy to answer anything — especially criticism of the benchmark methodology.

## HN engagement rules (this makes or breaks it)
1. **First 2 hours = life or death.** Reply to every top-level comment thoughtfully. HN rewards depth of discussion.
2. **Never defensive.** "That's a fair criticism — here's how I'm thinking about it" > any justification.
3. **Technical questions get technical answers** — HN can smell marketing. Cite files, line counts, exact latency numbers.
4. If someone reports a bypass: **celebrate it publicly.** "Excellent find — issue #X created, red-team case added to the benchmark." This single behavior builds more trust than any score.
5. Don't post from multiple accounts. Don't ask anyone to upvote. Both = permaban.
6. Expected outcomes: front page = 10k–30k visitors (~150+ users). Page 2–3 = 500–2k visitors (~20–50 users). Both are wins.

## Backup plans if Show HN flops (score <10 in 2 hours)
- Delete + repost is NOT allowed immediately — wait, improve the README/title based on any feedback, repost in 7+ days
- r/LocalLLaMA technical post the same week as a substitute
- "Launch HN" exists too once there's a company/pricing story — save for the paid-tier launch

---

# 📦 PART C — SECONDARY LAUNCH SURFACES (schedule across weeks 2–4)

| Surface | When | Effort | Notes |
|---------|------|--------|-------|
| **BetaList** | Day 10 | 15 min | Free submission, good for early adopters |
| **AlternativeTo** | Day 12 | 20 min | List as alternative to Lakera/Guardrails AI — their traffic finds you |
| **OpenAlternative / OSS directories** | Day 13 | 30 min | osssoftware.dev, opensourcealternative.to etc. |
| **n8n template library** | Day 19 | 1 hr | Your #1 organic channel — publish 2 official templates using your node |
| **n8n community forum** | Day 19 | 30 min | "I built a security node — 1,800+ downloads, here's what's next" |
| **LangChain/LlamaIndex awesome-lists** | Day 20–22 | 30 min each | PR to awesome lists + integrations docs |
| **dev.to "I built" + Showdev tag** | Day 4/12/17/25 | covered in file 05 | Canonical URL back to soterai.in blog |
| **HuggingFace** | Week 3–4 | 2 hrs | Upload the SoterLLM/multilingual classifier model + model card — HF model pages rank on Google |
| **Chrome Web Store + Edge Add-ons** | Day 1!! | BLOCKER B1 | listing copy in file 05's SEO map |

**Priority reminder:** Chrome Web Store submission is the single highest-ROI action in this entire kit. PH/HN are spikes; the store is a compounding faucet. n8n node installs (n8n-nodes-soterai) are your second compounding channel — every install makes the marketplace ranking stronger.