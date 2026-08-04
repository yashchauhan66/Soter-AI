# 03 — Reddit + Developer Communities Strategy

**Goal:** 60–100 users in 30 days | **Cadence:** 2 posts/week + 15 min/day commenting
**⚠️ Reddit Golden Rule:** 9:1 ratio — 9 pure-value contributions har 1 self-promo ke liye. Agar account naya hai (<30 din, <100 karma), pehle 1 hafta SIRF comments karo. Ban mat khao.

---

## 🎯 TARGET SUBREDDITS (priority order)

| Subreddit | Members | Angle | Best day/time (IST) | Rules note |
|-----------|---------|-------|--------------------|-----------|
| **r/ChatGPT** | ~15M+ | Consumer privacy: "your data leaks into ChatGPT" | Sat/Sun 7–9 PM | Self-promo restrictions — value post first, product in comments |
| **r/LocalLLaMA** | ~800K | Technical: benchmark + guard architecture | Tue–Thu 6–9 PM | Technical depth required; Show/demo posts OK |
| **r/PromptEngineering** | ~500K | Attack education: "5 attacks that bypass your prompts" | Wed 7 PM | Educational content does well |
| **r/SideProject** | ~700K | "I built X" launch post | Any day, 4–6 PM | Self-promo ALLOWED — direct pitch OK |
| **r/developersIndia** | ~400K | India angle: DPDP + Hinglish detection | Sat 11 AM | Indian dev community, startup posts OK on some days |
| **r/cybersecurity** | ~1.2M | Research-style: obfuscation attack taxonomy | Tue/Wed 3–5 PM | Strict: no marketing; research/education only |
| Bonus: r/n8n (~50K), r/selfhosted (~450K), r/IndianStartups, r/artificial, r/MachineLearning (research tone) |

---

## 📝 POST DRAFT #1 — r/ChatGPT (Day 3) — VALUE-FIRST

**Title:** "I tested what personal info people commonly paste into ChatGPT — and how easily it can leak. Here are the 7 riskiest things."

