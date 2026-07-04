# n8n SoterAI Real Video QA Report

- Live n8n URL shown: http://localhost:5678
- Docker preflight: n8n container running on port 5678 after Docker Desktop start.
- Community node installed in n8n: n8n-nodes-soterai 0.2.6 in the running container; package source is 0.2.7.
- Workflow execution: successful n8n manual execution ID 17 for workflow soteraiRealDemo01.
- Credential safety: no real API key is shown. A separate local demo credential is used for repeatable execution against a local SoterAI-compatible endpoint.
- Secrets: no real API keys, npm tokens, GitHub tokens, .env values, or private credentials are displayed.
- Package checks: npm run lint PASS; npm run build PASS; npx @n8n/scan-community-package n8n-nodes-soterai PASS.
- Limitation: the originally existing SoterAI credential returned a non-JSON response, so the final execution uses a separate local demo credential for deterministic verification footage.
