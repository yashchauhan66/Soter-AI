# 14 — PRODUCT HUNT TOP-5 LAUNCH PLAYBOOK

**Banaya:** 2026-09-02 · **Goal:** Day-1 par Top 5 Product of the Day
**Base:** `04-producthunt-hn.md` (copy kit) + `11-ULTRA-MARKETING-BLITZ.md` (channel escalation)
**Yeh file kyun:** upar wali dono files strategy dengi. Yeh file **actual PH ranking math**
aur aaj ki verified product-state par bani hai — kya live hai, kya nahi, aur Top 5 ke liye
kitne upvotes chahiye.

---

## 1. PEHLE SACH — Top 5 ka real number

Maine aaj (2026-09-02) PH leaderboard se real numbers nikale:

| Din | #1 | #3 | #5 |
|---|---:|---:|---:|
| Aaj (live) | 451 | 280 | **201** |
| Kal | 379 | 286 | **244** |
| Pichhla hafta (best) | 513 | 429 | **419** |

**Top 5 ka realistic entry price = 200–280 upvotes.** #1 = 380–450+.

Ab aapka verified current reach:

| Asset | Verified state (aaj check kiya) | Launch-day upvote power |
|---|---|---|
| GitHub repo | **2 stars**, 0 forks, 1 watcher | ~0 |
| VS Code Marketplace | **live**, `soterai.soterai-ide-guard`, **7 installs** | ~0 |
| npm n8n node | **1,552 downloads/month** ✅ | anonymous — DM nahi kar sakte |
| PyPI `soter` | v0.2.2 live | anonymous |
| Chrome Web Store | ❌ **listing hi nahi hai** (search = 0 results) | 0 |
| Product Hunt | ❌ koi profile/following nahi, SoterAI kabhi post nahi hua | **0** |
| soterai.in | ✅ live, playground no-signup ✅ | traffic hai, list nahi |

**Iska seedha matlab:** aaj launch karoge to 20–40 upvotes aayenge, rank 15–25.
200 upvotes dosto se nahi aate — woh ek **pre-built audience** se aate hain.
Aur khareede hue upvotes = permanent ban (PH ka detection isi cheez par bana hai).

> **Toh strategy yeh hai:** launch date ko 18 din aage rakho. Un 18 dinon mein audience
> banao. Phir launch karo. Top 5 pre-launch mein jeeta jaata hai, launch day par sirf
> count hota hai.

**Launch date lock karo: Wednesday 2026-09-23, 12:01 AM PT = 12:31 PM IST.**
(Tue/Wed sabse strong din hain; 23rd tak 18 din ka runway milta hai.)

---

## 2. BLOCKERS — inke bina launch bekaar hai

PH traffic ek hi din aata hai. Agar landing dead-end hai, woh traffic wapas nahi aayega.

| # | Blocker | Kyun launch-critical | Time |
|---|---|---|---|
| **B1** | **Chrome Web Store listing nahi hai** | PH audience ka sabse bada hissa "install karke dekhun" wala hai. Ek-click install na ho to conversion aadha. $5 account → `docs/extension-store/final-public-upload-instructions.md`. Review 3–10 din leta hai — **aaj submit karo**, 23rd tak live ho jaayega | 2 hrs |
| **B2** | GitHub par LICENSE = **NOASSERTION** aur README purana | Aapke working tree mein yeh **already fix ho chuka hai** (BUSL-1.1 SPDX `package.json` mein, LICENSING.md mein explanation, README ke sab links `Soter-AI` par) — par **commit nahi hua**, isliye GitHub abhi bhi purana serve kar raha hai. Sirf commit + push karna hai | 10 min |
| **B3** | Benchmark run **2026-07-22** ka hai (6 hafte purana) | Launch se pehle fresh run: `node scripts/phase-9-run-public-benchmark.js`, phir `node scripts/marketing/generate-ph-gallery.mjs`. Slides khud naye numbers utha lenge | 20 min |
| **B4** | PH maker profile khaali | Zero-history account = spam flag risk. Aaj banao, roz thoda active raho | 20 min + daily |

**B1 aur B4 aaj hi.** B2 aaj commit kar do. B3 22nd ko.

---

## 3. 18-DIN KA RUNWAY (2026-09-02 → 09-22)

