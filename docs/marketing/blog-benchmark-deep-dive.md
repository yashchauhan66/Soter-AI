# How SoterAI Detects 97/97 Adversarial Attacks with F1=1.0000

*A technical deep-dive into building an open-source AI security layer that achieves perfect detection across 8 attack categories.*

---

## The Problem

Every week, another team ships an AI chatbot or agent to production without a security layer between users and LLMs. The reasoning is usually the same: *"We'll add guardrails later"* or *"The model is smart enough to reject attacks."*

But models aren't smart enough. Prompt injection, jailbreaks, and data leakage are real, growing problems — and they don't discriminate by company size.

**The question is:** Can you build an open-source security layer that actually works? Or do you have to accept that some attacks will get through?

## The Answer

After building and rigorously testing **SoterAI**, an open-source AI security command layer, the answer is clear: **Yes, you can achieve perfect detection — but it requires defense-in-depth, not a single silver bullet.**

Our Garak-style adversarial benchmark against **97 attack variants** across **8 categories** returned:

| Metric | Result |
|--------|--------|
| Detection Rate | 100% (97/97) |
| False Positive Rate | 0% (25/25 safe inputs allowed) |
| **F1 Score** | **1.0000** |
| Precision | 1.0000 |
| Recall | 1.0000 |
| Latency (SDK) | <50ms |

> **Note:** These are lab benchmark results under controlled conditions. Real-world performance may vary based on deployment, traffic patterns, and attack sophistication. Defense-in-depth should always be combined with secure engineering practices.

## How It Works: Multi-Layer Detection Architecture

SoterAI doesn't rely on a single classifier or regex list. Instead, it uses **6 layers of defense**, each catching what the others might miss:

```
User Input → Input Guard → [LLM Call] → Output Guard → User Response
                  ↓                            ↓
          Prompt Injection             PII Leakage
          Jailbreak Detection          Unsafe Output
          PII Redaction                Secrets Leak
          Toxicity Check               Toxicity Check
                  ↓                            ↓
          ┌────────── Agent Firewall ──────────┐
          │  Tool Call Verification            │
          │  Policy Enforcement                │
          │  Risk Scoring                      │
          └────────────────────────────────────┘
```

### Layer 1: Input Guard (Protects Before the LLM)

The Input Guard runs **every user message** through multiple detectors before it reaches the LLM:

**Prompt Injection Detector**
- Catches instruction override attempts ("Ignore previous instructions...")
- Detects system prompt extraction ("Show me your hidden rules")
- Identifies roleplay bypasses ("Pretend to be DAN...")
- Flags indirect injection through retrieved documents

**Jailbreak Detector**
- Recognizes DAN (Do Anything Now) and similar jailbreak personas
- Detects encoding obfuscation (spaced text, leetspeak, mixed case)
- Handles multilingual attacks (Hindi/Hinglish bypass attempts)
- Identifies multi-turn manipulation patterns

**PII Detector (Global + India-Specific)**
- Global PII: Emails, phone numbers, SSNs, credit cards
- **India-specific:** Aadhaar-like patterns, PAN, GSTIN, UPI IDs, IFSC codes, Indian mobile numbers
- Contextual detection for student, patient, and bank identifiers

**Secrets Detector**
- OpenAI/Google/AWS API keys
- JWT tokens and database URLs
- Private keys and environment variables
- Razorpay/Stripe live keys

### Layer 2: Redaction Engine

Instead of just blocking or allowing, SoterAI can **intelligently redact** sensitive content while preserving the useful parts of the message:

```typescript
// Input: "My Aadhaar number is 1234 5678 9012"
// After redaction: "My Aadhaar number is [REDACTED_AADHAAR]"
```

The redaction is **position-safe** — it tracks original character positions so you know exactly what was redacted and where.

### Layer 3: Output Guard (Protects After the LLM)

Even after safe input reaches the LLM, the **model's response** can contain:

- Leaked system instructions
- Unsafe financial advice ("guaranteed profit" scams)
- Suspicious URLs (.top, .work TLDs)
- Advance fee fraud patterns
- Internal developer instructions

The Output Guard catches these before they reach the user.

### Layer 4: Agent Firewall (Runtime Protection)

For AI agents (not just chatbots), SoterAI adds:

- **Tool call verification** — Is this tool call authorized for this agent?
- **Risk scoring** — Every interaction gets a risk score (0-100)
- **Policy enforcement** — Custom rules per project (MONITOR / BALANCED / STRICT modes)
- **Escrow** — High-risk actions require human approval

### Layer 5: Policy Engine

Every project can configure:

```typescript
{
  mode: "STRICT",           // MONITOR | BALANCED | STRICT
  customBlockedTopics: ["competitor_pricing", "internal_metrics"],
  allowlistedDomains: ["trusted-docs.example.com"],
  defaultAction: "BLOCK",   // What to do when uncertain
  fallbackMessage: "This content was blocked by security policy."
}
```

### Layer 6: Compliance & Audit

