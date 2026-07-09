# SoterAI — User Onboarding Checklist

Track your progress from sign-up to production-ready.

## Account Setup

- [ ] Sign up at `/signup`
- [ ] Verify email via OTP
- [ ] Log in to dashboard
- [ ] Complete organization profile

## Project Configuration

- [ ] Create first project
- [ ] Generate API key
- [ ] Store API key securely (env variable, secret manager)
- [ ] Test API key with a guard call

## First Guard Call

- [ ] Send a benign input — confirm `ALLOW`
- [ ] Send a prompt injection — confirm `BLOCK` or `REWRITE`
- [ ] Review risk score and reasons in the response
- [ ] Check logs at `/dashboard/logs`

## Policy Configuration

- [ ] Review default guard policy
- [ ] Adjust risk thresholds if needed
- [ ] Enable/disable specific detector categories
- [ ] Set up custom block/rewrite messages

## Webhooks & Integrations

- [ ] Configure webhook endpoint for real-time alerts
- [ ] Test webhook delivery
- [ ] (Optional) Integrate with Slack, PagerDuty, or custom channel

## Monitoring & Reports

- [ ] Review dashboard analytics
- [ ] Check guard call volume and latency
- [ ] Review blocked/rewritten call trends
- [ ] Set up report schedule (daily/weekly)

## Production Readiness

- [ ] Switch from mock to live email provider
- [ ] Enable production Redis (or confirm in-memory is acceptable)
- [ ] Set `NODE_ENV=production`
- [ ] Configure CORS for your domain
- [ ] Set rate limits appropriate for your traffic
- [ ] Review security checklist in `docs/security-hardening.md`

## Ongoing

- [ ] Monitor guard accuracy (false positive/negative rates)
- [ ] Review and update policies monthly
- [ ] Keep dependencies updated
- [ ] Review audit logs regularly
