# SoterAI — 0 → 1,000,000 Users: Deep Product Analysis + World-Best Market Capture Strategy

**Date:** 2026-08-03 · **Author:** strategy pass on verified live data (npm registry API, VS Code Marketplace, GitHub API, soterai.in, Chrome Web Store search, market research)
**Method:** Every number in Part 1 was fetched live today, not read from internal docs.

---

## TL;DR (Hinglish)

Aapka **product problem nahi hai — distribution problem hai.** 7 hafte mein 299 commits, 1030 tests, 221 pages, 11 npm packages, 7 surfaces ban gaye — lekin **total verified users = 3 VS Code installs + 1 GitHub star + ~1,361 npm downloads/month.**

Teen cheezein aaj aapko rok rahi hain, aur teeno technical nahi hain:
1. **Chrome extension kabhi submit hi nahi hua** (`STORE_ACCOUNT_BLOCKED` — $5 developer account pending). Yeh aapka SIRF ek surface hai jahan 1M users possible hai.
2. **PyPI par package hai magar mara hua hai.** `soter` v0.2.1 (21 Jun 2026) live hai — sirf **50 downloads/month**, aur uska Homepage `soter.dev` + Source `github.com/soter/guard` **dono dead links** hain, license bhi galat (MIT likha hai, actual Apache-2.0). AI development ka 80% Python mein hota hai aur aapka Python front-door toota pada hai.
3. **Payments INR-only hain** (`razorpay.ts:144` currency mismatch → reject). Duniya ka 95% aapko pay nahi kar sakta.

Aur ek sabse bada **unexploited advantage** aapke paas already hai: **India mein 100M weekly ChatGPT users hain** (2026 mein US ke baad sabse bada market), aur aap duniya ke **ekmatr vendor** ho jiske paas Hinglish detection + Aadhaar/PAN/GSTIN PII detection + DPDP Act audit trail hai. 191 funded competitors US/EU enterprise mein lad rahe hain. **India ke 100M AI users ke liye koi nahi lad raha.** Wahi aapka 1M wedge hai.

**Honest timeline:** 1M users = 18–24 months. 10,000 users = 90 days (yeh realistic hai aur yahi compound hota hai). Koi bhi jo aapko "1M in 3 months" bole, wo jhooth bol raha hai.

---

## PART 1 — WHERE YOU ACTUALLY STAND TODAY (live-verified, 2026-08-03)

### 1.1 Every distribution surface, with real numbers

| Surface | Status | Verified traction | Source |
|---|---|---|---|
| soterai.in website | **LIVE**, 221 static pages, indexed #1 for brand | No social proof, no logos, no user count | fetched today |
| `n8n-nodes-soterai` | **LIVE** npm v0.3.3 (2026-07-31) | **1,361 downloads / 30 days** ← your only real demand signal | npm downloads API |
| VS Code Marketplace | **LIVE** v0.2.2 | **3 installs**, 1 review (5★) | marketplace page |
| GitHub `yashchauhan66/Soter-AI` | **PUBLIC** | **1 star**, 0 forks, license = **NOASSERTION** | GitHub API |
| `@soterai/core` | LIVE npm v0.2.0 (2026-06-21, stale) | ~0 downloads | npm search API |
| `@soterai/langchain-middleware` | LIVE npm v0.2.0 | ~0 | npm |
| `@soterai/llamaindex-middleware` | LIVE npm v0.2.0 | ~0 | npm |
| `@soterai/vercel-ai-sdk-middleware` | LIVE npm v0.2.0 | ~0 | npm |
| `@soterai/mcp-gateway` | LIVE npm v0.2.0 (2026-08-01) | 0 | npm |
| `soter-pii` | LIVE npm v1.1.0 (2026-08-01) | 0 | npm |
| `@soterai/cli` / `ide-common` / `ide-protocol` | LIVE npm v0.1.0 | 0 | npm |
| **Chrome Web Store** | ❌ **NEVER SUBMITTED** | 0 | `docs/extension-store/final-public-upload-instructions.md` = `STORE_ACCOUNT_BLOCKED` |
| **Microsoft Edge Add-ons** | ❌ **NEVER SUBMITTED** | 0 | same doc |
| **PyPI (`soter`)** | ⚠️ **PUBLISHED but stale + broken metadata** | **50 dl / 30d** | pypi.org/pypi/soter → v0.2.1, uploaded 2026-06-21, owner `yashchauhan`; live Homepage `soter.dev` + Source `github.com/soter/guard` both 404; license shown as MIT vs actual Apache-2.0 |
| **PyPI (`soter-pii`)** | ❌ **DOES NOT EXIST** | 0 | pypi.org 404 |
| Open VSX / Cursor | Packaging scripts exist, not verified live | 0 | — |

**Total verified human users across all 7 surfaces: under 100.** Total product built: 299 commits, 1,030 passing tests, 11 published packages, 221 pages, ~40 internal analysis reports.

### 1.2 The product side (from `DEEP-ANALYSIS-…-2026-08-02.md`, re-verified)

Genuinely strong and not in question:
- `npm test` → 1,030 pass / 0 fail; `tsc --noEmit` → 0 errors; `next build` → 221/221 pages
- Attack recall 100% (150-case), benign FP 0.00% (300 controls), 79-language coverage
- Harmful-content classifier gap (R1) closed 2026-08-03
- Composite tech rank **#2 of 8** tracked vendors (75/100), #1 on transparency/self-host/value

