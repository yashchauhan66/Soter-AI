# SoterAI for Flowise

Flowise custom nodes that add AI security guardrails to your chatbot flows. Protect against prompt injection, jailbreaks, PII leakage, and unsafe AI outputs.

## Nodes

| Node | Purpose |
|------|---------|
| **SoterAI Input Guard** | Check user input for prompt injection, jailbreaks, and threats before LLM processing |
| **SoterAI Output Guard** | Check AI responses for unsafe content, system prompt leakage, and PII before sending to users |
| **SoterAI PII Redactor** | Redact PII, secrets, and sensitive data from any text |
| **SoterAI RAG Scanner** | Scan documents for threats before adding to RAG/vector databases |

## Installation

### Option 1: npm install

```bash
cd your-flowise-project
npm install flowise-nodes-soterai
```

### Option 2: Copy to custom nodes directory

Copy the contents of `dist/` to your Flowise custom nodes directory (typically `~/.flowise/custom-nodes/flowise-nodes-soterai/`), then restart Flowise. The SoterAI nodes will appear in the **Security** category.

## Configuration

All nodes require a **SoterAI API Key** (`sk_...`) from your SoterAI dashboard.

### SoterAI Input Guard

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| API Key | password | - | Your SoterAI API key |
| Base URL | string | `https://api.cybersecurityguard.com` | SoterAI API endpoint |
| Project ID | string | - | Optional project identifier |
| Policy Mode | MONITOR / BALANCED / STRICT | BALANCED | Server-side policy strictness |
| On Threat | BLOCK / REDACT / WARN / CONTINUE | BLOCK | Action when a threat is detected |

### SoterAI Output Guard

Same configuration as Input Guard. Place after your LLM node to scan AI responses.

### SoterAI PII Redactor

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| API Key | password | - | Your SoterAI API key |
| Base URL | string | `https://api.cybersecurityguard.com` | SoterAI API endpoint |
| Project ID | string | - | Optional project identifier |
| Redaction Mode | PARTIAL / FULL / HASH | PARTIAL | How detected PII is redacted |

### SoterAI RAG Scanner

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| API Key | password | - | Your SoterAI API key |
| Base URL | string | `https://api.cybersecurityguard.com` | SoterAI API endpoint |
| Project ID | string | - | Optional project identifier |
| Source Name | string | - | Optional label for the document source |
| Policy Mode | MONITOR / BALANCED / STRICT | BALANCED | Server-side policy strictness |

## Example Flows

### Basic input/output protection

```
[Chat Input] --> [SoterAI Input Guard] --> [ChatOpenAI] --> [SoterAI Output Guard] --> [Chat Output]
```

The Input Guard checks user messages for prompt injection and jailbreaks.
The Output Guard checks AI responses for unsafe content and PII leakage.

### PII redaction pipeline

```
[Chat Input] --> [SoterAI PII Redactor] --> [ChatOpenAI] --> [SoterAI Output Guard] --> [Chat Output]
```

Strips PII from user input before sending to the LLM, then checks the AI response on the way out.

### Secure RAG ingestion

```
[Document Loader] --> [SoterAI RAG Scanner] --> [Vector Store]
```

Scans documents for embedded threats, PII, or policy violations before they enter your vector database.

## Privacy and Security

- All security analysis is performed server-side by the SoterAI API. No detection logic runs locally.
- API keys are stored securely in the Flowise credential system (password-type input).
- No user data is stored by the nodes themselves; data handling is governed by the SoterAI API privacy policy.
- The nodes use HTTPS for all API communication.

## Support

- Documentation: [https://docs.soterai.dev](https://docs.soterai.dev)
- Email: support@soterai.dev
