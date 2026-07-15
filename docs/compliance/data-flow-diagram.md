# Data Flow Diagram

```text
User / developer
  -> Browser, VS Code, n8n, SDK, or REST API
  -> SoterAI API Guard
  -> Detection and policy engine
  -> Redacted security metadata and ProductEvent records
  -> Dashboard, audit exports, webhooks, SIEM
  -> External AI system only after customer application permits it
```

## Privacy Notes

- Pilot telemetry stores metadata only.
- Raw prompt, secret, token, credential, input, output, message, and content fields are stripped by `lib/pilot/events.ts`.
- Customer applications remain responsible for which external AI systems receive approved content.
