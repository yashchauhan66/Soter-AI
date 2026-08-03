# 02 — LinkedIn Content Pack (Ready to Post)

**Goal:** 30–50 users + 20 founder/CTO connections | **Cadence:** 3 posts/week (Mon/Wed/Fri)
**Audience split:** Indian CTOs, engineering managers, compliance folks + global AI devs
**Profile first:** Headline → "Founder, SoterAI 🛡️ Open-source AI security | Prompt injection · Agent control · DPDP-ready | 100% benchmark recall" · Featured → soterai.in/playground + GitHub

---

## 📄 POST #1 — FOUNDER STORY (Day 2)

> **7 weeks ago I found a scary gap.**
>
> Every company around me was shipping AI features — chatbots, RAG pipelines, agents with payment access.
>
> So I started asking founders one question: "What stops a user from jailbreaking your chatbot in one message?"
>
> The answers terrified me:
> → "The system prompt says don't."
> → "OpenAI handles that, right?"
> → "We'll add security later."
>
> Here's the truth: base64-encoded instructions, invisible Unicode, leetspeak, attacks in 79 languages — one message is all it takes. Most apps have literally zero defense layer.
>
> So I stopped asking and started building.
>
> **299 commits. 1,030 tests. 3,200 benchmark attack cases later:**
> → 100% recall on attack detection
> → 0.00% false positives
> → 10.92ms p95 latency
> → Detection in 79 languages including Hinglish 🇮🇳
>
> SoterAI is open-source. The benchmark is public and reproducible. The limitations page is on the website. Because security you can't verify is just marketing.
>
> Try it in 30 seconds (free, no signup): soterai.in/playground
>
> If you're building with LLMs in 2026, I'd love your brutal feedback in the comments. 👇
>
> #AISecurity #LLM #BuildInPublic #OpenSource

---

## 📄 POST #2 — THE UNCOMFORTABLE QUESTION (Day 5)

