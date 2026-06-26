# Soter Guard — Make.com Integration

Make.com (formerly Integromat) app module for Soter Guard.

## Modules

| Module | Purpose |
|--------|---------|
| **Check Input for Threats** | Scan user input before LLM |
| **Check AI Output for Threats** | Scan AI responses |
| **Redact PII from Text** | Redact PII and secrets |

## Setup

1. In Make.com, go to **My Apps > Create a new app**
2. Import `app.json` as the app definition
3. Import `modules/actions.json` as the module definitions
4. Configure your Soter API key connection

## Files

```
make/
  app.json              # App metadata and connection config
  modules/
    actions.json        # Input Guard, Output Guard, PII Redactor actions
```
