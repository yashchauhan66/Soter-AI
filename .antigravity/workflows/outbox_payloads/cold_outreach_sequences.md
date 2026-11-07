# Soter-AI High-Conversion Outbound Sequences
*Owner: `16-sales-strategist-sdr` | Brand Sign-off: `11-brand-marketing` | UTM: `utm_source=outbound_email&utm_medium=cold_email&utm_campaign=sprint01_sdr`*

---

## Sequence 1: AI Startup Founders & CTOs
**ICP:** Founders, CTOs, VP Engineering building AI workflow agents, coding assistants, or enterprise chatbots.  
**Value Angle:** Eliminating 300ms cloud guardrail latency and protecting autonomous tool calls from prompt injection.

### Touch 1 (Day 1 - The Value Bomb):
**Subject:** quick question on {{companyName}}'s agent latency & prompt injection

Hi {{firstName}},

Noticed {{companyName}} is shipping autonomous tool-calling features on top of Claude/GPT-4.

Most teams we speak with run into an architectural bottleneck: cloud guardrail APIs (like Lakera or Bedrock) add 250ms–350ms to every single turn. For multi-step agents doing 10+ tool calls, that’s 3+ seconds of pure security lag.

Even worse, standard cloud filters miss local execution risks—like an injected prompt tricking an agent into running `iwr | iex` or `Remove-Item -Recurse -Force` on a developer's machine.

We built **Soter-AI**: a local-first guardrail engine running directly in your Node/Python process. It neutralizes prompt injections, masks secrets, and intercepts destructive terminal commands in **<5ms on CPU** with **zero data exfiltration**.

Would it be helpful if I sent over our 45-second latency benchmark video comparing local vs cloud guardrails?

Best,  
Yash Chauhan  
Founder, Soter-AI  
https://soterai.in

---

### Touch 2 (Day 3 - Social Proof & Video):
**Subject:** Re: quick question on {{companyName}}'s agent latency

Hi {{firstName}},

Following up with the 45-second benchmark video I mentioned:

🎥 **Watch:** How Soter-AI catches token-smuggled prompt injections & PowerShell wipers in 0.4ms:  
🔗 https://soterai.in/comparison/prompt-armor?utm_source=outbound_email&utm_medium=cold_email&utm_campaign=sprint01_sdr

You can also run our CLI scanner against {{companyName}}'s prompt templates locally:  
`npx soterai scan`

Open to a brief 10-minute technical exchange next Tuesday?

Best,  
Yash

---

### Touch 3 (Day 7 - The Objection Crushing Case Study):
**Subject:** How AI agents meet SOC2 & ISO without cloud data leakage

Hi {{firstName}},

When enterprise buyers audit AI startups, their first objection is always:  
*"Do our prompts or proprietary RAG data get sent to third-party security vendors?"*

With Soter-AI, the answer is an unambiguous **No**.
- Evaluates 100% locally in your VPC.
- Emits HMAC-signed JSONL audit logs formatted for Splunk, Datadog, or DynamoDB.
- Full support for global PII + India specific data (Aadhaar, PAN, GSTIN).

Are you free for 10 minutes this Thursday at 2 PM to see how we drop in with 3 lines of code?

Best,  
Yash

---

### Touch 4 (Day 12 - Polite Break-up):
**Subject:** closing the loop on {{companyName}}

Hi {{firstName}},

Assuming guardrail latency and local agent security aren’t top priorities for {{companyName}} right now.

I'll stop following up so I don't clutter your inbox. If you ever need to inspect agent tool calls in <5ms or achieve zero-data-egress compliance, you can always bookmark our documentation:

🔗 https://soterai.in/docs?utm_source=outbound_email&utm_medium=cold_email&utm_campaign=sprint01_sdr

Wishing you and the {{companyName}} team continued growth!

Best,  
Yash

