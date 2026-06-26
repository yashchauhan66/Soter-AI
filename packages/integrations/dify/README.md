# SoterAI -- Dify Marketplace Plugin

SoterAI protects AI workflows from prompt injection, jailbreaks, PII leakage, and unsafe outputs. Add security guardrails to any Dify app with a single plugin.

## Installation

### From the Dify Marketplace (after approval)

Once the marketplace pull request is approved and merged:

1. Open Dify and navigate to **Plugins > Marketplace**.
2. Search for **SoterAI**.
3. Click **Install** and enter your SoterAI API key when prompted.

### Manual installation

1. Copy the entire `dify/` directory into your Dify plugins folder.
2. Restart Dify (or reload plugins).
3. Go to **Plugins > Installed** and configure the SoterAI provider credentials.

## Credentials

| Field | Required | Description |
|-------|----------|-------------|
| **SoterAI API Key** | Yes | Your `sk_...` API key from the SoterAI dashboard. |
| **Base URL** | No | API endpoint. Defaults to `https://api.soterai.dev`. |
| **Project ID** | No | Optional project scope for multi-tenant setups. |

## Tools

### Input Guard

Scans user input **before** it reaches the LLM.

- Detects prompt injection, jailbreak attempts, PII leakage, and other threats.
- Returns `allowed`, `riskScore`, threat `categories`, `safeText`, and `reason`.
- Parameters: `text` (required), `policy_mode` (Monitor / Balanced / Strict), `project_id`.

### Output Guard

Scans AI-generated responses **before** they are delivered to the user.

- Detects unsafe content, system prompt leakage, and PII in model output.
- Returns `allowed`, `riskScore`, threat `categories`, `safeText`, and `reason`.
- Parameters: `text` (required), `policy_mode`, `project_id`.

### PII Redactor

Redacts personally identifiable information, secrets, and sensitive data from arbitrary text.

- Returns `redactedText`, `entitiesFound`, and `riskScore`.
- Parameters: `text` (required), `redaction_mode` (Partial / Full / Hash), `project_id`.

### RAG Scanner

Scans documents and chunks for embedded threats **before** indexing into a vector database.

- Catches hidden prompt injections and data-exfiltration payloads in uploaded content.
- Returns `safe`, `riskScore`, `threats`, `reason`, and `sourceName`.
- Parameters: `text` (required), `source_name`, `project_id`.

## Example Workflows

### Before-LLM input guard

```
User Message --> [SoterAI Input Guard] --> LLM --> Response
```

Add the **Input Guard** tool as the first node in your Dify chatflow. If `allowed` is `false`, branch to a rejection message instead of forwarding to the LLM.

### After-LLM output guard

```
User Message --> LLM --> [SoterAI Output Guard] --> Response
```

Insert the **Output Guard** tool after the LLM node. If the response is flagged, replace it with a safe fallback or re-generate.

### Before-RAG-indexing scanner

```
Uploaded Document --> [SoterAI RAG Scanner] --> Vector DB
```

Before writing document chunks to your knowledge base, run them through the **RAG Scanner**. Discard or quarantine any chunk where `safe` is `false`.

### PII-safe pipelines

```
User Message --> [SoterAI PII Redactor] --> LLM --> Response
```

Strip PII from user messages before they enter the LLM context, ensuring no sensitive data is stored in logs or model memory.

## Privacy and Security

- All scanning is performed server-side by the SoterAI API. No user data is stored beyond the request lifecycle unless you opt in to audit logging.
- The plugin uses only Python standard-library HTTP (`urllib.request`) with no third-party dependencies.
- API keys are stored securely by Dify's credential manager and never exposed in workflow logs.
- Privacy Policy: https://soterai.dev/privacy
- Terms of Service: https://soterai.dev/terms
- Support: support@soterai.dev

## Plugin Structure

```
dify/
  manifest.yaml              # Plugin metadata and credentials
  icon.svg                   # Plugin icon
  provider/
    soterai.py               # Provider credential validation
  tools/
    input_guard.yaml         # Input Guard tool definition
    input_guard.py           # Input Guard implementation
    output_guard.yaml        # Output Guard tool definition
    output_guard.py          # Output Guard implementation
    pii_redactor.yaml        # PII Redactor tool definition
    pii_redactor.py          # PII Redactor implementation
    rag_scanner.yaml         # RAG Scanner tool definition
    rag_scanner.py           # RAG Scanner implementation
```

## Marketplace Submission

**Status: Ready for Dify tooling validation and marketplace PR preparation.**

See `MARKETPLACE_CHECKLIST.md` for the full submission checklist.
