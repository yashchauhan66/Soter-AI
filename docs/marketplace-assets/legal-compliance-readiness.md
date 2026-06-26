# SoterAI — Legal & Compliance Readiness

> Checklist and draft URLs for marketplace submissions requiring legal documentation.

---

## Required URLs for marketplace submissions

| Document | Status | URL (draft) |
|----------|--------|-------------|
| Privacy Policy | DRAFT NEEDED | soterai.dev/privacy |
| Terms of Service | DRAFT NEEDED | soterai.dev/terms |
| Security Page | EXISTS (docs/compliance/) | soterai.dev/security |
| API Documentation | EXISTS (docs/integrations/) | docs.soterai.dev/api |
| Pricing Page | DRAFT NEEDED | soterai.dev/pricing |
| Support/Contact | DRAFT NEEDED | soterai.dev/support |
| Status Page | DRAFT NEEDED | status.soterai.dev |

## Compliance certifications

**Do NOT claim any of the following unless verified and certified:**

- [ ] SOC 2 Type II — NOT CLAIMED
- [ ] ISO 27001 — NOT CLAIMED
- [ ] HIPAA — NOT CLAIMED
- [ ] GDPR compliant — NOT CLAIMED (but privacy-by-design principles are followed)
- [ ] DPDP (India) — readiness assessment exists (docs/compliance/dpdp-readiness.md)

**What CAN be claimed:**

- OWASP LLM Top 10 coverage (documented in docs/compliance/owasp-llm-top10-coverage.md)
- Data retention controls (documented in docs/compliance/data-retention.md)
- Encryption at rest and in transit (documented in docs/compliance/encryption.md)
- Access control with API key authentication (documented in docs/compliance/access-control.md)
- Incident response procedures (documented in docs/compliance/incident-response.md)
- Responsible disclosure policy (documented in docs/compliance/responsible-disclosure.md)

## Data handling summary for marketplace reviewers

1. **Data processed**: Text content sent via API for security analysis
2. **Data stored**: Threat detection summaries (risk score, categories, timestamps). Raw text is NOT stored.
3. **Data shared**: Never. No third-party data sharing.
4. **Data retention**: Configurable, default 90 days for threat logs
5. **Data deletion**: Available on request and via API
6. **Encryption**: TLS 1.2+ in transit, AES-256 at rest for stored records

## Rate limits

| Tier | Limit | Window |
|------|-------|--------|
| Free | 100 requests | Per month |
| Pro | 10,000 requests | Per month |
| Enterprise | Custom | Custom |

## Contact information for marketplace submissions

- **Support email**: support@soterai.dev
- **Security email**: security@soterai.dev
- **Privacy email**: privacy@soterai.dev
- **Company name**: SoterAI
- **Website**: soterai.dev

## Action items before first marketplace submission

1. [ ] Publish Privacy Policy at soterai.dev/privacy
2. [ ] Publish Terms of Service at soterai.dev/terms
3. [ ] Create pricing page at soterai.dev/pricing
4. [ ] Set up support contact form at soterai.dev/support
5. [ ] Set up status page at status.soterai.dev
6. [ ] Create 256x256 PNG app icon with transparent background
7. [ ] Record demo video (see demo-video-script.md)
8. [ ] Take all screenshots (see screenshots-checklist.md)
