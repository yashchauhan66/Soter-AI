# SoterAI Make.com -- Publishing Checklist

## Prerequisites

- [ ] Make.com developer account at https://www.make.com/en/partner
- [ ] SoterAI API key for testing
- [ ] App icon (512x512 PNG recommended)

## Custom App Setup

1. Log in to Make.com
2. Navigate to **My Apps > Create a new app**
3. Import `app.json` as the app definition
4. Import `modules/actions.json` as the module definitions
5. Test the connection with a valid SoterAI API key

## Testing

- [ ] Connection: Verify API key auth works
- [ ] Input Guard: Send a clean message, verify `allowed: true`
- [ ] Input Guard: Send a prompt injection, verify `allowed: false`
- [ ] Output Guard: Send safe AI output, verify `allowed: true`
- [ ] PII Redactor: Send text with email/phone, verify redaction
- [ ] RAG Scanner: Send a clean document, verify scan results
- [ ] Create Incident: Log an incident, verify response

## Required Assets for Make Review

| Asset | Spec | Status |
|-------|------|--------|
| App Icon | 512x512 PNG | [ ] |
| App Description | Clear, concise (submitted in partner dashboard) | [ ] |
| Privacy Policy URL | https://soterai.dev/privacy | [ ] |
| Terms of Service URL | https://soterai.dev/terms | [ ] |
| Support Email | support@soterai.dev | [ ] |
| Documentation URL | Link to integration docs | [ ] |

## Make Partner Program

1. Apply at https://www.make.com/en/partner
2. Submit app for review via the partner dashboard
3. Make team reviews the integration (typical turnaround: 2-4 weeks)
4. Address any review feedback
5. Once approved, the app appears in the Make marketplace

## Review Process Notes

- Make reviews both the app definition and module configurations
- All modules must return predictable output schemas
- Error handling should be clear (Make shows module errors in the scenario log)
- Connection labels should be descriptive enough to distinguish multiple accounts

## Post-Launch

- [ ] Monitor error rates in Make partner dashboard
- [ ] Publish scenario templates for common use cases
- [ ] Update app listing with user reviews
- [ ] Keep module definitions in sync with SoterAI API changes