**Body:**
> I've been researching AI data leakage for the past few months (building tooling in this space), and I wanted to share the patterns I keep seeing — because most people genuinely don't realize these count as leaks:
>
> **1. Resumes/CVs** — full name + phone + address + sometimes Aadhaar/PAN in one paste. HR folks do this daily to "summarize candidates."
>
> **2. Customer support tickets** — name, email, order IDs, phone numbers. "Rewrite this reply professionally" = customer PII sent to a third party.
>
> **3. API keys & passwords** — more common than you think. People paste config files and error logs that have live credentials inside.
>
> **4. Source code with secrets** — `.env` contents, hardcoded tokens, connection strings.
>
> **5. Financial data** — GST invoices, bank details, salary info ("make this into a table").
>
> **6. Medical info** — "summarize my blood test report" — health data is the most regulated data class almost everywhere.
>
> **7. Client contracts** — freelancers/agencies paste entire agreements to "explain this clause."
>
> The core issue: once it's in the chat, you've lost control of that data. It may be used for training (check your settings), stored in logs, or exposed in a breach. India's DPDP Act goes up to ₹250cr penalties for exactly this kind of uncontrolled sharing when it's *customer* data.
>
> **What you can do today:**
> - ChatGPT: Settings → Data Controls → turn OFF chat training
> - Never paste: government IDs, passwords/keys, other people's data
> - Companies: write a 1-page AI usage policy this week. Seriously, this week.
> - There are free browser tools that warn you before you paste sensitive stuff (I built one — link in comments if mods allow, since self-promo isn't allowed in posts)
>
> Happy to answer questions about data handling on any platform. Ask away.

---

## 📝 POST DRAFT #2 — r/LocalLLaMA (Day 6) — TECHNICAL

**Title:** "I built an open-source LLM guard layer and benchmarked it against 3,200 attacks (base64, unicode tricks, Hinglish jailbreaks). 100% recall, 0% FP, 10.9ms p95. Methodology + raw data inside."

**Body:**
> I've been working on prompt-injection/jailbreak detection and wanted to share the approach + get roasted on the methodology.
>
> **The problem with most guards:** they catch "ignore previous instructions" in English and miss everything else. So I focused on the bypass vectors:
>
> **Detection layers:**
> - Obfuscation decoding pipeline: base64/base64url, hex, binary, morse, leetspeak, unicode normalization (zero-width chars, homoglyphs), Caesar shifts — decode first, *then* classify
> - 15 jailbreak family signatures: roleplay, adversarial suffixes, token smuggling, ASCII-art smuggling, function-call wrappers, multi-agent propagation
> - Multilingual semantic classifier: 79 languages. Hindi/Hinglish attacks specifically — English-only filters miss "pehle ke rules bhool jao" style attacks entirely
> - PII/secret leak detection: incl. India-specific formats (Aadhaar, PAN, GSTIN, UPI) — surprisingly absent from existing tools
>
> **Benchmark (Phase 9):**
> - 3,200 cases: 2,200 attacks / 1,000 benign controls
> - 100.00% recall, 0.00% FPR, 0.00% FNR
> - 10.92ms p95 CPU latency, ~5ms p50
>
> **Honest caveats (before you ask):** this is a *synthetic, self-maintained* dataset. Not an independent audit, not production traffic. The 0% FP on synthetic controls means little until real-world benign traffic hits it. I'd genuinely like adversarial testers to break it.
>
> **Fully reproducible:** `node scripts/phase-9-run-public-benchmark.js` — dataset + raw JSON results committed to the repo.
>
> GitHub: github.com/yashchauhan66/Soter-AI
> The detection code is in `lib/guard/` — no black box.
>
> Questions I want feedback on:
> 1. What attack classes should round 10 include? (multimodal injection is on my list)
> 2. Anyone done recall testing on REAL benign user traffic? How did you handle consent/labeling?
> 3. The eternal tradeoff: regex+heuristics (fast, explainable) vs embedding classifiers (generalize, opaque) — I use both in sequence. Curious what this sub prefers.

---

## 📝 POST DRAFT #3 — r/SideProject (Day 12) — DIRECT LAUNCH (self-promo allowed)

**Title:** "I built a free browser extension + open-source layer that stops you from leaking secrets into ChatGPT (and blocks jailbreak attacks on your own AI apps)"

**Body:**
> **What it does:** SoterAI sits between you and AI tools. Paste an API key, password, Aadhaar number, or customer data into ChatGPT → it warns/blocks before send. 100% local, nothing leaves your device.
>
> For developers: same engine is an open-source middleware (npm/pip) that guards your own chatbots/RAG/agents against prompt injection + jailbreaks. Agent action control too — your AI agent can't fire off payments/emails without human approval.
>
> **Why I built it:** I asked 10 founders what stops someone from jailbreaking their chatbot. 10/10 said some version of "the prompt says don't." That scared me enough to spend 7 weeks fixing it.
>
> **Numbers:** 1,030 tests · 3,200-case public benchmark (100% recall, 0% FP, reproducible with one command) · 79 languages · all code open.
>
> **Links:** Website + playground (no signup): soterai.in | GitHub: [link] | Chrome extension: [link when live]
>
> Roast away — UX, positioning, the name, anything. I'm here for it. 🙏

---

## 📝 POST DRAFT #4 — r/developersIndia (Day 17) — INDIA ANGLE

**Title:** "DPDP Act deadline (₹250cr penalty, May 2027) + your company pasting data into ChatGPT = a problem nobody's talking about. Built a free tool for it."

**Body:**
> deves, ek scenario:
>
> Support team ka banda customer ticket ChatGPT mein paste karta hai "reply likhne ke liye." Ticket mein customer ka naam, phone, aur address hai. HR resumes paste karti hai. Sales lead lists paste karta hai.
>
> DPDP Act ke under, yeh sab customer data ka uncontrolled transfer hai — upto ₹250 crore penalty, aur full compliance deadline 13 May 2027 hai (Rules Nov 2025 mein notify ho chuke).
>
> **The gap I found:** India has 100M weekly ChatGPT users — 2nd largest market globally. But not a single AI security tool detects Aadhaar/PAN/GSTIN, Hinglish jailbreak attempts, or gives you a DPDP-friendly audit trail. 191 funded companies in this space, all fighting over US enterprises.
>
> **So I built it (open-source):**
> - Browser extension: warns before Aadhaar/PAN/keys/passwords get pasted into ChatGPT/Claude/Gemini. 100% local — kuch bhi device se bahar nahi jaata.
> - Team policies: which departments can use which AI tools
> - Hash-chained audit trail: auditor ko dikha sakte ho kya block hua, kab, kyun
> - Hinglish attack detection (jailbreaks written in Hindi/Hinglish)
>
> Free hai, open-source hai: soterai.in | GitHub: [link]
>
> **Question for the sub:** aapki company mein AI usage policy hai? Aur kya aapko pata hai team kya paste kar rahi hai ChatGPT mein?

---

## 📝 POST DRAFT #5 — r/cybersecurity (Day 20) — RESEARCH TONE (no product pitch in body)

**Title:** "Taxonomy of obfuscated prompt-injection attacks: 9 encoding families + 15 jailbreak families we catalogued while building detection"

**Body:**
> Sharing research from building an open-source injection detector. The interesting finding: **detection tools overwhelmingly fail at obfuscated variants of well-known attacks.**
>
> **Encoding families that bypass naive filters:**
> 1. Base64/base64url wrapping
> 2. Hex / binary / decimal byte encoding
> 3. Morse code payloads
> 4. Leetspeak (1gnor3 pr3v1ous 1nstruct1ons)
> 5. Zero-width unicode smuggling (invisible to humans, visible to tokenizers)
> 6. Homoglyph substitution (Cyrillic 'а' for Latin 'a')
> 7. Caesar/ROT shifts with decode instructions
> 8. ASCII-art token smuggling
> 9. Cross-lingual payloads (attack in Hindi/Tagalog under English-only filters)
>
> **The defense that works:** a decode-then-classify pipeline. Normalize ALL encodings to canonical text first, then run classification. Checking raw text against signatures is nearly useless.
>
> **The FP trap:** aggressive pattern matching flags benign prompts ("先前指令" contains Chinese text that pattern-matched as 'ignore previous'). Our benign control set caught 3 classes of overreach the initial rules had. Always benchmark attacks AND controls.
>
> Full dataset (3,200 cases synthetic) + detection code is open source [link]. Happy to share methodology details. Not affiliated with any commercial offering beyond maintaining this open-source project.
>
> *(Note: r/cybersecurity mods — flagging upfront that I maintain the linked OSS project. Posting for methodology discussion, happy to remove link if preferred.)*

---

## 💬 DAILY COMMENT STRATEGY (the real growth lever)

15 min/day, every day, from Day 1:

| Where | What |
|-------|------|
| r/ChatGPT new posts | "Is it safe to paste X into ChatGPT?" type questions → helpful answer, tool mention only if directly relevant |
| r/LocalLLaMA | Guard/security/guardrails threads → technical input, share detection knowledge |
| r/n8n | Workflow security questions → your node solves this, natural mention |
| r/devops, r/selfhosted | Self-host AI threads → local broker angle |

**Comment formula:** [Direct answer/helpful info] + [personal experience] + [soft mention at the END, max 1 link]: "Full disclosure: I built a free tool that does this — [link]. Even without it, [restate the manual advice]."

---

## 🚫 BAN-AVOIDANCE CHECKLIST
- [ ] Account 30+ days old ya 100+ karma before first promo-leaning post
- [ ] Read EACH sub's rules before posting (they differ wildly)
- [ ] Never post same content to 2 subs same day
- [ ] Never ask for upvotes (anywhere, ever — instant ban)
- [ ] Flair posts correctly (many subs auto-remove unflaired)
- [ ] If a post gets removed: DON'T repost. Message mods politely, ask what to fix.
- [ ] Reply to EVERY comment on your posts within 2 hours — Reddit algorithm rewards it heavily