### 1.3 The three self-inflicted blockers

| # | Blocker | Evidence | Cost to fix | What it unlocks |
|---|---|---|---|---|
| B1 | Chrome + Edge extension never submitted | `STORE_ACCOUNT_BLOCKED` doc | **$5 + 2 hours** | The only surface where 1M users is physically possible |
| B2 | Python front-door broken: `soter` on PyPI is 6 weeks stale with dead Homepage/Source links + wrong license, and `soter-pii` doesn't exist | pypi.org/pypi/soter/json → v0.2.1 (2026-06-21), Homepage `soter.dev`, Source `github.com/soter/guard` **404**; pypi.org/pypi/soter-pii → 404 | **1 day** | ~80% of AI developers (LangChain/LlamaIndex/CrewAI/AutoGen are Python-first) — and a security package whose own source link 404s is worse than no package |
| B3 | INR-only payments | `lib/billing/razorpay.ts:144` rejects non-INR | **2–3 days** (Stripe/Paddle/Lemon Squeezy) | Global revenue; today 95% of the world cannot pay you |

Three secondary blockers:
- B4: `LICENSE` = NOASSERTION on the main repo → legally nobody can use or contribute → open-source growth is dead on arrival.
- B5: 4 packages are `private: true` locally (`langchain`, `llamaindex`, `vercel-ai-sdk`, `detectors`, `policy-engine`) → future versions cannot ship to the ecosystems that matter most.
- B6: Free tier requires signup + email. Every signup field costs ~20% of top-of-funnel.

---

## PART 2 — THE DIAGNOSIS

**You are product-rich and distribution-poor by an extreme margin.**

Ratio check: 299 commits ÷ ~100 users = **3 commits per user.** A healthy pre-PMF dev-tool company runs the opposite ratio.

The marginal return on your next feature is approximately **zero.** The marginal return on your next distribution action is enormous — because the base is zero, everything is a multiple.

**Second diagnosis: positioning/audience mismatch.**
Your homepage says *"Soter Enterprise AI Control Plane"*, shows 6 products at 4 maturity levels (stable/beta/labs), 5 INR pricing tiers where all four visible tiers list **the same three bullets**, and targets "Indian businesses". A 0-user product selling an "Enterprise Control Plane" with no logos and no SOC2 is a credibility mismatch that no amount of engineering fixes. Enterprise buyers need trust you cannot yet manufacture; individuals and developers need only a tool that works — and you have that.

**Third diagnosis: you are ignoring your own strongest signal.**
`n8n-nodes-soterai` gets **1,361 downloads/month with zero marketing spend, zero launch, zero content.** That is organic pull. It is the only place the market has voted for you. You have never systematically fed it (no n8n templates published, no n8n community presence, no n8n-specific landing page campaign).

---

## PART 3 — MARKET REALITY (verified 2026-08-03)

### 3.1 The category you are in is brutally crowded

Per Prompt Security's AI Security Startups Map (July 26, 2026): **371 companies** building agentic-AI security across 14 categories, **~$9.9B disclosed funding**. Your exact category — *"Runtime & Guardrails: inline content inspection and behavioral enforcement at the moment of inference"* — has **191 vendors**. Lakera was acquired by Check Point for ~$300M. Palo Alto (Prisma AIRS) and Cisco (AI Defense) are shipping.

**Strategic conclusion:** You cannot win by being vendor #192 selling runtime guardrails to US/EU enterprise security teams. That game is won with funding, SOC2, logos, and field sales — all of which you have zero of. Competing there means losing slowly.

### 3.2 But all 191 are fighting in the same corner, and they've left two doors open

| Whitespace | Why it's open | Why you already own it |
|---|---|---|
| **A. India's 100M weekly ChatGPT users** | Every funded vendor sells enterprise B2B in USD to US/EU security teams. None ships Hindi/Hinglish detection. None detects Aadhaar/PAN/GSTIN/UPI/IFSC. | You have 79-language + verified Hinglish detection and India-native PII detectors **already built and tested**. |
| **B. The individual developer / prosumer** | 191 vendors have "Contact Sales" pricing. Lakera & HiddenLayer publish no self-serve price. Zero of them ship a free, local-first, no-signup tool. | You have a free tier, a public playground, 11 npm packages, a local broker with zero telemetry, and self-host. |

Ground truth on A: Sam Altman, Feb 2026 — **India = 100M weekly active ChatGPT users**, largest market outside the US, ~330M monthly (May 2026), largest student user base globally, fastest-growing Codex market, and **18–24-year-olds send half of all messages.** Delhi-NCR leads; top-10 cities = 50% of users.

### 3.3 And there is a dated regulatory forcing function in your home market

India's **DPDP Act**: Rules notified 13 Nov 2025. Full compliance deadline **13 May 2027**, penalties up to **₹250 crore**. Consent-manager registration phase from **13 Nov 2026**, and MeitY has proposed cutting the timeline from 18 to 12 months (pulling full compliance to **13 Nov 2026**).

