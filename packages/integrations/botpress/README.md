# SoterAI for Botpress

Protect your Botpress chatbots from prompt injection, jailbreaks, PII leakage, and unsafe AI outputs. SoterAI integrates directly into Botpress Studio as a set of drag-and-drop actions that call the SoterAI Guard API in real time.

## Actions

| Action | Purpose | Endpoint |
|---|---|---|
| **Check Input** | Scan user messages for prompt injection, jailbreaks, PII, and threats | `POST /api/guard/input` |
| **Check Output** | Scan AI responses for unsafe or policy-violating content before delivery | `POST /api/guard/output` |
| **Redact PII** | Strip personally identifiable information and secrets from text | `POST /api/guard/input` |
| **Scan RAG Document** | Validate documents for hidden threats before ingestion into vector DBs | `POST /api/guard/input` |

### Check Input

Inspects a user message before your bot processes it.

**Input:**
- `text` (string, required) -- the user message
- `onThreat` (string, optional) -- action when a threat is detected: `BLOCK` (default), `REDACT`, `WARN`, or `CONTINUE`

**Output:**
- `allowed` (boolean) -- whether the message passed all checks
- `blocked` (boolean) -- whether the message was blocked
- `riskScore` (number) -- 0-100 risk score
- `safeText` (string) -- sanitized message text
- `reason` (string) -- human-readable explanation
- `categories` (string[]) -- detected threat categories

### Check Output

Inspects an AI-generated response before it reaches the user.

**Input:**
- `text` (string, required) -- the AI output
- `onThreat` (string, optional) -- `BLOCK` (default), `REDACT`, `WARN`, or `CONTINUE`

**Output:**
- `allowed` (boolean)
- `blocked` (boolean)
- `riskScore` (number)
- `safeText` (string)
- `reason` (string)

### Redact PII

Removes personally identifiable information (emails, phone numbers, SSNs, API keys, etc.) from text.

**Input:**
- `text` (string, required) -- text to redact
- `redactionMode` (string, optional) -- `PARTIAL` (default), `FULL`, or `HASH`

**Output:**
- `safeText` (string) -- redacted text
- `detectedEntities` (string[]) -- list of entity types found (e.g., `["EMAIL", "SSN"]`)
- `riskScore` (number) -- 0-100

### Scan RAG Document

Validates documents before they are embedded into a vector database, catching injected prompts, poisoned content, or policy violations.

**Input:**
- `text` (string, required) -- document content
- `sourceName` (string, optional) -- label for the document source

**Output:**
- `allowed` (boolean) -- whether the document is safe to ingest
- `riskScore` (number) -- 0-100
- `issues` (string[]) -- list of detected issues
- `safeText` (string) -- sanitized document text

## Configuration

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `apiKey` | string (secret) | Yes | -- | Your SoterAI API key (`sk_...`) |
| `baseUrl` | string | No | `https://api.cybersecurityguard.com` | SoterAI API base URL |
| `projectId` | string | No | -- | Project identifier for multi-project setups |
| `policyMode` | enum | No | `BALANCED` | `MONITOR`, `BALANCED`, or `STRICT` |

## Example Bot Workflow

```
                          +-------------------+
                          |   User Message    |
                          +--------+----------+
                                   |
                          +--------v----------+
                          | SoterAI Check     |
                          | Input             |
                          +--------+----------+
                                   |
                     +-------------+-------------+
                     |                           |
              blocked = true              blocked = false
                     |                           |
          +----------v----------+     +----------v----------+
          | Reply: "Sorry,      |     | AI Task / Knowledge |
          | request blocked."   |     | Base Lookup         |
          +---------------------+     +----------+----------+
                                                 |
                                      +----------v----------+
                                      | SoterAI Check       |
                                      | Output              |
                                      +----------+----------+
                                                 |
                                    +------------+------------+
                                    |                         |
                             blocked = true            blocked = false
                                    |                         |
                         +----------v----------+   +----------v----------+
                         | Reply: "Response     |   | Send safe response  |
                         | withheld."           |   | to user             |
                         +---------------------+   +---------------------+
```

For RAG-powered bots, add a **Scan RAG Document** step before indexing:

```
[Upload / Crawl] --> [SoterAI Scan RAG Document]
    --> if allowed  --> [Embed into Vector DB]
    --> if blocked  --> [Quarantine + alert admin]
```

## Installation

### From Botpress Hub (recommended)

1. Open Botpress Studio
2. Navigate to **Integrations** in the left sidebar
3. Search for **SoterAI**
4. Click **Install** and enter your API key

### Manual / Self-hosted

1. Clone this repository
2. Run `npm install && npm run build`
3. In Botpress Studio, go to **Integrations > Add Integration**
4. Upload the built bundle or point to the package
5. Configure your SoterAI API key in the integration settings

## Privacy and Security

- All API calls use HTTPS with TLS 1.2+
- API keys are stored as Botpress secrets and never exposed to the browser
- Message content is sent to SoterAI for scanning only; no data is retained beyond the request lifecycle unless you enable audit logging in your SoterAI dashboard
- SoterAI is SOC 2 Type II compliant

## Status

Ready for Botpress Hub submission.
