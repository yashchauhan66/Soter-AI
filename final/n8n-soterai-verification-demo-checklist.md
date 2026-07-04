# SoterAI n8n Verification Checklist

## Package Checks

- [x] Package name starts with `n8n-nodes-`: `n8n-nodes-soterai`
- [x] `package.json` includes `n8n-community-node-package` keyword
- [x] `package.json` includes n8n node and credential entries
- [x] README exists and documents installation, authentication, actions, outputs, privacy, and support
- [x] TypeScript source exists under `nodes/` and `credentials/`
- [x] Error handling exists with `NodeOperationError`, response status handling, and `continueOnFail` support
- [x] `npm run lint` passed
- [x] `npm run build` passed
- [x] `npx @n8n/scan-community-package n8n-nodes-soterai` provenance check passed

## Node Scope Shown

- [x] SoterAI node display name
- [x] Credential type: SoterAI API
- [x] Actions: SoterAI Input Guard, SoterAI Output Guard, SoterAI PII Redactor, SoterAI RAG Scanner
- [x] Parameters: input text, output text, PII text, RAG text, document ID, document source, project ID, on-threat behavior, metadata JSON
- [x] Structured outputs: allowed, blocked, riskScore, categories, safeText, outputText, reason, incidentId, rawResponse

## Video Safety

- [x] No real API key is shown
- [x] Credential value area is intentionally blurred
- [x] No `.env`, npm token, GitHub token, browser profile details, personal account secrets, or private URLs are shown
- [x] English narration and English captions only

## Production Notes

- The MP4 is rendered at 1920x1080, 30fps, with Microsoft Edge neural TTS narration (en-US-JennyNeural).
- The video includes local n8n screenshots captured via Playwright browser automation.
- The workflow JSON is importable, but credential IDs are intentionally omitted so no secret references are exported.
- edge-tts (en-US-JennyNeural) used for natural voiceover instead of basic Windows SAPI.
- Improved frame composition with gradient backgrounds, proper browser window frames, and color-coded result panels.