Ek hi kaam hai: **250+ log jo launch din aapki link kholenge.** Baaki sab shor hai.

### Din 1–2 (Sep 2–3) — Foundation
- [ ] PH account: real photo, bio ("Building SoterAI — AI security for agents"), X + GitHub linked
- [ ] Chrome Web Store submit (B1)
- [ ] Pending README/LICENSE fixes commit + push (B2)
- [ ] **PH par "Launching soon" page banao** — yeh single sabse bada lever hai. Jo log "Notify me" karte hain, PH unhe launch din **khud notify** karta hai. 18 din mein 150–300 followers = Top 5 ka base
- [ ] Gallery assets ready hain: `marketing/ph-assets/` (6 slides + 3 evidence slides + 240×240 thumbnail frames + social card)

### Din 3–9 (Sep 4–10) — Audience banao, product nahi bech rahe
- [ ] **PH forums mein roz 2 thoughtful comments** (`p/general`, dev-tools threads). Yahi jagah hai jahan PH ki asli community milti hai. Self-promo zero — sirf madad
- [ ] X par roz 1 post: `01-twitter-x-content.md` se. Har post ke saath ek asli screenshot
- [ ] Reddit `r/LocalLLaMA` + `r/developersIndia`: value-first posts (`03-reddit-communities.md`)
- [ ] n8n community forum post — **aapka warmest channel hai** (1,552 downloads/month). Node users hi woh log hain jinhe security ki value samajh aati hai
- [ ] 30 personal DMs — abhi **"launching soon page"** share karo, launch link nahi. Launch din tak yeh log tayaar honge

### Din 10–16 (Sep 11–17) — Proof banao
- [ ] Dev.to article: "I benchmarked 3,200 prompt-injection attacks against my own guard" (`05-articles-seo.md`)
- [ ] Show HN **launch se pehle mat** karo — dono ek hafte mein karne se energy bant jaati hai. HN 30 Sep ke liye rakho
- [ ] 15-second demo video record karo (`public/recording-demo-video-guide.md`) — PH video se engagement ~2x
- [ ] 20 aur DMs (total 50)
- [ ] Launching-soon followers check: **150 se kam ho to launch 1 hafta aage badhao**

### Din 17–18 (Sep 21–22) — War room
- [ ] Fresh benchmark run (B3) → `node scripts/marketing/generate-ph-gallery.mjs` (numbers auto-update)
- [ ] PH draft bharo, **schedule** karo (instant launch nahi — scheduling se prep time milta hai)
- [ ] First comment draft final (neeche ready hai)
- [ ] 50 DMs likh ke rakho — bhejna launch din hai
- [ ] X thread + LinkedIn post schedule

---

## 4. PH LISTING — final copy (paste-ready)

**Name:** `SoterAI`

**Tagline** (PH limit 60 chars — yeh 49 hai ✓):
```
AI security guard for chatbots, RAG apps & agents
```

Backup taglines (sab ≤60, agar A/B karna ho):
- `Stop prompt injection, data leaks & rogue AI agents` (51)
- `Open-source AI security layer for LLM apps & agents` (51)

**Description** (limit 260 — yeh 253 hai ✓, aur yeh **honest version** hai):
```
One security layer for every prompt, output, retrieved document and agent
action. Blocks prompt injection, redacts secrets and Indian PII, holds risky
tool calls for approval. Reproducible 3,200-case benchmark. Free playground,
no signup. Self-hostable.
```

> **Note:** purani draft (`04-producthunt-hn.md`) mein "100% recall, 0% FP" description
> ke andar tha. Maine nikala. Reason: 260 chars mein disclaimer fit nahi hota, aur bina
> disclaimer wala perfect number PH ke technical crowd mein **doubt paida karta hai**,
> trust nahi. Numbers gallery slide par hain — wahan disclaimer ke saath. Yahi honesty
> aapki differentiation hai, isko marketing ke liye mat todo.

**Topics (3–4):** Artificial Intelligence · Developer Tools · Security · Open Source
**Pricing:** Free
**Website:** `https://soterai.in/playground?utm_source=producthunt&utm_medium=launch&utm_campaign=ph_launch_sep26`

