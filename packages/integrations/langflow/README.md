# SoterAI for Langflow

Langflow custom components that add AI security guardrails to your flows. Protect against prompt injection, jailbreaks, PII leakage, and unsafe AI outputs.

## Components

| Component | Purpose |
|-----------|---------|
| **SoterAI Input Guard** | Check user input for prompt injection, jailbreaks, PII, and threats before LLM processing |
| **SoterAI Output Guard** | Check AI responses for unsafe content, system prompt leakage, and PII before sending to users |
| **SoterAI PII Redactor** | Redact PII, secrets, and sensitive data from text |
| **SoterAI RAG Scanner** | Scan documents for threats before adding to RAG/vector databases |

## Installation

Copy `soter_guard_component.py` to your Langflow custom components directory:

```bash
# Default Langflow custom components location
cp soter_guard_component.py ~/.langflow/custom_components/
```

Restart Langflow. The SoterAI components will appear in the sidebar.

### pip install (for packaging)

```bash
pip install langflow-components-soterai
```

## No External Dependencies

The component uses only Python standard library (`urllib`, `json`) -- no pip packages needed beyond Langflow itself.

## Configuration

All components require a **SoterAI API Key** (`sk_...`) from your SoterAI dashboard.

### SoterAI Input Guard

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| api_key | password | - | Your SoterAI API key |
| base_url | string | `https://api.cybersecurityguard.com` | SoterAI API endpoint |
| project_id | string | - | Optional project identifier |
| policy_mode | MONITOR / BALANCED / STRICT | BALANCED | Server-side policy strictness |
| on_threat | BLOCK / REDACT / WARN / CONTINUE | BLOCK | Action when a threat is detected |

### SoterAI Output Guard

Same configuration as Input Guard. Place after your LLM node to scan AI responses.

### SoterAI PII Redactor

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| api_key | password | - | Your SoterAI API key |
| base_url | string | `https://api.cybersecurityguard.com` | SoterAI API endpoint |
| project_id | string | - | Optional project identifier |
| redaction_mode | PARTIAL / FULL / HASH | PARTIAL | How detected PII is redacted |

### SoterAI RAG Scanner

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| api_key | password | - | Your SoterAI API key |
| base_url | string | `https://api.cybersecurityguard.com` | SoterAI API endpoint |
| project_id | string | - | Optional project identifier |
| source_name | string | - | Optional label for the document source |
| policy_mode | MONITOR / BALANCED / STRICT | BALANCED | Server-side policy strictness |

## Example Flows

### Basic input/output protection

```
[Chat Input] --> [SoterAI Input Guard] --> [OpenAI] --> [SoterAI Output Guard] --> [Chat Output]
```

The Input Guard checks user messages for prompt injection and jailbreaks.
The Output Guard checks AI responses for unsafe content and PII leakage.

### PII redaction pipeline

```
[Chat Input] --> [SoterAI PII Redactor] --> [OpenAI] --> [SoterAI Output Guard] --> [Chat Output]
```

Strips PII from user input before sending to the LLM, then checks the AI response on the way out.

### Secure RAG ingestion

```
[Document Loader] --> [SoterAI RAG Scanner] --> [Vector Store]
```

Scans documents for embedded threats, PII, or policy violations before they enter your vector database.

## Privacy and Security

- All security analysis is performed server-side by the SoterAI API. No detection logic runs locally.
- API keys are passed as password-type inputs and are not logged or stored by the components.
- No user data is stored by the components themselves; data handling is governed by the SoterAI API privacy policy.
- All API communication uses HTTPS.

## Support

- Documentation: [https://docs.soterai.dev](https://docs.soterai.dev)
- Email: support@soterai.dev
