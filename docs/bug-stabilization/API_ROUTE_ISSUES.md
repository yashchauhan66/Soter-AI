# API Route Issues
> Status: TODO  
> Owner: BLACKBOXAI

## Checklist (to be validated)
1. Missing API auth / auth bypass
2. Missing RBAC checks
3. Missing Zod validation / weak input validation
4. IDOR (tenant/project access)
5. Rate limiting issues
6. Incorrect method handling (GET/POST mismatch)
7. CSRF / unsafe state-changing requests
8. Unsafe redirects / callback URL issues
9. SSRF via webhook/SIEM/report URLs
10. Sensitive data exposure (secrets/tokens/PII)
11. Error stack leakage
12. Pagination/filtering bugs
13. Webhook signature verification bugs
14. N+1 or heavy include causing timeouts
15. Non-deterministic behavior / flakiness

## Findings
- TODO
