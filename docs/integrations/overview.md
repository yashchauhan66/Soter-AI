# Soter Guard Integrations

Use Soter Guard as a drag-and-drop security layer in AI workflow platforms.

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    Your AI Workflow Platform                      │
│                                                                   │
│  [User Input] → [Soter Input Guard] → [LLM] → [Soter Output Guard] → [Reply]  │
│                        │                              │           │
│                        ▼                              ▼           │
│                  ┌──────────┐                  ┌──────────┐       │
│                  │ Soter API │◄────────────────│ Soter API │       │
│                  │  Server   │                  │  Server   │       │
│                  └──────────┘                  └──────────┘       │
│                        │                              │           │
│                        ▼                              ▼           │
│                  ┌──────────────────────────────────────┐        │
│                  │   Soter Dashboard — Monitoring & Logs │        │
│                  └──────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

## Supported Platforms

| Platform | Type | Status |
|----------|------|--------|
| **n8n** | Locally installable custom node (4 actions) | Locally usable |
| **Flowise** | Custom tool node package | Developer-ready skeleton |
| **Langflow** | Python custom component (stdlib only) | Developer-ready component |
| **Dify** | Plugin manifest + YAML tool definitions | Developer-ready skeleton |
| **Zapier** | Integration skeleton (auth + actions) | Skeleton — needs Zapier CLI publish |
| **Make.com** | Custom app + module definitions | Skeleton — needs Make app import |
| **Botpress** | Integration skeleton (actions) | Developer-ready skeleton |
| **Voiceflow** | API step templates (documentation) | Template only |

> **Note**: None of these integrations are published on any platform's marketplace.
> They are locally installable / developer-ready packages. Marketplace publishing
> requires platform-specific credentials and review processes documented in each README.

## Actions Available

Every platform supports these core actions:

### 1. Input Guard
Check user messages **before** they reach the LLM.
- Detects: prompt injection, jailbreaks, system prompt leak attempts
- Returns: `allowed`, `riskScore`, `categories`, `safeText`, `reason`

### 2. Output Guard
Check AI responses **before** they are sent to the user.
- Detects: unsafe content, system prompt leakage, PII in responses
- Returns: `allowed`, `riskScore`, `categories`, `safeText`, `reason`

### 3. PII Redactor
Redact sensitive data from any text.
- Detects: emails, phone numbers, credit cards, API keys, secrets
- Modes: PARTIAL (mask), FULL (replace with tokens), HASH (deterministic)
- Returns: `safeText`, `detectedEntities`, `riskScore`

### 4. RAG Scanner
Scan documents/chunks before adding to vector databases.
- Detects: embedded prompt injection, malicious instructions, PII
- Returns: `allowed`, `riskScore`, `issues`, `safeText`

## Configuration

Every integration requires:
- **Soter API Key** — get from [Soter Dashboard](https://app.cybersecurityguard.com)
- **Base URL** — `https://api.cybersecurityguard.com` (or self-hosted URL)
- **Project ID** — optional, for multi-project setups

## Policy Modes

| Mode | Behavior |
|------|----------|
| MONITOR | Log threats but allow all traffic through |
| BALANCED | Block high-risk, redact medium-risk, allow low-risk |
| STRICT | Block anything above low risk |

## On Threat Actions

| Action | Behavior |
|--------|----------|
| BLOCK | Stop the workflow / return empty |
| REDACT | Continue with redacted safe text |
| WARN | Continue with original text + warning flag |
| CONTINUE | Ignore the threat, pass through unchanged |

## Security Best Practices

1. **Never expose API keys** in client-side code or workflow outputs
2. **Use BALANCED mode** for most use cases; STRICT for high-security
3. **Always guard both input AND output** — one without the other leaves gaps
4. **Monitor the Soter dashboard** for threat patterns and analytics
5. **Use project IDs** to separate environments (dev/staging/prod)
6. **Set up webhooks** for real-time threat alerts

## How SDK + API + Nodes Work Together

```
┌──────────────────────────────────────────────────┐
│                   Soter Guard                      │
├──────────────────────────────────────────────────┤
│  Web Dashboard  │  REST API  │  JS SDK  │  Py SDK │
│                 │            │          │          │
│  ──── All share the same backend engine ────      │
│                                                    │
│  + Drag-and-drop Integration Nodes                │
│    (n8n, Flowise, Langflow, Dify, Zapier,         │
│     Make, Botpress, Voiceflow)                    │
│                                                    │
│    Nodes call the REST API — no duplicate logic   │
└──────────────────────────────────────────────────┘
```

The integration nodes are **thin HTTP connectors** that call the same
REST API used by the JS/Python SDKs. All security analysis, policy
enforcement, PII detection, and audit logging happen server-side.
