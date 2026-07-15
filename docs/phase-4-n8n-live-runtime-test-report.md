# Phase 4 n8n Live Runtime Test Report

## Status

N8N RUNTIME EVIDENCE REQUIRED.

## Environment Check

- `http://localhost:5678`: unavailable.
- Docker: daemon unavailable / not running.
- `n8n` CLI: not found in PATH.

## Commands

```powershell
Invoke-WebRequest -Uri http://localhost:5678 -UseBasicParsing -TimeoutSec 5
docker ps --format "{{.Names}} {{.Image}} {{.Ports}}"
Get-Command n8n -ErrorAction SilentlyContinue
```

## Result

Live n8n runtime testing could not be executed in this environment.

## Tests Still Required In n8n

1. Open n8n.
2. Install or link `n8n-nodes-soterai@0.2.8`.
3. Confirm SoterAI appears in node search.
4. Open credentials form.
5. Save credentials using a limited test token.
6. Run credential test.
7. Import and run `soterai-basic-analyze.workflow.json`.
8. Import and run `soterai-guard-input-webhook.workflow.json`.
9. Import and run `soterai-guard-output.workflow.json`.
10. Import and run `soterai-secret-pii-redaction.workflow.json`.
11. Import and run `soterai-error-handling.workflow.json`.
12. Test invalid credential behavior.
13. Test large payload behavior.
14. Test rate-limit/error handling with a controlled staging API or mock.
15. Export final proven workflow JSON.

## Submission Impact

- Node appears in n8n: UNKNOWN.
- Credentials save/test in n8n: UNKNOWN.
- Live workflow proof: NO.
- Creator Portal ready: NO until live workflow proof and video are complete.