This gives you what no marketing budget can buy: **a deadline.** Every Indian company that lets employees paste customer data into ChatGPT has a DPDP problem in 9–21 months, and your product is the only one that detects Aadhaar/PAN/GSTIN leaving the browser and writes a hash-chained audit ledger proving it was blocked.

### 3.4 Direct competitors in the consumer browser niche (search-verified)

The Chrome Web Store already has: *AI Shield* ("detects hidden manipulation, prompt injection, scams — all locally"), *ScanAix* ("warns before you submit PII"), *AI Prompt Injection Detector*. They are small, single-purpose, and **none of them handle Hinglish, Aadhaar, PAN, GSTIN, or DPDP.** Their existence proves the niche converts; your engine is objectively deeper.

---

## PART 4 — THE STRATEGY: "WIN INDIA'S 100M, FUND IT WITH DPDP, THEN GO GLOBAL ON DEVELOPER TRUST"

Three engines, run in this order. They are not three businesses — engine 1 creates the users, engine 2 creates the cash, engine 3 creates the global brand.

### ENGINE 1 — MASS USERS: the India-first consumer AI privacy guard (the 1M engine)

**Product:** the browser extension, stripped down and renamed for humans, not enterprises.
**Job to be done:** *"Main galti se apna password / API key / client data ChatGPT mein paste na kar doon."*
**Audience:** India's 100M weekly ChatGPT users — specifically the 18–24 student/junior-dev cohort that sends half of all messages, plus freelancers, agencies, CA/legal/HR staff pasting client data.
**Why it can reach 1M:** free, zero-signup, works in 10 seconds, one obvious benefit, shareable, and lives inside two stores that have their own search traffic.
**Language:** Hindi + Hinglish UI and detection — a feature literally zero of 191 competitors ship.

Non-negotiable design rules for this surface:
1. **No signup. Ever.** Install → protection active → first blocked-leak demo within 10 seconds.
2. **100% local.** No prompt text leaves the device. This is both a privacy claim and a cost strategy (1M users costs you almost nothing to serve).
3. **One number on the popup:** "X leaks blocked this week." That number is the retention hook and the share hook.
4. **Rename it.** "Soter Enterprise AI Control Plane" is wrong for this audience — see Part 9 for exact copy.

### ENGINE 2 — CASH NOW: the DPDP AI-Compliance pack for Indian businesses (the revenue engine)

**Product:** existing dashboard + audit ledger + India PII detectors + policy engine, packaged and sold as **"DPDP-ready AI usage compliance."**
**Trigger:** the 13 May 2027 deadline (possibly 13 Nov 2026), ₹250 crore penalties.
**Audience:** Indian AI agencies, IT services firms, BPO/KPO, fintech, healthtech, CA/law firms, edtech — 50–500 employees, all of whom already have employees pasting customer data into ChatGPT.
**Offer ladder:** free **"AI Data Leak Audit"** (you run their org through the browser guard for 14 days and hand them a report of what left the building) → paid monitoring + audit trail → enterprise self-host.
**Why this converts when global enterprise doesn't:** the buyer is Indian, the deadline is Indian, the PII is Indian, the price is in ₹, and you are local. Palo Alto and Check Point are not calling a 120-person Pune agency.

### ENGINE 3 — GLOBAL BRAND: developer packages + the honesty moat (the credibility engine)

**Product:** `soter-pii` (zero-dependency PII/secret redactor) as the hero, plus PyPI + the framework middlewares, plus a genuinely open-source detector core.
**Why `soter-pii` is the right hero:** single-purpose, zero-dependency utility packages are the only category of software that routinely crosses 1M weekly downloads. It has no competitor lock-in, needs no account, and is trivially adoptable in one line.
**The weapon nobody can copy:** your **published known-bypass registry** (`honest:true`, 2 explicit `UNSUPPORTED` capabilities). You are the only vendor in the category that publishes what it *cannot* catch. That is an unforgeable trust signal and the single best Hacker News / press headline available to you: *"We're the only AI security vendor that publishes its own bypasses."* Competitors cannot match it without admitting their own.

---

## PART 5 — THE 1M FUNNEL MATH (so you can tell if you're on track)

### 5.1 Define "user" before chasing the number

`Users = browser-extension installs + IDE-family installs + registered API accounts + monthly package downloads (npm + PyPI + n8n)`

State this definition publicly and never inflate it. Your honesty moat dies the day you claim a number you can't source.

### 5.2 The ladder

| Channel | M3 | M6 | M12 | M18 | M24 |
|---|---|---|---|---|---|
| Chrome + Edge installs | 500 | 5,000 | 60,000 | 200,000 | 450,000 |
| VS Code family installs (incl. Cursor/OpenVSX) | 300 | 3,000 | 25,000 | 70,000 | 150,000 |
| npm monthly downloads | 5,000 | 20,000 | 80,000 | 180,000 | 300,000 |
| PyPI monthly downloads | 1,000 | 8,000 | 40,000 | 90,000 | 150,000 |
| n8n node monthly downloads | 3,000 | 8,000 | 20,000 | 35,000 | 50,000 |
| Registered API accounts | 200 | 1,200 | 6,000 | 18,000 | 40,000 |
| **TOTAL** | **~10k** | **~45k** | **~231k** | **~593k** | **~1.14M** |

