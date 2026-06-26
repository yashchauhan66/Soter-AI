# SoterAI — Demo Video Script

> 2-3 minute demo video for marketplace listings and landing pages.

---

## Scene 1: The Problem (15 seconds)

**Narration**: "AI chatbots and agents are powerful — but they're vulnerable. Prompt injection, jailbreaks, PII leakage, and unsafe outputs can turn your AI into a liability."

**Visual**: Show examples of prompt injection attacks and PII leakage in a generic chatbot.

---

## Scene 2: Introducing SoterAI (10 seconds)

**Narration**: "SoterAI adds security guardrails to your AI workflows — no code changes, no model retraining. Just drag, drop, and protect."

**Visual**: SoterAI logo and tagline. Quick montage of platform logos (n8n, Zapier, Make, Dify, Botpress).

---

## Scene 3: Setup (20 seconds)

**Narration**: "Setup takes 30 seconds. Install the SoterAI node from your platform's marketplace. Add your API key. Done."

**Visual**: 
1. Search "SoterAI" in n8n community nodes
2. Click install
3. Paste API key into credential dialog

---

## Scene 4: Input Guard Demo (30 seconds)

**Narration**: "Place the SoterAI Input Guard before your AI step. It scans every user message for prompt injection, jailbreaks, and other threats."

**Visual**:
1. Build a simple workflow: Webhook → SoterAI Input Guard → OpenAI
2. Send a normal message — it passes through (allowed: true, riskScore: 0.05)
3. Send a prompt injection — it gets blocked (allowed: false, riskScore: 0.95, categories: ["PROMPT_INJECTION"])

---

## Scene 5: Output Guard Demo (20 seconds)

**Narration**: "Add an Output Guard after your AI step. It catches unsafe responses before they reach your users."

**Visual**:
1. Extend workflow: OpenAI → SoterAI Output Guard → Response
2. Show an output being checked and allowed
3. Show an unsafe output being caught and blocked

---

## Scene 6: PII Redactor Demo (20 seconds)

**Narration**: "The PII Redactor automatically masks sensitive data — emails, phone numbers, API keys — before they enter your AI pipeline."

**Visual**:
1. Input: "My email is john@example.com and SSN is 123-45-6789"
2. Output: "My email is [EMAIL_REDACTED] and SSN is [SSN_REDACTED]"

---

## Scene 7: Dashboard (15 seconds)

**Narration**: "Every threat is logged to the SoterAI dashboard. Track risk scores, threat categories, and response actions over time."

**Visual**: SoterAI dashboard showing threat analytics, incident timeline, risk distribution chart.

---

## Scene 8: Call to Action (10 seconds)

**Narration**: "Protect your AI workflows today. Search 'SoterAI' in your platform's marketplace, or visit soterai.dev to get started."

**Visual**: Platform logos, SoterAI URL, "Get Started Free" button.

---

## Production notes

- **Length**: 2-3 minutes
- **Style**: Screen recording with voiceover, clean UI, no background music during narration
- **Resolution**: 1920x1080 minimum
- **Platforms that require video**: Zapier (recommended for review), Make.com (recommended)
- **Platforms where video is optional**: n8n, Dify, Botpress
