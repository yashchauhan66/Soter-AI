# SoterAI Botpress Integration -- Publishing Checklist

Use this checklist before submitting the integration to the Botpress Hub.

## Prerequisites

- [ ] Integration icon prepared (SVG or PNG, 256x256 recommended, transparent background)
- [ ] `package.json` name, version, and description finalized
- [ ] `integration.title` and `integration.description` reviewed for marketplace display
- [ ] All four actions tested end-to-end: Check Input, Check Output, Redact PII, Scan RAG Document
- [ ] Configuration schema validated -- API key marked as `x-secret`, defaults correct
- [ ] `policyMode` enum values match backend: MONITOR, BALANCED, STRICT
- [ ] Error messages are user-friendly (no stack traces leaked)
- [ ] README.md is complete and accurate

## Build

- [ ] Run `npm install`
- [ ] Run `npm run build` -- ensure zero TypeScript errors
- [ ] Verify `dist/index.js` is generated and non-empty
- [ ] Smoke-test the built output by importing in a local Botpress instance

## Deploy to Botpress Hub

- [ ] Authenticate with Botpress CLI: `npx botpress login`
- [ ] Deploy: `npx botpress deploy`
- [ ] Confirm the integration appears in the Hub staging environment
- [ ] Verify the icon, title, and description render correctly on the Hub page

## Review Process

- [ ] Botpress team reviews the submission (typically 1-3 business days)
- [ ] Address any feedback from the Botpress review team
- [ ] Confirm the integration is published and visible in the public Hub

## Post-Publish Verification

- [ ] Install the integration from the Hub into a fresh Botpress bot
- [ ] Configure with a valid SoterAI API key
- [ ] Test Check Input with a benign message -- expect `allowed: true`
- [ ] Test Check Input with a prompt injection -- expect `blocked: true`
- [ ] Test Check Output with a safe AI response -- expect `allowed: true`
- [ ] Test Redact PII with a message containing an email address -- expect redacted output
- [ ] Test Scan RAG Document with clean and poisoned documents
- [ ] Verify error handling when API key is invalid (should show clear error, not crash)
- [ ] Confirm `User-Agent: soterai-botpress/1.0` appears in SoterAI dashboard logs

## Version Bumping

When publishing updates:

1. Bump `version` in `package.json`
2. Update `integration.version` in `src/index.ts` to match
3. Update changelog / release notes
4. Re-run the full checklist above