> Playground ko landing banao, homepage ko nahi. PH visitor ka attention 10 second ka
> hai — usko seedha "cheez chala ke dekho" par bhejo. Yeh aapka activation event hai.

**Gallery order** (yeh order intentional hai — pehli 2 slides hi 80% log dekhte hain):

| # | File | Kaam |
|---|---|---|
| 1 | `gallery-1-hero.png` | Problem + 3 verdicts. Ek image mein poora product |
| 2 | `evidence-1-secret-blocked.png` | **Asli screenshot**, real Edge run se — mockup nahi |
| 3 | `gallery-2-benchmark.png` | Numbers + disclaimer, ek saath |
| 4 | `gallery-4-agent-firewall.png` | Agent angle (PH par AI-agents category trending hai) |
| 5 | `gallery-3-india-pii.png` | India wedge |
| 6 | `gallery-5-surfaces.png` | Integration breadth |
| 7 | `gallery-6-limitations.png` | Honesty slide — yeh aapka signature move hai |

**Thumbnail:** `thumbnail-240-frame-1/2/3.png` — teeno ko ek 240×240 GIF mein jodo
(~600ms per frame, loop). Animated thumbnail ka click-through static se lagbhag double hota hai.

Sab assets already generate ho chuke hain: `marketing/ph-assets/`
Regenerate: `node scripts/marketing/generate-ph-gallery.mjs`
Benchmark numbers **automatically** JSON se aate hain — kabhi haath se mat likho.


---

## 5. FIRST COMMENT (launch ke 2 minute ke andar post karo)

> Hi Product Hunt 👋 I'm Yash, solo founder.
>
> **Why I built this:** I asked ten founders what stops someone from jailbreaking
> their AI chatbot. Every answer was a version of "the system prompt says don't."
> That's not a control, that's a hope. Your app authenticates every request — and
> then forwards the prompt, the retrieved documents, the model's output and the
> agent's tool call without inspecting any of them.
>
> **What SoterAI does:** one policy layer across all four. It detects prompt
> injection and jailbreaks, redacts secrets and Indian PII (Aadhaar-like, PAN,
> GSTIN, UPI, IFSC) before they reach a model, and holds risky agent tool calls —
> payments, mass emails, deletes — for human approval instead of executing them.
>
> **Where it runs:** REST API and SDKs, a Chrome/Edge guard, an IDE guard for
> VS Code / Cursor / Windsurf / Kiro, native n8n / Make / Zapier nodes, or fully
> self-hosted with Docker. Local scanning needs no account and makes no network call.
>
> **The numbers, and their limits:** on my published 3,200-case synthetic set,
> recall is 100% at 0.00% false positives, ~18ms p95 analyzer latency. That set is
> **mine** — synthetic, self-maintained, not a third-party audit, not production
> traffic. The number I'd actually judge this on is different: on a **blind held-out
> set that no detector was ever tuned against, recall is 61.54%** (n=26). That gap
> between 100% and 61.54% is the honest state of a rules-first engine against novel
> phrasings, it's asserted as a floor in CI, and closing it is what the ML tier is
> for. Both numbers are in the README. You can re-run either
> (`node scripts/phase-9-run-public-benchmark.js`) and the raw JSON is committed.
>
> **What I don't have:** SOC 2, customer logos, an independent pen test, or a large
> user base. This is early and honestly labelled — Stable, Beta and Labs tags are
> visible in-product.
>
> Playground needs no signup: soterai.in/playground
>
> I'll be here all day. The most useful thing you can do is **break it** — send me a
> bypass and I'll add it to the benchmark and credit you. Blunt criticism of the
> benchmark methodology especially welcome.

**Kyun yeh kaam karta hai:** limitations aap khud bata rahe ho, koi aur aapko expose
nahi kar raha. PH aur HN par yeh sabse strong trust signal hai — aur competitors ke
liye copy karna mushkil hai, kyunki unke paas publish karne ki himmat nahi hai.

---

## 6. LAUNCH DAY — 2026-09-23 (IST timeline)

