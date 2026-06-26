# SoterAI — Long Description

> For marketplace detail pages, app store listings, and landing pages.

---

## What is SoterAI?

SoterAI is an AI security platform that protects chatbots, agents, RAG applications, and workflow automations from the most common AI threats — without requiring any changes to your existing AI models or prompts.

## What does SoterAI protect against?

### AI Input Guard
Scans every user message before it reaches your LLM. Detects prompt injection attempts, jailbreak attacks, social engineering, and other adversarial inputs. Blocks or flags threats before they can manipulate your AI.

### AI Output Guard
Inspects every AI-generated response before it reaches your users. Catches unsafe content, system prompt leakage, hallucinated instructions, and policy violations. Ensures your AI never says something it shouldn't.

### PII Redactor
Automatically detects and redacts personally identifiable information — email addresses, phone numbers, credit card numbers, API keys, passwords, and other secrets. Choose partial masking, full replacement, or deterministic hashing.

### RAG Document Scanner
Scans documents and chunks before they enter your vector database. Catches embedded prompt injections, data poisoning attempts, and malicious content hidden in knowledge base uploads.

### Incident Logger
Every threat detection is logged to the SoterAI dashboard with full audit trail. View risk scores, threat categories, timeline, and response actions. Export to SIEM tools for compliance.

## How it works

1. **Connect** — Add your SoterAI API key to the integration
2. **Place** — Insert SoterAI nodes before and after your AI steps
3. **Configure** — Choose policy mode (Monitor / Balanced / Strict) and threat response (Block / Redact / Warn / Continue)
4. **Deploy** — Your workflows are now protected. Monitor threats on the SoterAI dashboard.

## Key features

- **Zero-config protection** — Works out of the box with sensible defaults
- **No model changes** — Sits between your users and your AI, not inside it
- **Server-side analysis** — All detection runs on SoterAI's policy engine; no local model or data processing
- **Flexible responses** — Block, redact, warn, or continue on threat detection
- **Full audit trail** — Every check logged with risk score, categories, and timeline
- **Multi-platform** — Works with n8n, Zapier, Make.com, Dify, Botpress, Flowise, Langflow, Voiceflow, and any REST-capable tool

## Who is SoterAI for?

- **AI builders** automating with chatbots, agents, and RAG apps
- **Workflow designers** using no-code/low-code platforms
- **Security teams** adding guardrails to AI deployments
- **Compliance officers** ensuring AI outputs meet policy requirements
- **Developers** integrating AI safety via REST API or SDK

## Supported platforms

| Platform | Type | Status |
|----------|------|--------|
| n8n | Community node (npm) | Ready for submission |
| Dify | Marketplace plugin | Ready for submission |
| Zapier | Public app | Ready for review |
| Make.com | Custom app | Ready for review |
| Botpress | Hub integration | Ready for submission |
| Flowise | Custom nodes | Installable |
| Langflow | Custom components | Installable |
| Voiceflow | API/Function templates | Templates available |
| REST API | Direct integration | Available |
| JavaScript SDK | npm package | Available |
| Python SDK | pip package | Available |
