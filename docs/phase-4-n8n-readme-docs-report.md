# Phase 4 n8n README And Docs Report

## README Updated

Path: `packages/integrations/n8n/README.md`

## Included

- What the SoterAI n8n node does.
- Supported operations.
- GUI and npm installation steps.
- Credential setup.
- Quickstart workflow.
- Example prompts and fake secret.
- Example output shape.
- Output fields.
- Error handling guidance.
- Privacy and security notes.
- Version compatibility.
- Known limitations.
- Links to:
  - `https://soterai.in`
  - `https://soterai.in/privacy`
  - `https://soterai.in/support`
  - `contact@soterai.in`

## Claims Review

The README does not claim 100% security, SOC2 compliance, zero false positives, or that all attacks are blocked.

Allowed claim used:

`SoterAI helps detect prompt injection, jailbreaks, secrets, PII, and unsafe AI instructions inside n8n workflows.`

## Verification

- `npm test`: README/package metadata checks pass indirectly through package validator.
- `npm pack --dry-run`: README included in package tarball.