| Time (IST) | Kaam |
|---|---|
| 12:31 PM | Live. First comment turant. Gallery + sab links verify |
| 12:40 PM | X thread + LinkedIn post. PH link **comment mein** rakho, post ke andar nahi (reach better rehta hai) |
| 1:00 PM | 50 DMs bhejo — jo pehle se drafted hain |
| 1:30 PM | Reddit r/SideProject + r/developersIndia |
| 2:00 PM | n8n forum + jo communities mein aap already member ho |
| 2–8 PM | **Har comment ka reply 15 min ke andar.** Yahi sabse zyada matter karta hai |
| 8:00 PM | Milestone post X par (rank ka screenshot) — log jeetne wale ke saath jaate hain |
| 11:00 PM | US morning wake-up: doosri DM wave, PH forums mein active raho |
| Next day 12:30 PM | Din khatam. Thank-you comment + result post |

### DM template (upvote **kabhi** mat maango)

> Hey [Name] — SoterAI launched on Product Hunt today. It's the AI security layer
> I've been building: prompt injection, data leaks, agent tool-call approval.
> Genuinely after feedback rather than votes — the benchmark methodology is the part
> I most want torn apart: [link]

**"Upvote karo" likhna = ban.** PH ka rule seedha hai: *"you cannot ask people directly
to upvote your product. Instead, ask them to visit and comment."* Comments maangna 100%
allowed hai — aur comments ranking mein count hote hain.


---

## 7. Jo BILKUL nahi karna

- ❌ Upvote maangna (DM, WhatsApp group, kahin bhi) — permanent ban
- ❌ Upvote khareedna / vote ring — PH ka detection isi cheez par bana hai
- ❌ Multiple accounts, ya company account (PH par company accounts banned hain)
- ❌ "100% secure", "SOC 2 compliant", "independently validated" — teeno false honge
- ❌ Real Aadhaar/PAN kisi bhi demo mein — sirf synthetic
- ❌ Same hafte PH + Show HN dono — energy bant jaati hai, dono average reh jaate hain

---

## 8. Realistic outcome (jhooth nahi)

| Scenario | Upvotes | Rank | Verdict |
|---|---:|---|---|
| Aaj launch (audience = 0) | 20–40 | 15–25 | ❌ |
| 18-din runway, 150+ launching-soon followers | 120–200 | 6–12 | Achha |
| 18-din runway + 300 followers + Chrome store live + roz PH forum activity | **220–320** | **Top 5** ✅ | Target |

Top 5 achievable hai — par woh **23 September ko launch karne se** milega, aaj nahi.
Sabse bada single variable: **launching-soon page ke followers.** Agar 17 September tak
150 se kam hain, launch aage badhao. Kharab launch delete nahi hota — woh permanent
record ban jaata hai.

---

## 9. Aaj ke 90 minute

1. PH account + **"Launching soon" page** live karo (30 min) ← sabse bada lever
2. Chrome Web Store submit (B1) — review clock aaj shuru hona chahiye
3. Pending README/LICENSE fixes commit + push (B2, 10 min)
4. `marketing/ph-assets/` ki slides dekho; jo ek line bhi galat lage, batao — main theek kar dunga
5. 10 logon ko launching-soon page bhejo (launch link nahi — woh abhi exist hi nahi karta)

---

## 10. Repo mein kya add hua (is playbook ke saath)

| Cheez | Path | Kaam |
|---|---|---|
| Asset generator | `scripts/marketing/generate-ph-gallery.mjs` | 6 gallery slides + 3 evidence slides + 3 thumbnail frames + social card. Numbers **benchmark JSON se** aate hain, haath se nahi |
| Generated assets | `marketing/ph-assets/` | PH ke exact sizes: 1270×760 gallery, 240×240 thumbnail, 1200×630 social. `manifest.json` batata hai kaunsa number kis run se aaya |
| Claim gate | `tests/marketing-launch-claims.test.ts` | Tagline ≤60, description ≤260, forbidden claims absent, aur slides ke numbers benchmark se match karte hain — warna test fail |

```bash
npm run marketing:ph-assets       # slides regenerate karo
npm run test:marketing-claims     # launch copy verify karo
```

**Generator ka design:** agar benchmark JSON missing ho, ya headline slide se bahar nikal
jaaye, to script **exit 1** karti hai — aadha-adhoora ya overlapping-text asset kabhi
generate nahi hoga. Aur benchmark re-run karne par slides ke numbers khud badal jaate hain,
toh stale claim ship karna technically possible nahi hai.


