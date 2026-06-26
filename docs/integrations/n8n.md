# Soter Guard — n8n Integration Guide

## Overview

The Soter Guard n8n node lets you add AI security to any n8n workflow with drag-and-drop. Check user inputs for prompt injection, scan AI outputs for unsafe content, redact PII, and scan RAG documents.

## Quick Start

1. Install: `npm install @soter/n8n-nodes-soter-guard` in your n8n directory
2. Add credentials: paste your Soter API key
3. Drag a **Soter Guard** node into your workflow
4. Select an action: Input Guard, Output Guard, PII Redactor, or RAG Scanner
5. Connect and run

## Protected Chatbot Pattern

```
[Webhook Trigger]
    → [Soter Guard: Input Guard (BALANCED, On Threat: BLOCK)]
    → [IF: {{$json.blocked}} == true]
        ├─ True → [Respond: "Blocked for security"]
        └─ False → [OpenAI: Chat with {{$json.safeText}}]
                  → [Soter Guard: Output Guard (BALANCED, On Threat: REDACT)]
                  → [Respond: {{$json.safeText}}]
```

See [n8n README](../../packages/integrations/n8n/README.md) for full details.
