# SoterAI for Voiceflow

Voiceflow does not have a traditional integration marketplace. Instead, SoterAI provides **copy-paste templates** that you can add directly into your Voiceflow projects to secure your AI agent conversations.

These templates let you add real-time input scanning, output filtering, PII redaction, and RAG content scanning to any Voiceflow chatbot or voice agent.

## Two Approaches

### API Step Templates (`api-template/`)

Use Voiceflow's built-in **API Step** block to call SoterAI endpoints directly. No code required -- just configure the URL, headers, body, and response mapping.

**Pros:**
- No JavaScript knowledge needed
- Visual configuration in the Voiceflow editor
- Easy to inspect and debug in the flow

**Cons:**
- More blocks in your flow (one API Step per guard)
- Less flexibility for custom logic

### Function Step Templates (`function-template/`)

Use Voiceflow's **Function** step to run JavaScript that calls SoterAI. Copy the provided `.js` files into a Function block.

**Pros:**
- More compact -- one Function block handles the full request/response cycle
- Can add custom pre/post-processing logic
- Easier to chain multiple guards

**Cons:**
- Requires basic JavaScript familiarity
- Slightly harder to debug visually

## Quick Start

1. **Get your API key** from https://app.cybersecurityguard.com/dashboard
2. **Choose your approach** -- API Steps or Function Steps (or mix both).
3. **Copy the templates** into your Voiceflow project:
   - For API Steps: configure an API Step block with the URL, headers, body, and response mapping from `api-template/README.md`.
   - For Function Steps: paste the `.js` file contents into a Voiceflow Function step from `function-template/`.
4. **Wire up conditions** to handle blocked or flagged content in your flow.

## Available Guards

| Guard          | Description                                              | API Step | Function Step |
|----------------|----------------------------------------------------------|----------|---------------|
| Input Guard    | Scans user messages for prompt injection, jailbreaks, toxicity | Yes      | Yes           |
| Output Guard   | Filters LLM responses for data leaks, harmful content   | Yes      | Yes           |
| PII Redactor   | Detects and redacts personal information (emails, SSNs, etc.) | Yes      | Yes           |
| RAG Scanner    | Scans retrieved knowledge base content before LLM context | Yes      | --            |

## Installation

Copy the templates into your Voiceflow project. No packages to install, no marketplace to browse -- just paste and configure.

## Directory Structure

```
voiceflow/
  README.md                  ← You are here
  api-template/
    README.md                ← API Step configuration templates
  function-template/
    README.md                ← Function Step usage guide
    soterai-input-guard.js   ← Input Guard function
    soterai-output-guard.js  ← Output Guard function
    soterai-pii-redactor.js  ← PII Redactor function
```

## Security Notes

- Store your API key in Voiceflow's secure variable storage -- never hardcode it in visible flow blocks.
- Use `BALANCED` policy mode for general chatbots; switch to `STRICT` for high-security use cases.
- Monitor the SoterAI dashboard at https://app.cybersecurityguard.com for real-time threat analytics.