Each channel needs roughly **3–5× growth per 6 months.** For a free, local-first, single-purpose tool with consistent shipping, that is demanding but normal. It is *not* achievable if the Chrome extension stays unsubmitted or PyPI stays at 50 downloads/month with dead links — those two rows are 60% of the total.

### 5.3 Revenue that falls out of that base

| Milestone | Accounts | Paid conv. | Paid | Avg ₹/mo | MRR | Enterprise/DPDP | Total ARR |
|---|---|---|---|---|---|---|---|
| M6 | 1,200 | 1.5% | 18 | 1,400 | ₹25K | 3 × ₹25K = ₹75K | **~₹12L** |
| M12 | 6,000 | 2.0% | 120 | 1,500 | ₹1.8L | 10 × ₹40K = ₹4L | **~₹70L** |
| M24 | 40,000 | 2.5% | 1,000 | 1,800 | ₹18L | 25 × ₹1.5L = ₹37.5L | **~₹6.7 Cr (~$800K)** |

The DPDP column is the part that pays your bills in year 1. The user column is the part that makes you acquirable in year 3.

### 5.4 The honest timeline

| Target | Realistic date | Confidence |
|---|---|---|
| First 1,000 users | Day 30–45 | High |
| 10,000 users | Day 90 | Medium-high |
| First ₹1L MRR | Month 6–8 | Medium |
| 100,000 users | Month 10–13 | Medium |
| **1,000,000 users** | **Month 18–24** | **Medium, execution-dependent** |

**"Bahut jald 1M" is not available.** Security tools do not go viral like consumer apps — trust accumulates linearly. What *is* available is 10k in 90 days, and 10k compounding at 4× per 6 months lands you at 1M in under two years.

---

## PART 6 — 90-DAY EXECUTION PLAN (week by week)

Rule for the entire 90 days: **70% of your time on distribution, 30% on product.** You have inverted this for 7 weeks. Invert it back.

### WEEK 1 — Unblock distribution (the highest-ROI week of your year)

| # | Action | Owner | Done when |
|---|---|---|---|
| 1.1 | Pay $5, create Chrome Web Store developer account | you | account active |
| 1.2 | Create Microsoft Partner Center account (free) | you | account active |
| 1.3 | Submit extension to **Chrome, visibility = PUBLIC** using `docs/extension-store/chrome-web-store-listing.md` + `permission-justification.md` + `reviewer-notes.md` | you | "In review" |
| 1.4 | Submit to **Edge Add-ons, PUBLIC** | you | "In certification" |
| 1.5 | Add `LICENSE` (Apache-2.0) to the GitHub repo root; fix NOASSERTION | you | GitHub shows Apache-2.0 |
| 1.6a | Republish **`soter` 0.2.2** to PyPI — fixes dead `soter.dev` / `github.com/soter/guard` links + MIT→Apache-2.0 (built & `twine check` PASSED, awaiting upload token) | you | pypi.org/project/soter shows soterai.in + a live Source link |
| 1.6b | Publish `soter-pii` to **PyPI** as `soter-pii` (Python port of the redactor) | you | `pip install soter-pii` works |
| 1.7 | Wire **Stripe or Paddle or Lemon Squeezy** for USD alongside Razorpay/INR | you | a test USD card charges |
| 1.8 | Free tier = **instant anonymous API key**, no email required (rate-limited) | you | key issued in 1 click |
| 1.9 | Set up **PostHog or Plausible** + one weekly metrics sheet (8 numbers only, Part 11) | you | first row filled |

> Week 1 is ~$5 + ~30 hours and it is worth more than the last 4 weeks of engineering combined. Do not skip 1.3.

### WEEK 2 — Make the wedge product consumer-grade

- Rename the extension listing (exact copy in Part 9). Remove every instance of "Enterprise", "Control Plane", "SIEM", "policy engine" from the consumer-facing surface — move those to a separate enterprise listing later.
- 10-second first-run: install → a demo prompt is auto-scanned → user sees one leak get blocked. No tour, no login, no settings.
- **Hindi + Hinglish UI toggle** (auto-detect `navigator.language` = `hi`).
- Popup shows exactly one hero number: **"X leaks blocked."**
- Add the share loop: after a block, a one-tap **"Share this catch"** card (redacted, e.g. *"Soter ne mera AWS key ChatGPT mein jaane se roka 🛡️"*) for WhatsApp / X / LinkedIn. WhatsApp sharing is the single highest-leverage viral channel in India — make it the first button.
- The full SDK is already on PyPI as **`soter`** (`pip install soter`) — don't publish a second `soterai` name, that splits the download count and the SEO. Point every doc, README and landing page at the one canonical name.

### WEEK 3 — Build the proof assets (these get reused for 12 months)

- **Flagship post:** *"I ran 2,200 prompt-injection attacks against my own AI firewall — and published everything it still can't catch."* Uses your benchmark kit + known-bypass registry. This is your Hacker News and press asset.
- Ship the **public known-bypass page** at `soterai.in/limitations` (page already exists — make it the marketing centerpiece, not a disclaimer).
- **3 demo videos, 15–45s, vertical:** (a) AWS key blocked in ChatGPT, (b) Aadhaar number blocked, (c) prompt injection in a pasted webpage blocked. Vertical format = Instagram Reels / YouTube Shorts / LinkedIn.
- **1 DPDP explainer:** *"DPDP Act ke baad aapke employees ka ChatGPT use illegal ho sakta hai — 13 May 2027 se."* This is your B2B lead magnet.

