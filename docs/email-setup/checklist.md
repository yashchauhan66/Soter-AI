# SoterAI Support Email Setup Checklist

Last updated: 2026-07-19 12:40 IST

## Phase 0 - Capability Check

- [x] Confirmed terminal access is available.
- [x] Confirmed authenticated browser dashboard control is not available in this environment.
- [x] Confirmed manual pause/user action flow is available.
- [x] Destination Gmail received from user and kept out of repository.

## Phase 1 - Preflight And DNS Backup

- [x] Checked public nameservers.
- [x] Checked public MX records.
- [x] Checked public root TXT/SPF records.
- [x] Checked public DMARC record.
- [x] Checked root, `www`, and `api` DNS records.
- [x] Checked website/API HTTPS baseline.
- [x] Created sanitized preflight report.
- [ ] Verify Cloudflare zone status in dashboard.
- [ ] Capture full sanitized DNS backup from current authoritative DNS provider or Cloudflare import.
- [ ] Confirm production records are present in Cloudflare before any nameserver change.
- [ ] Get explicit approval before nameserver migration, if required.

## Phase 2 - Cloudflare Incoming Email

- [ ] Enable/verify Cloudflare Email Routing.
- [ ] Verify destination Gmail in Cloudflare.
- [ ] Create `support@soterai.in` routing rule.
- [ ] Confirm no catch-all is enabled.
- [ ] Confirm Cloudflare MX records and no MX conflicts.
- [ ] Perform inbound test.

## Phase 3 - Brevo Outgoing Email

- [ ] Add/authenticate `soterai.in` in Brevo.
- [ ] Add exact Brevo DNS records to active DNS.
- [ ] Confirm DKIM/domain authentication.
- [ ] Add and verify `SoterAI Support <support@soterai.in>` sender.

## Phase 4 - SMTP Credential

- [ ] Create dedicated Brevo SMTP key without exposing it to chat/repo.
- [ ] Record only non-secret SMTP host, port, TLS mode, and username.

## Phase 5 - Gmail Send Mail As

- [ ] Add `support@soterai.in` in Gmail Send mail as.
- [ ] Configure Brevo SMTP manually.
- [ ] Verify Gmail confirmation.
- [ ] Configure reply behavior.
- [ ] Add signature.

## Phase 6 - Gmail Organization

- [ ] Inspect headers after real inbound test.
- [ ] Create verified Gmail label/filter if useful.

## Phase 7 - End-To-End Testing

- [ ] Incoming test passes.
- [ ] New outgoing test passes.
- [ ] Reply test passes.
- [ ] SPF/DKIM/DMARC result recorded.
- [ ] Website/API regression test passes after DNS changes.

## Phase 9 - Final Documentation

- [ ] Create final evidence-based setup report.