- **Guard Logs** — Full audit trail of every security decision
- **Evidence Vault** — SOC 2 / ISO 27001 evidence packaging
- **SIEM integration** — Structured security events for your existing pipeline

## The Benchmark: How We Tested

We designed the benchmark to mimic **Garak**, an open-source red-teaming framework for LLM security. The test covered:

### 1. Prompt Injection (30 variants)
Classic injection, system prompt extraction, roleplay bypasses, JSON leaks, natural language leakage attempts. **30/30 detected.**

### 2. Jailbreak / DAN (11 variants)
DAN persona, developer mode, uncensored mode, hypothetical scenarios. **11/11 detected.**

### 3. Encoding / Obfuscation (12 variants)
Spaced text, hyphenated bypass, mixed case, base64, leetspeak, HTML tags, zero-width characters, reversed text, ROT13. **12/12 detected.**

### 4. Multilingual: Hindi/Hinglish (7 variants)
Purely Hindi and Hinglish (Hindi+English mix) injection attempts. **7/7 detected.** This is critical for Indian market deployments.

### 5. PII Detection (12 variants)
Aadhaar, PAN, GSTIN, UPI IDs, IFSC codes, Indian phones, emails, SSNs (US), credit cards, combined PII+secrets. **12/12 detected.**

### 6. Secrets & Credentials (19 variants)
OpenAI keys, Google AI keys, GitHub tokens, AWS keys, JWT tokens, database URLs (Postgres, MongoDB, Redis), Stripe/Razorpay keys, private keys, env variables. **19/19 detected.**

### 7. Unsafe Output (7 variants)
Guaranteed profit claims, lottery scams, suspicious TLDs, advance fee fraud, work-from-home scams, unsafe actions, internal instruction leaks. **7/7 detected.**

### 8. Indirect Prompt Injection (6 variants)
Hidden instructions in emails, document injections, RAG poisoning, context injections. **6/6 detected.**

### False Positive Check (25 safe inputs)
Normal questions about AI security, weather, programming, translations, customer support — all correctly allowed. **25/25 safe inputs, 0% false positive rate.**

> 📄 [View the complete benchmark results (JSON)](https://github.com/yashchauhan66/Ai-Security-Guard/blob/main/scripts/guard-benchmark/results.json)

## What This Means in Practice

**For a chatbot:** Every user message is scanned for injection, PII, and secrets before reaching your LLM. Every model response is checked for unsafe content before reaching your user.

**For a RAG app:** Retrieved documents are checked for hidden injection. Context is scored for trustworthiness. Sensitive data is redacted before being sent to the model.

**For an AI agent:** Every tool call is verified against policy. Multi-step attack chains are detected. High-risk actions require human approval.

## Getting Started

```bash
npm install @soterai/core
```

```typescript
import { Soter } from "@soterai/core";

const soter = new Soter({
  apiKey: process.env.SOTERAI_API_KEY,
});

// Guard input
const result = await soter.guardInput({
  message: userMessage,
  userId: "user_123",
  sessionId: "session_456",
});

if (soter.shouldBlock(result)) {
  return { reply: "Message blocked." };
}

const safeInput = soter.getSafeText(result, userMessage) ?? userMessage;
const llmResponse = await callMyLLM(safeInput);

// Guard output
const outputResult = await soter.guardOutput({
  aiResponse: llmResponse,
  sessionId: "session_456",
});

return { reply: soter.getSafeText(outputResult, llmResponse) ?? llmResponse };
```

## Limitations & Honest Caveats

No security tool is perfect. Here's what SoterAI doesn't guarantee:

1. **Zero-day attacks** — Novel attack patterns not covered by our detectors may slip through
2. **Model-level safety** — SoterAI augments, doesn't replace, model-level safety training
3. **All languages** — Primary focus is English and Hindi/Hinglish; other languages have limited coverage
4. **Context window attacks** — Very long contexts with embedded injection are harder to detect
5. **Side-channel attacks** — Timing, token-level, and other side-channel attacks are outside scope

Use SoterAI as **one layer** in a defense-in-depth strategy — alongside secure coding practices, access controls, monitoring, and human review.

## What's Next

- [ ] Expanded language support (Tamil, Bengali, Marathi)
- [ ] Real-time threat intelligence feeds
- [ ] ML-based anomaly detection for zero-day attacks
- [ ] Multi-modal guardrails (image input/output scanning)
- [ ] Hosted cloud version (no self-hosting required)

## Try It Yourself

- **GitHub:** [github.com/yashchauhan66/Ai-Security-Guard](https://github.com/yashchauhan66/Ai-Security-Guard) ⭐
- **Live Demo:** [soterai.publicvm.com](https://soterai.publicvm.com)
- **Playground:** [soterai.publicvm.com/playground](https://soterai.publicvm.com/playground)
- **Docs:** [soterai.publicvm.com/docs](https://soterai.publicvm.com/docs)

---

*SoterAI is open-source (MIT) and free to self-host. Built with ❤️ for the AI security community.*