### WEEK 4 — Launch #1: stores + technical communities

- Extension goes live → immediately optimise the store listing for **store search** (it is a search engine): title = `Soter — AI Data Leak Protection for ChatGPT, Claude & Gemini`, first 132 chars of description carry the keywords, 5 screenshots with text overlays, promo tile.
- **Show HN**: *"Show HN: I built an AI security guard and published the list of attacks it fails."* Post Tue–Thu, 8–10am ET. Answer every comment for 6 hours. Do **not** market — HN rewards the honesty registry and punishes hype.
- **Reddit, value-first (never a bare link):** r/developersIndia, r/india, r/ChatGPT, r/LocalLLaMA, r/n8n, r/cybersecurity, r/SideProject. Format: share the *finding* ("Here's what 2,200 attacks taught me about prompt injection"), link in a comment.
- **`awesome-*` PRs:** awesome-llm-security, awesome-ai-security, awesome-prompt-injection, awesome-n8n, awesome-mcp-servers. 10 PRs = permanent backlinks + steady trickle.
- Submit to **MCP server registries** (`@soterai/mcp-gateway` is already published — 2026's newest under-crowded distribution surface).

### WEEK 5–6 — Launch #2: Product Hunt + developer ecosystem

- **Product Hunt**, Tuesday, 12:01am PT. Pre-warm 25 supporters privately (never ask for "upvotes" publicly — it's against the rules). Title: *"Soter — Stop pasting secrets into ChatGPT. Free, local, no signup."* Have the founder answer every comment all day.
- **n8n ecosystem push (highest confidence channel — you already have pull):**
  - Publish **5 n8n workflow templates** to the n8n template library using your node (each template is its own SEO page and its own discovery surface).
  - Post in the n8n community forum: a genuine "how I secure AI workflows" write-up.
  - Ship a dedicated `soterai.in/n8n` landing page.
  - Target: 1,361 → **4,000+ monthly downloads by day 90.**
- **Dev content syndication:** dev.to + Hashnode + Medium + LinkedIn article, same flagship post, canonical link back to your blog.
- **LinkedIn founder series:** 1 post/day for 30 days. You are Indian, building AI security, in a country with 100M ChatGPT users and a DPDP deadline — that is the highest-signal founder narrative available in the Indian tech feed right now. Posts = build-in-public numbers, attack demos, DPDP explainers.

### WEEK 7–9 — The compounding engine: SEO + free tools

You already have 221 pages and a full SEO doc set. The gap is **high-intent pages + free tools + backlinks**, not more pages.

- **20 high-intent comparison pages** (low competition, buyer-stage traffic): `lakera-alternative`, `self-hosted-lakera-alternative`, `prompt-security-alternative`, `hiddenlayer-alternative`, `bedrock-guardrails-alternative`, `azure-content-safety-alternative`, `llm-guard-alternative`, plus `X-vs-soterai` for each.
- **4 free no-signup tools** (link magnets that rank forever):
  1. `/tools/prompt-injection-test` — paste a prompt, see the verdict (your playground, renamed for search intent)
  2. `/tools/pii-redactor` — paste text, get redacted output, all client-side
  3. `/tools/aadhaar-pan-detector` — India-specific, zero competition
  4. `/tools/mcp-server-scanner` — scan an MCP config for risky tools
- **Programmatic SEO, 50 pages:** *"Is it safe to paste ____ into ChatGPT?"* (AWS keys, source code, customer list, Aadhaar, medical records, contracts, salary data, API keys, .env, resume, bank statement…). Each page: honest answer + the tool + install CTA. This exact query pattern has real volume and near-zero competition.
- **OWASP LLM Top 10 hub** — you already have the coverage matrix; turn it into the canonical developer reference for LLM01–LLM10. This is the #1 backlink magnet in your category.
- Execute 30 targeted backlinks from `docs/seo/backlink-opportunity-map.csv`.

### WEEK 10–12 — Turn on revenue: the DPDP play

- Launch `soterai.in/dpdp` — *"DPDP Act 2027 ke liye AI compliance"* — with a countdown to 13 May 2027 and the ₹250 crore penalty figure.
- Offer: **free 14-day AI Data Leak Audit.** They install the extension org-wide, you hand them a PDF of what data was about to leave. This sells itself — nobody has ever seen this report before, and it is generated by software you already built (`scripts/compliance/report.mjs` + the ledger).
- **50 outbound conversations** (you already have `docs/growth/lead-list-template.csv`, `priority-targets.csv`, `objection-handling.md`): Indian AI agencies, IT services 50–500 heads, fintech, healthtech, edtech, CA/law firms. LinkedIn DM → 15-min call → free audit.
- Target: **5 free audits → 3 paying customers → first ₹50K–1L MRR.**
- Partner channel: 10 Indian AI/automation agencies as resellers (they already sell chatbots to SMBs and have zero security story to attach — you are their upsell).
- Community: 1 talk each at a Delhi-NCR / Bangalore / Pune AI meetup + a NASSCOM / TiE / Headstart slot. India's AI-security speaking circuit is empty.

### The 90-day scoreboard

| Metric | Day 90 target |
|---|---|
| Chrome + Edge installs | 500+ |
| VS Code family installs | 300+ |
| n8n monthly downloads | 4,000+ |
| npm monthly downloads (all pkgs) | 5,000+ |
| PyPI monthly downloads | 1,000+ (from **50** today) |
| Registered accounts | 200+ |
| GitHub stars | 300+ |
| Paying customers | 3+ |
| MRR | ₹50,000+ |
| Organic search clicks / mo | 2,000+ |

---

## PART 7 — MONTH 4–24 ROADMAP

### Month 4–6 → 45,000 users
- **Localise the wedge beyond India:** Indonesia, Brazil, Nigeria, Philippines, Vietnam — huge ChatGPT user bases, near-zero AI-security tooling in local languages. Your 79-language engine is already built; only UI strings are missing. This is the cheapest 10× in your whole plan.
- **Open-source `@soterai/guard-core`** (Apache-2.0) with a real CONTRIBUTING.md. Target 1,000 GitHub stars. Stars → HN/Reddit front page → developers → paid conversions.
- **Ship the framework middlewares properly** (un-private them): LangChain, LlamaIndex, Vercel AI SDK, plus new adapters for **CrewAI, AutoGen, LangGraph, Pydantic AI**. Get listed in each framework's own docs/integrations page — that is borrowed distribution from projects with millions of users.
- **1 witnessed third-party benchmark** (your `benchmarks/soterai-public-benchmark/` kit, run by a neutral party). Converts "self-reported" into citable proof and unlocks press.
- Launch the **"Protected by Soter"** badge for chatbots/websites → free backlinks + brand impressions (the Intercom/Stripe playbook).

### Month 7–12 → 231,000 users
- **SOC2 Type I** (docs already in `docs/soc2/`). This is the gate for every deal above ₹5L.
- **Chrome Web Store featuring**: needs 4.5★+, 1,000+ installs, strong privacy disclosure. Featuring is worth ~10× install rate — engineer for it deliberately.
- **Team/viral loop in-product:** shared incident feed, invite teammates to a workspace, org leaderboard of blocked leaks.
- **AI-agent security shift:** as agents replace chat, position the MCP gateway + agent firewall as the flagship. 2026's fastest-growing security category, and you're already built for it.
- Hire #1: **not** an engineer. A content/community person, or an SDR for the DPDP motion.

### Month 13–24 → 1,000,000 users
- **Enterprise land-and-expand from the free base:** every free install inside a company is an inbound signal. Instrument it — when ≥5 installs share an email domain, that is a warm enterprise lead who has already validated your product.
- **Distribution partnerships:** Indian MSPs, cloud resellers, CA/compliance consultancies (they own the DPDP relationship), and browser/OEM bundling.
- **Category ownership:** publish an annual *"State of AI Data Leakage in India"* report from aggregated, anonymised block statistics. Nobody else will have this dataset. It becomes the citation every Indian journalist uses — that is how you become the default name.
- Global enterprise motion begins here — **from a position of proof** (1M users, SOC2, witnessed benchmark, published bypasses), not from a cold pitch.

---

## PART 8 — PRICING RESTRUCTURE (do this in week 1–2)

Current problems: 5 tiers, INR-only, all visible tiers list identical bullets, "for Indian businesses" framing, ₹999 (~$12) reads as "toy" to a global buyer, and non-INR payments are rejected in code.

### Recommended structure

| Tier | India (₹) | Global ($) | For | Key gate |
|---|---|---|---|---|
| **Free forever** | ₹0 | $0 | Everyone | Local scanning unlimited, no signup, 1,000 cloud API calls/mo |
| **Pro** | ₹399/mo | $9/mo | Individuals, freelancers, students | Cloud history, unlimited API, priority detectors |
| **Team** | ₹299/user/mo | $19/user/mo | 3–50 people | Shared policies, org dashboard, audit export |
| **Business (DPDP pack)** | ₹24,999/mo | $499/mo | 50–500 people | Compliance reports, SIEM, approval workflow, DPDP evidence pack |
| **Enterprise** | Custom (from ₹2L/mo) | Custom | 500+ | Self-host, SSO/SCIM, signed receipts, SLA |

Principles:
1. **Purchasing-power pricing:** show ₹ to Indian IPs, $ to everyone else. Same product, different price. This is standard and it is what lets you win both markets.
2. **Free tier must be genuinely unlimited locally.** Local scanning costs you nothing — so make "free forever, offline, unlimited" a headline feature, not a limitation. It is also your best answer to every privacy objection.
3. **Every tier's bullets must differ.** Identical bullets across tiers (current state) actively suppress conversion — the buyer cannot see what they gain by paying.
4. **₹399 Pro, not ₹999.** At 100M ChatGPT users, volume × low price beats margin × few. ₹399 is an impulse purchase for an Indian professional; ₹999 requires a decision.
5. Keep a **hard-coded free-forever promise** in writing. It is your defence against the "why would I trust a security vendor" objection.

---

## PART 9 — POSITIONING & EXACT COPY

### The core repositioning

Stop leading with *"Enterprise AI Control Plane."* You need **two front doors sharing one backend**:

**Front door A — mass/consumer (the 1M engine):**
> **Soter — Your AI doesn't need your secrets.**
> Blocks passwords, API keys, Aadhaar, PAN, and client data before they reach ChatGPT, Claude, or Gemini. Runs on your device. Free forever. No signup.

Hinglish variant for Indian creative:
> **ChatGPT se apna data bachao.** Password, API key, Aadhaar, client data — Soter inhe bhejne se pehle rok deta hai. Aapke device par hi. Free.

**Front door B — developer (the credibility engine):**
> **One function. Zero dependencies. Stop prompt injection and PII leaks in your LLM app.**
> `npm i soter-pii` · `pip install soter-pii` · 100% recall on 2,200 attacks — and we publish the ones we miss.

**Back door — enterprise/DPDP (the revenue engine):**
> **Prove what your employees and AI agents sent to external AI.**
> DPDP-ready audit trail, Aadhaar/PAN/GSTIN detection, self-hosted. Deadline: 13 May 2027.

### The four claims you should repeat everywhere (all defensible)

1. **"The only AI security vendor that publishes its own bypasses."** — unforgeable, and competitors cannot copy it without self-harm. Your single best marketing asset.
2. **"Runs on your device. Your prompts never leave."** — Palo Alto, Cisco, Lakera, Google Model Armor are all cloud-only. This is a real, checkable structural difference.
3. **"Built for Indian data: Aadhaar, PAN, GSTIN, UPI, IFSC — and Hinglish."** — literally zero of 191 competitors.
4. **"Free forever, no signup, no telemetry."** — every competitor says "Contact Sales."

### Claims to never make (they will destroy the honesty moat, which is your only durable moat)

- ❌ "100% secure" / "complete protection" — your own docs correctly refuse this; keep refusing it.
- ❌ "#1 / world's best AI security" from a self-run benchmark. Say **"#2 of 8 on our published, reproducible composite — here's the method"** and link it. Paradoxically this converts better with technical buyers.
- ❌ Any user number you cannot source from a store/registry dashboard.
- ❌ Enforcement claims for the 2 `UNSUPPORTED` capabilities (network egress, child-process control).

---

## PART 10 — WHAT TO STOP DOING (this is as important as the plan)

| Stop | Why | Evidence |
|---|---|---|
| Building new IDE surfaces | You have plans/docs for Eclipse, JetBrains, Sublime, Neovim, JupyterLab, Visual Studio — **6 more surfaces while the existing IDE surface has 3 users.** | `docs/eclipse-plugin-plan.md`, `jetbrains-plugin-plan.md`, `sublime-package-plan.md`, `publishing-neovim-plugin.md`, `jupyterlab-extension-plan.md`, `visual-studio-extension-plan.md` |
| Writing internal analysis reports | ~40 report/audit `.md` files. Zero of them acquire a user. | `docs/` listing |
| More ML retrains / detector tuning | 100% recall, 0% FP on your own corpora. The next 1% is invisible to every buyer. | `DEEP-ANALYSIS-…-2026-08-02.md` §A |
| Enterprise-first messaging | Enterprise needs trust you cannot manufacture at 0 users. It inverts your funnel. | homepage audit |
| Adding features to close "competitor gaps" | You are #2 of 8 on tech and last on users. The gap is not technical. | Part 1 |
| Perfecting before shipping | The extension has been store-ready since 2026-07-09 and is still unsubmitted. | `browser-extension-store-readiness.md` |

**One rule to enforce on yourself:** every week, at least 3 of your 5 working days must produce something a stranger can see — a store listing, a post, a video, a template, an outbound message. Code-only weeks are how you got to 299 commits and 3 users.

---

## PART 11 — MEASUREMENT: the only 8 numbers you track weekly

Fill one row per week. If a number didn't move, that channel gets your next hour — not a new feature.

| Week | Ext installs | IDE installs | Pkg dl/wk (npm+PyPI+n8n) | New accounts | Activation % (installed → 1st block seen) | Paid | MRR | Top-3 traffic sources |
|---|---|---|---|---|---|---|---|---|

**Activation is your most important number.** If people install and never see a block, they uninstall within a week. Target: **>60% see a block in their first session** (that is why the 10-second demo detection in Week 2 matters more than any detector improvement).

### Decision gates (pre-commit to these now, so you don't rationalise later)

| Gate | If missed | Correct response (and the wrong one) |
|---|---|---|
| Day 90: <2,000 Chrome installs | Listing/message is wrong | ✅ Rewrite title, screenshots, first 132 chars, run 3 creative variants · ❌ Add features |
| Day 90: n8n downloads not 3× | Ecosystem cap reached | ✅ Shift budget to browser + PyPI · ❌ Build more n8n nodes |
| Day 90: activation <40% | Onboarding is broken | ✅ Fix first-run demo · ❌ Improve detection |
| Day 90: 0 paying customers | ICP or price is wrong | ✅ 20 more customer calls, test ₹399 and ₹24,999 · ❌ Add enterprise features |
| Month 6: <20,000 users | Wedge is wrong | ✅ Re-pick the wedge (n8n-first or developer-first instead of consumer) · ❌ Keep grinding the same channel |

---

## PART 12 — RISKS AND MITIGATIONS

| Risk | Severity | Mitigation |
|---|---|---|
| **Chrome/Edge store rejection** (broad permissions, privacy disclosure) | High impact, medium likelihood | Your host permissions are already narrowly scoped to 19 AI domains (not `<all_urls>`) — that's the hard part done. Submit with `permission-justification.md` verbatim. If rejected, fix and resubmit within 48h; rejection is routine, not fatal. |
| **Solo-founder bandwidth** | Highest risk in this plan | Enforce the 70/30 split. Automate what you can (scheduled posts, templated outreach). First hire is content/community, not engineering. |
| **191-vendor category noise** | High | Never compete on feature parity. Compete on India + local-first + published bypasses. Those three are structurally uncopyable by a US-funded cloud vendor. |
| **Overclaiming kills the honesty moat** | Fatal if it happens | Keep the honest-claims gate in CI. Never publish a number you cannot source. This is your only moat that money cannot buy. |
| **INR-only payments** | Revenue-blocking | Week 1, task 1.7. Non-negotiable. |
| **Free-tier cost at 1M users** | Medium | Local-first architecture means ~₹0 marginal cost per free user. Keep it that way — never make the free tier server-dependent. |
| **Big-tech bundling** (OpenAI/Google ship native DLP) | Existential, low-medium | Your defence is cross-surface + cross-vendor + self-host + audit trail. A ChatGPT-native feature cannot protect Claude, Gemini, an IDE, and n8n under one policy with one ledger. |
| **India-first read as "cheap"** globally | Medium | Solve with dual pricing (₹/$) and global-facing developer positioning (Front door B), not by abandoning India. |

---

## PART 13 — THE ONE-PAGE ANSWER

**Question:** 0 se 1M users, sabse fast, world-best strategy?

**Answer:**
1. **Week 1:** $5 kharch karo — Chrome + Edge par extension PUBLIC submit karo, PyPI par `soter` 0.2.2 (fixed links) + naya `soter-pii` publish karo, USD payments on karo, license fix karo. Yeh 4 kaam aapke last 7 hafton ki engineering se zyada value denge.
2. **Wedge:** ek product, ek kaam, ek audience — *"India ke 100M ChatGPT users ka data leak hone se bachao"* — free, no signup, Hinglish, aapke device par. Yahi 1M ka rasta hai; baaki koi surface 1M nahi de sakta.
3. **Cash:** DPDP Act (13 May 2027, ₹250 crore penalty) ko sales trigger banao. Free "AI Data Leak Audit" → paid monitoring. Indian SMBs, Indian PII, Indian price — yahan aap Palo Alto se jeet jaayenge kyunki wo yahan aate hi nahi.
4. **Trust:** *"Hum duniya ke ekmatr AI security vendor hain jo apne bypasses publish karte hain."* Yeh headline aapko HN, press, aur developers dono deta hai — aur koi competitor ise copy nahi kar sakta.
5. **Discipline:** hafte ke 5 din mein 3 din aisa kaam jo ek ajnabi dekh sake. 70% distribution, 30% product. Naye surfaces mat banao — jo bane hain unhe users do.

**Realistic:** 1,000 users in 30–45 days · 10,000 in 90 days · 100,000 in ~12 months · **1,000,000 in 18–24 months.**

---

### Sources for the external claims in this document
- AI security market size/crowding: [AI Security Startups Map, Prompt Security](https://startups.prompt.security/) (371 companies, 191 in Runtime & Guardrails, ~$9.9B, as of 2026-07-26)
- Lakera acquisition: [Check Point / Lakera, ~$300M](https://appsecsanta.com/lakera) · [Lakera Series A](https://www.lakera.ai/news/lakera-raises-20m-series-a-to-deliver-real-time-genai-security)
- India ChatGPT scale: [TechCrunch — 100M weekly users](https://techcrunch.com/2026/02/15/india-has-100m-weekly-active-chatgpt-users-sam-altman-says/) · [OpenAI for India](https://openai.com/index/openai-for-india/) · [Livemint — 18–24 send half of messages](https://www.livemint.com/technology/tech-news/chatgpt-now-has-over-100-million-weekly-users-from-india-18-24-year-olds-send-half-the-messages-openai-11771581433489.html) · [Indian Express — Delhi-NCR leads](https://indianexpress.com/article/technology/artificial-intelligence/delhi-ncr-leads-chatgpt-adoption-india-openai-findings-10638277/)
- DPDP timeline/penalties: [Recording Law — DPDP Rules & ₹250 crore, 13 May 2027](https://www.recordinglaw.com/world-laws/world-data-privacy-laws/india-data-privacy-laws) · [Chambers — MeitY may pull deadline to 13 Nov 2026](https://chambers.com/articles/meity-plans-to-cut-short-dpdp-compliance-timeline-and-notify-cross-border-restrictions-for-sdfs) · [Qodequay — phase deadlines](https://www.qodequay.com/dpdpa-compliance-timeline-phases-deadlines)
- Consumer-niche competitors: [AI Shield](https://chromewebstore.google.com/detail/ai-shield/doiicobckjcpkmgbedgmbgommdpbcfcb) · [ScanAix](https://chromewebstore.google.com/detail/scanaix/mcadmnjimenllkjpeaepompbpnnehpjm) · [AI Prompt Injection Detector](https://chromewebstore.google.com/detail/njifehhikfacodbgkklcdheapkemkbep)
- Internal traction verified via npm registry + downloads API, VS Code Marketplace, GitHub API, pypi.org, and soterai.in on 2026-08-03.
