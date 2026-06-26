# SoterAI Zapier -- Publishing Checklist

## Prerequisites

- [ ] Node.js 18+ installed
- [ ] Zapier CLI installed (`npm i -g zapier-platform-cli`)
- [ ] Zapier developer account created at https://developer.zapier.com

## Build and Validate

```bash
npm install
npm run build
npm run validate
```

## Register and Push

```bash
zapier login
zapier register "SoterAI"
zapier push
```

## Promote to Public

```bash
zapier promote <version>
zapier migrate <old_version> <new_version> --percent 100
```

## Required Assets for Zapier Review

| Asset | Spec | Status |
|-------|------|--------|
| App Icon | 256x256 PNG, transparent background | [ ] |
| App Category | Security | [ ] |
| Privacy Policy URL | https://soterai.dev/privacy | [ ] |
| Terms of Service URL | https://soterai.dev/terms | [ ] |
| Support Email | support@soterai.dev | [ ] |
| Demo Video | 2-5 min walkthrough of a working Zap | [ ] |
| App Description | Submitted in Zapier partner dashboard | [ ] |

## Zapier Partner Program

1. Submit app via https://developer.zapier.com
2. Zapier reviews the integration (typical turnaround: 2-4 weeks)
3. Address any review feedback
4. Once approved, the app appears in the Zapier marketplace

## Review Timeline

| Step | Estimated Time |
|------|---------------|
| Initial submission | Day 0 |
| Automated checks | 1-2 days |
| Manual review | 1-3 weeks |
| Feedback round (if needed) | +1-2 weeks |
| Public listing | After approval |

## Post-Launch

- [ ] Monitor error rates in Zapier dashboard
- [ ] Set up Zapier webhook for usage alerts
- [ ] Update app listing with user testimonials
- [ ] Publish Zap templates for common use cases
