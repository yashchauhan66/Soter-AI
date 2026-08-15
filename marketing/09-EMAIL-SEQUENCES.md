# 09 — COMPLETE EMAIL SEQUENCES (Ready to Send)

**Use with:** `marketing/08-LEADS-DATABASE.csv` | **Sender:** Yash, founder — soterai.in
**Golden rules:** Personalize line 1–2. One bump after 4–5 days. Reply <2 hrs. Never send to unverified addresses.

> **Her message structure:** Hook (their world) → Proof (your numbers) → Gift (value before ask) → Tiny ask (5 min, not a sale).

---

## 🥇 HERO EMAILS — 15 fully personalized, copy-paste ready

---
### H1 → n8n (L01) — Your warmest lead
**To:** n8n community team (community.n8n.io, where you're already active) · **Template:** T1

**Subject:** The SoterGuard n8n node → the full security layer your users keep asking about

Hi n8n team,

I'm the builder of the SoterGuard community node — it quietly crossed **1,361 downloads** last month with zero promotion. That told me something loud: n8n users are wiring LLMs into real workflows and they're worried about what those LLMs can be tricked into doing.

Since then I built the full layer the node connects to — SoterAI:

- **Prompt injection + jailbreak blocking** before the model ever sees it
- **PII/secret redaction** (incl. Aadhaar/PAN/GSTIN — nobody else detects Indian identifiers)
- **Agent action approval** — an agent can't fire a payment or send an email without human sign-off
- **100% local**, open source, 10.9ms overhead

**The ask:** I'd love to get SoterGuard into your featured/verified integrations and co-write a "secure your AI workflows" post for the n8n blog. Your users get a guardrail; n8n gets the most security-conscious AI automation story of any platform. Zero cost, I'll do all the work.

5-min demo of it catching a live attack: soterai.in/playground · Benchmark receipts (100% recall, 0% FP, 3,200 cases, raw JSON in repo): github.com/yashchauhan66/Soter-AI

Worth a 15-minute call this week?

Yash Chauhan
Founder, SoterAI — soterai.in

---
### H2 → Portkey.ai (L11) — Partner, not competitor
**Subject:** You're the gateway. We're the India-compliance guardrail pack. (Co-integration idea)

Hi Rohit,

I use Portkey's docs regularly — the cleanest LLM gateway story out of India. I'm not writing to compete; I'm writing because our stacks snap together.

Portkey's guardrails are strong but English-generic. SoterAI is the missing pack for your Indian + multilingual customers:

- **Hinglish + 78 other language attack detection** — 191 vendors in this space, zero detect a jailbreak written in Hinglish. India has 100M weekly ChatGPT users.
- **India-native PII** — Aadhaar, PAN, GSTIN, UPI VPA detection before the call leaves the gateway
- **Public reproducible benchmark** — 100% recall / 0% FP / 10.92ms p95 on 3,200 cases; raw JSON committed to the repo (no "trust us")

**Proposal:** a SoterAI guardrail provider integration in Portkey + a joint blog post ("DPDP-ready guardrails for Indian LLM apps"). I build everything, you review and ship.

Can I send a working integration branch for you to poke?

Yash

---
### H3 → Helicone (L13) — See-and-stop bundle
**Subject:** You see the attack. We stop it. (Bundle idea)

Hi team,

Helicone users already *watch* prompt injections sail through their logs. The natural next click is "block this" — and Helicone doesn't do blocking, by design.

SoterAI does only blocking: prompt injection, jailbreaks, PII/secret leakage, agent-action gating. Local-first, OSS, 10ms.

**Idea:** a one-line integration doc — "See it in Helicone, stop it with SoterAI" — plus a joint post with a live attack replay. Your observability stays pure; your users get a remediation path. I've drafted the doc already.

15 minutes to show you the replay?

Yash

---
### H4 → Botpress (L27) — Unjailbreakable bots
**Subject:** Your builders' bots get jailbroken in 30 seconds. Fix: a 2-minute integration.

Hi Botpress partnerships team,

40k+ builders ship bots on Botpress that anyone can jailbreak with a paragraph. You've seen the screenshots on Reddit.

I built the guard for exactly this: SoterAI — open source, blocks injection + PII leaks, works in 79 languages (incl. Hinglish — your India builder base), redactions happen before the LLM call.

**For Botpress:** a listed integration + a co-authored "How to ship an unjailbreakable bot" template in your marketplace. Your builders get a security checkbox nobody else offers; you get the differentiation story.

Here's a 20-second clip of it stopping a live attack on a support bot: [GIF]

Should I send the integration spec?

Yash

---
### H5 → Chatbase (L29) — Indie-speed pitch
**Subject:** Security add-on your users will pay for (I built it, it's ready)

Hey Yasser,

Big fan — the way you ship is the industry benchmark for indie speed.

One-line: your users add guardrails to their bots by adding **one SoterAI key** — prompt injection, jailbreaks, PII leaks (incl. Aadhaar/PAN for your India customers) all blocked before OpenAI sees the message. Local option = no data leaves their browser.

It could be a paid add-on in your settings page by next week. API is stable, docs ready, integration is ~150 lines on your side.

Want the API key + a test bot to try attacking? Takes 10 minutes to form an opinion.

Yash

---
### H6 → TLDR AI (L51) — News pitch
**Subject:** Story: the only AI guard that detects attacks in 79 languages (incl. Hinglish) — with a public benchmark anyone can re-run

Hi TLDR team,

Daily reader — your AI issue format is how I scan the field over coffee.

Pitch in one line: 191 companies build LLM security ($9.9B combined funding). Every one is English-only, enterprise-gated, and "trust our accuracy" black-box. SoterAI is the opposite:

- **79 languages incl. Hinglish** — India alone has 100M weekly ChatGPT users nobody protects
- **Fully reproducible benchmark** — 3,200 cases, 100% recall, 0% FP, raw JSON + Dockerfile in the repo so readers can re-run it themselves
- **India-native PII** — only tool catching Aadhaar/PAN/UPI leaks
- Open source, local-first, free tier

Happy to write it in your blurb format or answer technical questions. Benchmark + playground: soterai.in/playground

Yash

---
### H7 → Analytics India Magazine (L53) — India-angle exclusive
**Subject:** ₹250 crore DPDP fines start May 2027 — and not one of 191 AI-security vendors detects a Hinglish attack

Hi AIM editorial,

India angle your readers haven't seen: the country's 100M weekly ChatGPT users paste Aadhaar numbers, medical reports and customer data into chatbots daily — while every AI-security vendor (Lakera, Protect AI, Palo Alto included) detects attacks in English only.

We benchmarked publicly: prompt-injection recall in Hinglish + 78 other languages, India-PII detection (Aadhaar/PAN/GSTIN), raw results JSON published for anyone to audit. Open source.

I can share the full dataset and a walkthrough of how we tested 191 vendors' language coverage. Exclusive first look if useful.

Yash Chauhan, Founder — SoterAI (soterai.in)

---
### H8 → Razorpay (L43) — DPDP enterprise pitch
**Subject:** Fintech + ChatGPT + Aadhaar = your DPDP exposure (free 1-pager inside)

Hi [Eng/InfoSec leader name],

No pitch first — a gift: I made a 1-page **DPDP AI-usage policy template** specifically for Indian fintechs (what employees may/may not paste into AI tools, audit requirements). Yours free, no signup: [link].

Why it matters at Razorpay's scale: engineers, support and ops teams use ChatGPT/Claude daily. One paste of a merchant's PAN or Aadhaar into a prompt is a DPDP incident — and the May 2027 deadline carries ₹250cr maximum penalties.

I built SoterAI to close exactly this gap: a local-first layer that detects Aadhaar/PAN/GSTIN/UPI before data reaches any LLM, blocks prompt injection, and writes a compliance-grade audit trail your auditors can actually read. Open source, self-hostable, 10ms overhead.

Playground (30 seconds, no signup): soterai.in/playground

Worth 15 minutes to see whether it fits your AI-usage policy rollout?

Yash

---
### H9 → Zerodha / Kailash Nadh (L45) — OSS respect pitch
**Subject:** An OSS guard for staff AI usage — built the Zerodha way (local, self-hosted, no SaaS tax)

Hi Kailash,

Zerodha's approach — build on open source, own your stack, no rent-seeking SaaS — is why I'm writing to you first among Indian CTOs.

SoterAI is an open-source, fully local security layer for employee AI usage: catches Aadhaar/PAN/PII before they hit any LLM, blocks prompt injection for any internal bots you ship, and keeps an audit ledger your compliance team will enjoy. No cloud dependency, no per-seat pricing games — runs on your infra, audit the code yourself.

Benchmarks are public and reproducible (Dockerfile in repo — re-run everything yourself).

If anyone on your team is drafting an internal "AI usage policy," I also made a free 1-pager template — say the word and I'll send it.

Yash

---
### H10 → Sarvam AI (L35) — Indic guard layer
**Subject:** Hinglish jailbreaks bypass every guardrail — except yours if we partner

Hi Vivek / Pratyush,

Sarvam is building the Indic AI stack — so you'll appreciate this faster than anyone: a user writing "mera Aadhaar number hai 1234..." or jailbreaking in Hindi-English mix **passes through every major guardrail vendor today**. They're all English-only.

SoterAI detects attacks in 79 languages with India-native PII (Aadhaar, PAN, GSTIN, UPI) — benchmarked publicly, results reproducible from our repo.

**Proposal:** Sarvam's API ships with the best Indic guardrail layer by default — we integrate, you get the "only DPDP-ready Indic LLM" story for enterprise/Gov deals. I'll do the integration work; you review.

Can I demo a Hinglish attack being blocked against a live model? 10 minutes.

Yash

---
### H11 → Cursor (L20) — MCP security gateway
**Subject:** Cursor users paste .env files into prompts. Daily. We made the guard.

Hi Cursor team,

Every week there's a new "I pasted my API keys into Cursor" post. And as agent mode grows, so does the blast radius of what an agent can read and send.

SoterAI is built for this exact surface: an MCP security gateway + editor guard that redacts secrets/PII before they leave the workspace, gates agent tool calls (terminal, payments, emails) behind human approval, and logs everything for audit. Open source, local, 10ms.

As Cursor courts enterprises, "secure agent tooling" will be a procurement checkbox. We could be that checkbox — happy to share the threat model + demo.

Yash

---
### H12 → FlowiseAI (L3) — Security node
**Subject:** A security node for every chatflow (POC ready)

Hi Henry,

Flowise makes chaining LLMs easy — which means 100k+ chatflows run with zero guardrails. Users ask in your Discord weekly how to stop jailbreaking/PII leaks.

I built the answer as a drop-in guard node: SoterAI — injection/jailbreak blocking + PII redaction (79 languages) before any prompt node executes. Open source like Flowise, Apache-friendly, ~10ms.

I have a working POC. Want it as a PR for your review, plus a docs page "Securing your chatflow" that I'll write?

Yash

---
### H13 → OWASP GenAI Project (L60) — Credibility play
**Subject:** Contribution: multilingual + India-PII detection dataset for the LLM Top 10 mitigations list

Hi OWASP GenAI team,

Huge respect for the LLM Top 10 — it's the industry's shared vocabulary.

I've built SoterAI, an open-source guard layer, and along the way produced what I believe is the only public multilingual prompt-injection evaluation set: 79 languages, 3,200 cases, raw JSON + reproducible Dockerfile. Plus India-PII detectors (Aadhaar/PAN/GSTIN) no other OSS project ships.

Two contributions I'd like to make:
1. Donate the eval dataset + methodology to the project
2. Get listed among mitigations/tooling for LLM01 (Prompt Injection) and LLM02 (Sensitive Info Disclosure)

How should I proceed? Happy to open the GitHub issue/PR in whatever format you prefer.

Yash Chauhan

---
### H14 → Null/Nullcon (L61) — Workshop
**Subject:** Free workshop: "Jailbreak a live AI — then build one that resists" (hands-on)

Hi Null team,

Long-time follower of the community — India's best no-BS security crowd.

Proposal: a free 60-minute hands-on session for the community — attendees throw live attacks at an LLM app (injection, jailbreaks, PII exfil — including Hinglish attacks nobody's tooling catches), then we build the defense live using open-source tooling. Everyone leaves with attack patterns + a guard repo they can fork.

No product pitch — the tool is open source and the session is about the techniques. I can run it at the next Null meet or as a Nullcon village session.

Who handles talk proposals?

Yash

---
### H15 → Yellow.ai (L37) — BFSI compliance upsell
**Subject:** A DPDP-ready guard layer your BFSI clients will ask for this year

Hi [Product/AI leader],

Your BFSI clients are about to feel DPDP heat: from May 2027, every AI interaction touching customer PAN/Aadhaar needs provable safeguards and audit trails. "Our vendor checks in English only" won't survive an audit.

SoterAI is a guard layer built for exactly your client base: India-native PII detection (Aadhaar/PAN/GSTIN/UPI), prompt-injection defense across 79 languages (incl. Hinglish — how your clients' customers actually type), and a compliance-grade audit ledger. White-labelable; we handle the guard layer, you keep the client relationship.

Public, reproducible benchmarks — your security team can verify everything before a intro call.

Worth 20 minutes with whoever owns your AI platform roadmap?

Yash

---

## 📦 SEGMENT TEMPLATES — for scaling past the 15 heroes

### T1 — Automation Platforms (n8n covered above; use for Activepieces, Dify, Windmill, Pipedream, Stack AI, Bardeen, Gumloop, Relay)

**Subject:** The missing security piece/node for [Platform]'s AI workflows

Hi [Name],

[Platform] users are wiring LLMs into real business workflows — invoices, CRM updates, customer emails. That means one prompt injection or one pasted API key has real consequences. Today there's no native guardrail story on [Platform].

I built one: **SoterAI** — open-source layer that sits inside [Platform] workflows and blocks prompt injection + jailbreaks, redacts PII/secrets (incl. Aadhaar/PAN for Indian users), and gates agent actions behind human approval. ~10ms overhead, runs local, benchmarked publicly (100% recall on our 3,200-case public set, raw JSON in repo).

**What I'm offering:** I build the [piece/plugin/node] + docs + example template, you review and list it. Your users get guardrails in 2 clicks; [Platform] gets the most security-complete AI story in the category.

POC is ready. 15 minutes to show you?

Yash — soterai.in

**Follow-up (day 5):** Quick bump — the POC takes 10 minutes to evaluate: [link]. Happy to adjust to your contribution format if that's easier.

---

### T2 — LLM Gateways & Dev Tools (LiteLLM, LangChain, LlamaIndex, OpenRouter, Opik, Ollama)

**Subject:** Add a listed guardrail provider: multilingual + open benchmark (SoterAI)

Hi [Name],

[Product] already has the guardrail hooks — what's missing is a provider your users can actually verify. Most vendors are "trust our black box." SoterAI publishes its entire benchmark: 3,200 cases, raw results JSON, Dockerfile to re-run.

What users get: injection/jailbreak blocking in 79 languages, PII/secret redaction (incl. Indian identifiers nobody else detects), local-first deployment.

**Ask:** integration as a listed provider/callback in [Product]'s guardrails docs. I write the integration + docs PR; you review. Permanent high-intent traffic for both of us.

Good next step — a PR for review?

Yash

---

### T3 — AI Coding Tools & IDEs (Windsurf, Sourcegraph, Aider, Qodo — Cursor/Cline/Continue covered via listing plays)

**Subject:** Your users paste secrets into prompts. Here's the guard.

Hi [Name],

[Product]'s power users feed it entire repos — including the secrets inside them. Meanwhile agent mode can run tools with real-world effects.

SoterAI is an open-source guard for this surface: pre-send secret/PII redaction in the editor, an MCP security gateway that gates agent tool calls behind human approval, and an audit ledger for compliance conversations. Local-first, ~10ms.

I think it fits naturally alongside [Product] for enterprise/security-conscious users. Can I show you the 5-minute demo + threat model?

Yash

---

### T4 — Chatbot & AI SaaS Builders (Chatwoot, CustomGPT, SiteGPT, Crisp, Intercom)

**Subject:** "Unjailbreakable bot" — a checkbox your competitors don't have

Hi [Name],

Your customers ship bots that anyone can jailbreak with one crafted paragraph — and they blame [Platform], not the model. I made the fix droppable: SoterAI adds injection/jailbreak blocking + PII leak prevention (79 languages, incl. Hinglish for Indian customers) behind one API key. Local/self-host option for compliance-sensitive clients.

**For you:** a security add-on (or default-on guardrail) that turns support tickets about weird bot behavior into a feature story. Integration is small; I can hand you a working reference.

Want a test bot + key to try attacking? 10 minutes to an opinion.

Yash

---

### T5 — Indian AI Companies (Krutrim, Gupshup, Haptik, Verloop, CoRover, Observe.AI — Sarvam/Yellow heroes above)

**Subject:** The Indic guardrail layer for [Company]'s AI stack

Hi [Name],

Quick test your team can run today: ask your bot something malicious in Hinglish. Every major guardrail vendor will pass it — they're English-only.

SoterAI was built for India first: attack detection across 79 languages incl. Hinglish, India-native PII (Aadhaar/PAN/GSTIN/UPI), audit trails mapped to DPDP. Open source, reproducible public benchmarks — your engineers can verify every claim from the repo.

For [Company], this is the "only DPDP-ready, Indic-native AI" story for enterprise and government deals. I'll do the integration work.

10-minute demo — I'll attack a live model in Hinglish and show the block?

Yash

---

### T6 — DPDP-Pressured Enterprises (Tata 1mg, CRED, Jupiter, Practo, PW, upGrad)

**Subject:** Free DPDP AI-usage policy template (built for [industry]) — no signup

Hi [Name],

First, a gift with no strings: a 1-page DPDP-ready AI-usage policy template for [industry: fintech/health/edtech] teams — what employees may share with AI tools, what needs redaction, what needs logging. Copy it today: [link]

Context: from May 2027, DPDP penalties reach ₹250 crore. Right now at most Indian [industry] companies, anyone can paste customer PAN/Aadhaar/[health records/student data] into ChatGPT with zero friction and zero record. That gap is what I built SoterAI to close — a local, open-source layer that detects Indian PII before it reaches any LLM, blocks prompt injection, and writes audit trails your compliance team can hand to an auditor.

30-second playground, no signup: soterai.in/playground

If an internal AI-usage policy is on your 2026 roadmap, I'd genuinely enjoy a 15-minute conversation — even if you never buy anything.

Yash

**Follow-up (day 5):** One bump — the policy template alone is worth 2 minutes: [link]. If someone else owns AI governance at [Company], a forward would be hugely appreciated.

---

### T7 — Newsletters & Media (Rundown, Ben's Bites, Neuron, AI Supremacy, LWAI, Inc42, YourStory)

**Subject:** Story for [Publication]: [angle matched to publication — see below]

Hi [Name],

Reader here — [one specific recent issue you liked].

One-line pitch: SoterAI is an open-source LLM-security layer, and the story angle is **[pick one]:**
- **Tool spotlight:** free Chrome extension that stops your readers pasting PII/API keys into ChatGPT
- **Benchmark story:** every AI-security vendor says "trust us" — this one publishes raw results + Dockerfile to re-run (3,200 cases, 79 languages)
- **India story:** 191 vendors, zero detect a Hinglish attack; India has 100M weekly ChatGPT users and a ₹250cr DPDP deadline in May 2027
- **Indie story:** solo founder out-benchmarking $9.9B of funded competition, all receipts public

Assets ready: demo GIFs, benchmark JSON, founder Q&A, your preferred format.

Worth a look?

Yash

---

### T8 — Communities & Ecosystem (DSCI, SaaSBoomi, OWASP chapters, GDG, ISACA)

**Subject:** Free session for your members: "How attackers actually break AI apps — live"

Hi [Name],

I build open-source AI-security tooling (including the only prompt-injection detector that works in Hinglish). I'd like to offer your community a free, hands-on session: members attack a live LLM app, then we build the defenses together. Everyone leaves with practical attack literacy + an open-source repo to reference.

No selling — the tools are open source. I can shape it as a [webinar/meetup talk/workshop] to fit your calendar.

Who's the best person for programming?

Yash

---

### T9 — Directories & Listings (SELF-SERVE — no email; use this submission blurb)

**Name:** SoterAI — AI Security Guard
**Tagline:** Block prompt injection, jailbreaks & PII leaks before they reach any LLM.
**Description:** Open-source, local-first security layer for AI apps and ChatGPT/Claude usage. Detects attacks in 79 languages (incl. Hinglish), redacts PII/secrets incl. Aadhaar/PAN/GSTIN/UPI, gates agent actions behind human approval. Public reproducible benchmark: 100% recall, 0% false positives, 10.9ms p95 (3,200 cases, raw JSON in repo). Free tier. Try the playground in 30 seconds.
**Categories:** AI Security, Developer Tools, Privacy, LLM Guardrails
**Links:** soterai.in · soterai.in/playground · github.com/yashchauhan66/Soter-AI

---

## 🔁 GLOBAL FOLLOW-UP RULES
| # | Rule |
|---|------|
| 1 | One bump only, 4–5 days later. Third message = spam. |
| 2 | Reply to any response within 2 hours. |
| 3 | Never email unverified guessed addresses. Use forms/LinkedIn instead; verify via hunter.io/Google "{org} contact email" before sending. |
| 4 | Log every send in `08-LEADS-DATABASE.csv` status column: not_sent → drafted → sent → replied → bounced. |
| 5 | Send window: Tue–Thu 9–11am recipient timezone (for India: 10am IST). LinkedIn DMs: Sun 4–7pm IST. |
