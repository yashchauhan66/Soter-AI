# SoterAI — Privacy Summary

> For marketplace privacy disclosures, app review submissions, and trust pages.

---

## Data handling

### What data does SoterAI process?

SoterAI processes the text content you send to its API endpoints for security analysis. This includes:

- User messages (via Input Guard)
- AI-generated responses (via Output Guard)
- Text for PII redaction (via PII Redactor)
- Document content (via RAG Scanner)

### What data does SoterAI store?

- **Threat logs**: When a threat is detected, a summary record (risk score, categories, timestamp, action taken) is stored for audit and dashboard display. The raw text content is NOT stored in logs.
- **API keys**: Your API key is stored securely and used only for request authentication.
- **Project metadata**: Project names, IDs, and configuration settings you create.

### What data does SoterAI NOT store?

- Raw user messages or AI responses (processed in-memory only)
- PII or secrets detected during redaction
- Credentials for third-party services
- Cookies or tracking data from end users

### Data residency

SoterAI's API processes requests on infrastructure hosted by the deployment operator. For self-hosted deployments, all data stays within the operator's infrastructure.

### Data retention

- Threat logs: retained according to the project's configured retention policy (default: 90 days)
- API keys: retained until revoked by the account owner
- Account data: retained until account deletion

### Third-party sharing

SoterAI does not sell, share, or transfer user data to third parties. No data is used for model training or advertising.

## Authentication

- API key authentication (x-api-key header)
- Keys are generated per-project and can be rotated at any time
- Keys are transmitted over HTTPS only

## Platform-specific data flows

When used via platform integrations (n8n, Zapier, Make, etc.):

1. The platform node sends text to the SoterAI API over HTTPS
2. SoterAI analyzes the text server-side
3. SoterAI returns a structured result (allowed/blocked, risk score, safe text)
4. The platform node uses the result to control workflow logic
5. No data is cached or stored by the integration node itself

## Contact

Privacy questions: privacy@soterai.dev
Security issues: security@soterai.dev
General support: support@soterai.dev
