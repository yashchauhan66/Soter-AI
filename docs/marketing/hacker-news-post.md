# Hacker News Post Draft — SoterAI

---

## 📋 Post Title Options

**Option 1 (BEST — Technical/Data Hook):**
> **Show HN: SoterAI – Open-source AI security guard, F1=1.0000 against 97 attack variants**

**Option 2 (Problem-Focused):**
> **Show HN: SoterAI – Open-source firewall for LLM apps (detects prompt injection, PII leaks)**

**Option 3 (Benchmark Hook):**
> **Show HN: I built an AI security layer that detects 97/97 adversarial attacks with 0% false positives**

---

## 📝 HN Post Body

> *This is the text that goes in the "text" field when submitting to HN.*

**SoterAI** is an open-source AI security command layer that protects chatbots, RAG apps, and autonomous agents from prompt injection, jailbreaks, data leakage, and agent abuse.

I built this because I saw a pattern: teams building AI-powered features were deploying them to production without any security layer between users and LLMs. The existing solutions were either basic content filters (that miss novel attacks), expensive per-call APIs, or DIY — meaning every team had to build 30+ detectors from scratch.

### The Benchmark

I ran a Garak-style adversarial evaluation against **97 attack variants** across **8 categories**:

| Category | Detected |
|---|---|
| Prompt Injection | 30/30 ✅ |
| Jailbreak / DAN | 11/11 ✅ |
| Encoding / Obfuscation | 12/12 ✅ |
| Multilingual (Hindi/Hinglish) | 7/7 ✅ |
| PII (incl. India: Aadhaar, PAN) | 12/12 ✅ |
| Secrets / Credentials | 19/19 ✅ |
| Unsafe Output | 7/7 ✅ |
| Indirect Injection | 6/6 ✅ |

**Results:** F1 = 1.0000, Precision = 1.0000, Recall = 1.0000, 0% false positives (25/25 safe inputs allowed), <50ms at SDK level.

### What makes it different?

- **Protection-first, not just observability** — Most tools show you what happened. SoterAI blocks attacks in real-time before they cause damage.
- **32 security services across 6 layers** — Monitor, Protect, Detect, Control, Compliance, Manage
- **India-first PII detection** — Built-in detection for Aadhaar-like patterns, PAN, GSTIN, UPI ID, IFSC codes — purpose-built for DPDP Act compliance
- **Self-hostable** — Docker, PostgreSQL, Redis, optional Qdrant — deploy on your own infra
- **Open source (MIT)** — No black boxes, no per-call pricing surprises
- **Multiple SDKs** — TypeScript, Python, LangChain, LlamaIndex, REST API

### Quick Start

```bash
npm install @soterai/core
```

```typescript
import { Soter } from "@soterai/core";
const soter = new Soter({ apiKey: process.env.SOTERAI_API_KEY });

// Guard input before LLM call
const result = await soter.guardInput({ message: userMsg, userId: "u1", sessionId: "s1" });
if (soter.shouldBlock(result)) return { reply: "Blocked." };

const safeInput = soter.getSafeText(result, userMsg) ?? userMsg;
const llmResponse = await callMyLLM(safeInput);

// Guard output before returning to user
const outputResult = await soter.guardOutput({ aiResponse: llmResponse, sessionId: "s1" });
return { reply: soter.getSafeText(outputResult, llmResponse) ?? llmResponse };
```

### Links

- **GitHub:** https://github.com/yashchauhan66/Ai-Security-Guard
- **Live Demo:** https://soterai.publicvm.com
- **Interactive Playground:** https://soterai.publicvm.com/playground
- **Full Benchmark Results:** https://github.com/yashchauhan66/Ai-Security-Guard/blob/main/scripts/guard-benchmark/results.json
- **Docs:** https://soterai.publicvm.com/docs

### What I'd love feedback on

1. **Detection accuracy** — Are there attack types I'm missing? What should I test next?
2. **Latency** — Currently <50ms SDK-level. Has anyone seen higher latency in production?
3. **Use cases** — Are you running an AI app that needs this? What security gaps are you most worried about?
4. **Self-hosting** — If you've deployed, any issues with Docker/Postgres setup?

---

## 💬 Maker's First Comment (Post as first comment)

> *On HN, the maker usually posts a follow-up comment adding context.*

Hey HN! Maker here.

I started SoterAI after talking to several teams who were shipping AI chatbots and agents to production with literally zero guardrails between users and LLMs. The "just trust the model" approach wasn't working — people were getting prompt-injected, leaking PII, and having their agents hijacked.

The benchmark (97/97 attacks detected, F1=1.0000) is from a Garak-style evaluation I ran against 8 categories. The full JSON results are in the repo if you want to inspect individual test cases and decisions.

**Some things I'm still working on:**
- Better support for non-English attacks (especially Indian languages)
- More granular policy controls per-use-case
- A hosted cloud version for teams that don't want to self-host

Would love to hear your thoughts, especially if you've dealt with AI security issues in production. What attacks are you most worried about? What would make you trust (or not trust) a tool like this?

Thanks for checking it out! 🙏

---

## 🧠 Commentary Strategy (For HN Comments Section)

- **Be humble and open** — HN community punishes hype. Acknowledge limitations.
- **Answer every question** — Spend the first few hours responding to every comment.
- **Don't ask for upvotes** — Against HN rules. Ask for feedback instead.
- **Share technical details** — If someone asks about the detection engine, share architecture details.
- **Be transparent about the "India-first" angle** — Some may ask why India-specific PII. Explain that the project was built with Indian data protection (DPDP Act) in mind, and that it handles global PII too.

---

## ⏰ Best Posting Time

| Day | Time (US Eastern) | Why |
|---|---|---|
| **Tuesday** | 8-9 AM ET | Maximum visibility, full day on front page |
| **Wednesday** | 8-9 AM ET | Second best |
| **Thursday** | 8-9 AM ET | Good, but competes with "Who's hiring?" posts |

**Indian time equivalent:** Tuesday 5:30-6:30 PM IST

---

## 📊 Expected Outcomes

| Metric | Estimate |
|---|---|
| Front page time | 4-8 hours (if good engagement) |
| Upvotes | 100-300 (typical for quality Show HN) |
| Comments | 20-60 |
| GitHub stars bump | +50 to +200 |
| Website traffic | 2,000-10,000 visits |
| Signups | 20-100 |
