# SoterAI Email Setup Preflight Report

Date/time checked: 2026-07-19 12:36 IST

## Scope

Domain: `soterai.in`

Target mailbox: `support@soterai.in`

Receiving target: Cloudflare Email Routing to destination Gmail, destination not recorded here.

Sending target: Gmail Send mail as via Brevo SMTP.

## Capability Check

| Capability | Status | Notes |
| --- | --- | --- |
| Browser dashboard control | Not available in this Codex environment | Cloudflare, Gmail, and Brevo dashboard actions require user-driven browser steps or screenshots. |
| Screenshot/visual inspection | Available only for local image files | Dashboard screenshots can be inspected if the user provides them. |
| Terminal access | Available | Public DNS and HTTP checks were performed from PowerShell/curl. |
| Pause for manual actions | Available | Passwords, OTPs, CAPTCHA, SMTP keys, and verification links must be completed manually by the user. |

## Authoritative DNS Status

Public NS lookup currently shows:

| Type | Hostname | Value | TTL | Purpose |
| --- | --- | --- | --- | --- |
| NS | `soterai.in` | `ns43.domaincontrol.com` | 3600 | Current authoritative nameserver |
| NS | `soterai.in` | `ns44.domaincontrol.com` | 3600 | Current authoritative nameserver |

Result: Cloudflare is not currently authoritative for public DNS for `soterai.in`.

Impact: Cloudflare Email Routing cannot be safely completed until the Cloudflare zone is active and all required production DNS records are present in Cloudflare. Nameserver migration must not be performed without explicit user approval after confirming imported records.

## Public DNS Backup

This is a public DNS snapshot, not a full registrar/Cloudflare zone export. A complete dashboard backup is still required before any nameserver migration.

| Type | Hostname | Target/value | Proxy | TTL | Purpose |
| --- | --- | --- | --- | --- | --- |
| A | `soterai.in` | `13.200.123.232` | N/A outside Cloudflare | 600 | Website/server origin |
| AAAA | `soterai.in` | `64:ff9b::dc8:7be8` | N/A outside Cloudflare | 600 | IPv6/NAT64-style address published for root |
| CNAME | `www.soterai.in` | `soterai.in` | N/A outside Cloudflare | 3600 | Website alias |
| A | `api.soterai.in` | `13.200.123.232` | N/A outside Cloudflare | 600 | API/server origin |
| TXT | `_dmarc.soterai.in` | `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;` | N/A | 3600 | DMARC policy/reporting |

## Mail DNS Findings

| Check | Result | Notes |
| --- | --- | --- |
| MX records at root | No public MX answer found | Resolver returned SOA, indicating no MX records are currently published. |
| SPF TXT at root | No public root TXT/SPF answer found | No `v=spf1` root TXT was returned by the public lookup. |
| DMARC TXT | Found exactly one public `_dmarc` record | Current policy is `p=quarantine`; do not replace or weaken without approval. |
| DKIM records | Not found in public preflight | Provider-specific selectors are unknown until Brevo displays exact values. |
| Existing email provider records | No public MX found | Dashboard backup is still required to detect unpublished/imported records before migration. |

## Website/API Regression Baseline

| URL | Result | Notes |
| --- | --- | --- |
| `https://soterai.in` | HTTP `200 OK` | Served by `nginx/1.28.3 (Ubuntu)`, HSTS present. |
| `https://api.soterai.in` | HTTP `200 OK` | Currently returns the same HTTP headers/content length as root. Confirm expected API behavior before DNS migration. |

## Required Before Any High-Risk Change

Before changing nameservers or mail DNS:

1. Export or screenshot the full current DNS zone from the authoritative DNS provider.
2. Confirm these records exist in Cloudflare before switching nameservers:
   - `soterai.in` A `13.200.123.232`
   - `soterai.in` AAAA `64:ff9b::dc8:7be8`
   - `www.soterai.in` CNAME `soterai.in`
   - `api.soterai.in` A `13.200.123.232`
   - `_dmarc.soterai.in` TXT current DMARC value, unless an approved merge/replacement is required
   - Any verification, SSL, or production service records visible in the DNS dashboard
3. Review Cloudflare's proposed Email Routing MX/TXT changes before enabling.
4. Confirm no conflicting MX records remain.
5. Keep exactly one SPF TXT policy and exactly one `_dmarc` TXT record.

## Rollback Notes

If nameserver migration causes website/API issues, revert registrar nameservers to:

- `ns43.domaincontrol.com`
- `ns44.domaincontrol.com`

If Email Routing causes incoming mail issues after migration, remove Cloudflare Email Routing MX records and restore the previously documented MX state. Current public preflight shows no existing MX records, but the full dashboard backup must be treated as authoritative.

## Current Blockers

- Browser dashboard control is unavailable, so Cloudflare/Brevo/Gmail authenticated UI steps require user screenshots or manual browser actions.
- Cloudflare is not currently authoritative for `soterai.in` based on public NS records.
- Destination Gmail has not yet been provided.
- Full DNS zone export from the current DNS host has not yet been captured.
