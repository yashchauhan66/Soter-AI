# Ideal Customer Profile

## Positioning Statement

CyberRakshak Guard is for teams operating customer-facing chatbots, RAG applications, or AI agents that need an observable policy and security layer around model traffic. It provides OWASP LLM Top 10 aligned, defense-in-depth risk reduction without claiming complete protection.

## Primary ICP: B2B SaaS With Live Customer-Facing AI

### Firmographics

- India-first or global SaaS company with 10-250 employees.
- AI feature is in production or entering production within 60 days.
- 10,000-5,000,000 AI messages per month.
- Small engineering or security team that cannot build a full AI security gateway internally.
- Handles customer support, account, financial, health, education, or business data.

### Buyer and Champions

- Economic buyer: founder, CTO, VP Engineering, or Head of Security.
- Technical champion: AI engineer, platform engineer, application security engineer, or engineering lead.
- Operational stakeholder: support, compliance, data protection, or customer success lead.

### Trigger Events

- First enterprise customer security questionnaire.
- Prompt injection or sensitive-data incident.
- Launch of RAG over private documents.
- Expansion from internal AI to customer-facing AI.
- Need for audit evidence, signed alerts, or security reporting.
- Concern about India-specific personal-data exposure.

### Required Pain

The prospect should have at least two:

- No inspection between users, the model, and application output.
- Inconsistent redaction of PII or secrets.
- No searchable evidence of blocked or risky interactions.
- Security controls tied to one model provider.
- Manual review that does not scale.
- Enterprise deals blocked by AI security questions.

## Secondary ICP: Digital Agencies Managing AI Clients

### Fit

- Builds or operates at least three client chatbots or RAG applications.
- Wants a recurring managed security or reporting offer.
- Needs tenant separation, white-label reporting, reusable integration, and client alerts.
- Has an owner for first-line client support.

### Buyer

Agency founder, technical director, solutions architect, or managed-services lead.

### Success Outcome

The agency deploys CyberRakshak Guard to two clients within 60 days and packages monitoring/reporting into a recurring service.

## Enterprise Pilot ICP

### Fit

- 250+ employees or a regulated/high-risk workflow.
- Named security, platform, and business owners.
- Clear production candidate and authorized pilot scope.
- Requires SSO, SCIM, SIEM, self-hosting, retention, or audit evidence.
- Can agree on measurable success criteria and complete a 4-6 week pilot.

### Disqualifiers

- Wants a certification or guarantee of complete protection.
- Wants offensive testing against systems it does not own or control.
- Has no production use case, integration owner, or timeline.
- Requires raw customer data to be copied into demos or support channels.
- Is only collecting generic AI ideas with no budget or decision process.

## Vertical Priority

1. B2B SaaS customer support and knowledge assistants.
2. Agencies delivering chatbots and AI automation.
3. Fintech and business operations assistants.
4. Health, clinic, education, and coaching platforms with sensitive data.
5. D2C support and commerce assistants.

## Qualification Scorecard

Score each item 0-2. Prioritize accounts scoring 12 or more out of 16.

| Criterion | 0 | 1 | 2 |
| --- | --- | --- | --- |
| Production timing | No plan | 3-6 months | Live or under 60 days |
| Message volume | Unknown/tiny | Under 10k/month | 10k+/month |
| Data sensitivity | Public only | Mixed | Personal, confidential, or regulated |
| Security pain | None | General concern | Incident, deal blocker, or mandate |
| Technical owner | None | Shared | Named integration owner |
| Buyer access | None | Indirect | Direct buyer conversation |
| Budget | None | Exploring | Budget or paid-pilot intent |
| Decision timing | Unknown | Quarter | Under 60 days |

## Discovery Questions

1. Which AI workflows are live, and who can access them?
2. What data can enter prompts, retrieval, tools, and outputs?
3. What happens today when a prompt contains secrets or personal data?
4. How are prompt injection, unsafe output, and retrieval risks reviewed?
5. Which security questionnaire or customer requirement is hardest to answer?
6. What would a successful 30-day evaluation prove?
7. Who owns integration, security approval, and commercial approval?
8. What would make the team choose not to proceed?

## Message by ICP

- **SaaS:** ship customer-facing AI with reviewable controls and less custom security plumbing.
- **Agency:** create a repeatable managed AI security offer across client workspaces.
- **Enterprise:** validate an approved AI workflow with measurable controls, evidence, and operational integration.
