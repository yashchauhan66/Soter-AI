# Final Creator Portal Submission Pack

## Package

- Package name: `n8n-nodes-soterai`
- Package version: `0.2.8`
- npm link: `https://www.npmjs.com/package/n8n-nodes-soterai` (publish/update required for `0.2.8`)
- GitHub repo: `https://github.com/yashchauhan66/Soter-AI/tree/main/packages/integrations/n8n`
- README path: `packages/integrations/n8n/README.md`
- License: MIT

## Short Description

SoterAI helps protect n8n AI workflows by detecting prompt injection, jailbreaks, secrets, PII, and unsafe AI instructions.

## Long Description

SoterAI adds AI security guardrails to n8n workflows. It can analyze user prompts, guard inputs before they reach AI tools, inspect AI outputs, and flag or redact sensitive content such as fake secrets and PII. It is designed for teams building safer AI automations and agent workflows.

## Operations

- Analyze Text
- Guard Input
- Guard Output
- Redact Secrets or PII
- Get RAG Risk Summary

## Credential Description

The SoterAI API credential stores a masked API key, Base URL, and optional default Project ID. The credential test calls `/api/guard/input` with a safe connection-test message.

## Example Workflows

- `soterai-basic-analyze.workflow.json`
- `soterai-guard-input-webhook.workflow.json`
- `soterai-guard-output.workflow.json`
- `soterai-secret-pii-redaction.workflow.json`
- `soterai-error-handling.workflow.json`

## Video

- Script path: `docs/n8n/final-n8n-video-submission-pack.md`
- Video link: VIDEO RECORDING REQUIRED

## URLs

- Privacy URL: `https://soterai.in/privacy`
- Support URL: `https://soterai.in/support`
- Support email: `contact@soterai.in`

## Testing Notes

Use safe fake test data only. No real secrets or personal data are required.

Local validation completed:

- n8n package lint: PASS.
- n8n package build: PASS.
- n8n package test: PASS.
- n8n package dry-run pack: PASS.
- n8n tarball inspection: PASS.
- node and credential class load: PASS.

## Known Limitations

- Live n8n workflow proof is not complete in this environment.
- Demo video is not recorded.
- `0.2.8` npm publish/update has not been performed.
- External `npm audit` requires explicit approval because it sends dependency metadata to npm.

## Final Checklist

- [x] Package name
- [x] Package version
- [x] README
- [x] License
- [x] Operations list
- [x] Credential description
- [x] Example workflows
- [x] Privacy URL
- [x] Support URL
- [x] Support email
- [ ] npm version published
- [ ] Live n8n workflow proof
- [ ] Video link