> **Your employees pasted company data into ChatGPT 47 times today.**
>
> (I made up the 47. But you don't know the real number either — and that IS the problem.)
>
> This is Shadow AI: your team's daily usage of ChatGPT, Claude, Cursor, Gemini — with zero governance:
>
> ❌ No policy on what data goes where
> ❌ No idea which department leaks what
> ❌ No audit trail when (not if) something goes wrong
>
> Shadow IT took enterprises a decade to control. Shadow AI will move 10x faster.
>
> What we built for this:
> → Department-level AI usage policies (engineering ≠ marketing ≠ finance)
> → Provider allow/block lists (OpenAI ✅, random-GPT-wrapper ❌)
> → PII/financial data blocked BEFORE it leaves the browser
> → Compliance reports you can actually show an auditor
>
> Free tier available. 100% local processing option — prompts never touch our servers.
>
> Curious: does your company have a written AI usage policy today? Yes/No in comments — I'll share the aggregate results next week. 👇
>
> #AIGovernance #DataPrivacy #CISO

---

## 📄 POST #3 — PRODUCT HUNT LAUNCH (Day 9)

> **🚀 We just launched on Product Hunt!**
>
> SoterAI — the open-source security layer between your AI and the chaos.
>
> The one-liner: block prompt injection, jailbreaks, and data leaks BEFORE they reach your LLM.
>
> What makes us different:
>
> 🛡️ **Not just a wrapper** — defense across 15+ jailbreak families, obfuscated payloads (base64, morse, unicode tricks), and adversarial NLP attacks
> 🤖 **Agent Control** — your AI agent can't send emails, charge payments, or touch the DB without human approval
> 🌐 **79 languages** — including the only Hinglish attack detection in the market
> 🇮🇳 **India-native PII** — Aadhaar, PAN, GSTIN, UPI, IFSC detection built in
> 📊 **Honest benchmarks** — 100% recall / 0% FP on our public, reproducible dataset (run it yourself, raw JSON in the repo)
>
> Building security tools means earning trust one verified claim at a time.
>
> Check us out + roast us in the comments (link in first comment) 👇
>
> #ProductHunt #AISecurity #Launch

---

## 📄 POST #4 — AGENT ACTION HORROR (Day 13)

> **An AI agent at a real company issued refunds it was never asked to issue.**
>
> Autonomous AI agents are the biggest enterprise risk of 2026 that nobody's pricing in.
>
> They can already:
> → Send emails your customers see as "from you"
> → Charge cards and initiate payments
> → Write to production databases
> → Close support tickets
>
> And the standard safety mechanism is… telling the model "please don't do the wrong thing" in the prompt.
>
> That's not a control. That's a wish.
>
> What actual agent control looks like (this is what we ship):
>
> 1️⃣ **Action classification** — every action labeled IRREVERSIBLE / COMPENSATING / REVERSIBLE
> 2️⃣ **Risk scoring** — `payment.charge` is CRITICAL. `ticket.tag` is LOW.
> 3️⃣ **Human approval queue** — high-risk actions pause for human review with redacted payloads
> 4️⃣ **Rollback windows** — 15–60 min to reverse compensating actions, with dry-run
> 5️⃣ **Audit trail** — SHA-256 evidence hashing, SOC 2-ready
>
> Your agent works for you. It shouldn't act without you.
>
> GitHub in comments. Always open to technical pushback. 👇
>
> #AIAgents #AISecurity #EnterpriseAI

---

## 📄 POST #5 — DPDP ACT (Day 16) — INDIA COMPLIANCE ANGLE 🇮🇳

> **₹250 crore penalty. Deadline: 13 May 2027.**
>
> If your company lets employees paste customer data into ChatGPT, you have a DPDP Act problem.
>
> Quick context for Indian founders/CTOs:
>
> 📋 DPDP Rules notified 13 Nov 2025
> ⏰ Full compliance deadline: **13 May 2027** (MeitY has proposed pulling it to Nov 2026)
> 💸 Penalties: up to ₹250 crore per violation class
>
> Now think about your Tuesday:
> → Support agent pastes a customer ticket into ChatGPT (contains name + phone + Aadhaar)
> → Sales rep asks Claude to "clean up this lead list" (5,000 rows of PII)
> → HR summarises resumes in Gemini (health info, addresses)
>
> Every paste = potential data principal's personal data leaving your control with **zero audit trail.**
>
> What DPDP-ready AI usage looks like:
> ✅ Block Aadhaar/PAN/GSTIN/phone numbers BEFORE they leave the browser
> ✅ Enforce which AI providers each department can use
> ✅ Hash-chained audit ledger: what was blocked, when, for whom — provable to an auditor
>
> We built exactly this. It's free to start, runs locally (prompts never leave the device), and is the only tool we know of with India-native PII detection.
>
> Happy to walk any Indian founder through a 15-min DPDP-readiness check for your AI usage. DM me.
>
> #DPDP #DataPrivacy #India #Compliance #AISecurity

---

## 📄 POST #6 — COMPETITIVE HONESTY (Day 20)

> **There are 191 funded companies in AI security. We're an unfunded open-source project.**
>
> Here's why I still like our position:
>
> What $9.9B of funding bought the market:
> → Enterprise sales cycles ("Contact us for pricing")
> → English-only detection
> → Closed source + "trust us" benchmarks
> → Zero presence in the world's 2nd largest AI user market
>
> What we built instead:
> → Free tier + self-host in one docker command
> → 79 languages. The ONLY Hinglish attack detection in the category
> → Public benchmark you can reproduce with one command
> → A limitations page (yes, we publish what we DON'T catch)
> → India-native PII: Aadhaar, PAN, GSTIN, UPI, IFSC
>
> Our honest weaknesses:
> ❌ No SOC 2 Type II yet (Type I readiness docs public)
> ❌ No enterprise logos (we have ~100 users, not 1,000)
> ❌ Our benchmark is self-maintained and synthetic — verify it before you trust it
>
> Security is a trust business. We're earning it in public, one verified claim at a time.
>
> If you're evaluating AI security tools, do this one thing: ask every vendor for a benchmark you can run yourself. Watch what happens. 👀
>
> #OpenSource #AISecurity #StartupJourney

---

## 📄 POST #7 — USER MILESTONE (Day 27, adapt numbers)

> **[XXX] people now use SoterAI to stop AI data leaks. 30 days ago: 0.**
>
> No ads. No growth hacks. Here's exactly what worked (full transparency):
>
> 🥇 Chrome Web Store search — [X]% of installs. People actively search "chatgpt privacy" — be there.
> 🥈 One Hacker News post — [X]% of traffic in 48 hours.
> 🥉 Reddit — but ONLY the posts where we gave value first and mentioned the product last.
>
> What flopped:
> ❌ Cold DMs under 30% reply rate (fixed by leading with a free teardown of their AI security posture)
> ❌ LinkedIn posts without a contrarian hook
>
> Next milestone: 5,000 users.
>
> The most surprising thing we learned: our best-converting users are Indian freelancers and agencies — exactly the "unsexy" segment every funded competitor ignores while fighting for US enterprise deals.
>
> Onwards. 🛡️
>
> #BuildInPublic #StartupMetrics #AISecurity

---

## 📄 POST #8 — TECHNICAL DEEP-DIVE (Week 4, cross-post from Dev.to)

> **I benchmarked our AI guard against 15 jailbreak families. Full methodology + code inside.**
>
> How do you actually TEST a prompt-injection detector? Most vendors won't tell you.
>
> Our approach, fully open:
>
> 📦 **Dataset:** 3,200 cases — 2,200 attacks across base64/hex/morse/unicode/leetspeak/ASCII-art smuggling + 15 jailbreak families + adversarial NLP… and 1,000 benign control prompts (the FP trap most tools fail)
>
> ⚙️ **Method:** static analyzer + ML classifier, measure recall + FPR + latency on CPU
>
> 📊 **Results:** 100% recall · 0.00% FPR · p95 10.92ms
>
> ⚠️ **The honest caveats:** synthetic dataset, self-maintained, not production traffic. We say this everywhere. Reproduce it: `node scripts/phase-9-run-public-benchmark.js` — raw JSON committed.
>
> Full write-up with charts: [Dev.to link]
>
> If you work on LLM evals or AI red-teaming, I'd genuinely love your critique — what attacks should round 10 include?
>
> #LLMSecurity #RedTeaming #MachineLearning

---

## 📌 LINKEDIN RULES FOR THIS ACCOUNT
- **Best times IST:** Tue–Thu, 8:30–10:30 AM and 5–7 PM (DPDP post = weekday morning for compliance folks)
- **Hook = first line only.** LinkedIn truncates at ~3 lines. If line 1 doesn't stop the scroll, nothing else matters.
- **Polls work:** Post #2's "Does your company have an AI usage policy?" — convert into a native LinkedIn poll too (double reach)
- **Comment strategy:** 10 meaningful comments/day on posts by Indian CTOs, CISOs, AI founders. Your headline does the marketing.
- **Always:** link in first comment (not post body — LinkedIn suppresses external links), reply to every comment within 1 hour.
- **Repurpose:** every LinkedIn post = Twitter thread + vice versa. Same idea, native format.
