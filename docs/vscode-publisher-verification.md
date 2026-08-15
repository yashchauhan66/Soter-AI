# VS Code Marketplace publisher verification — soterai.in

What the blue check next to the publisher name actually is, what SoterAI needs
to get it, and which gates are open today.

**Status: NO-GO until 2027-01-06.** Everything except the two eligibility
clocks is either already met or can be done this afternoon. The clocks cannot
be shortened.

Run the preflight instead of trusting this page:

```bash
node packages/vscode-extension/scripts/publisher-verification-preflight.mjs
node packages/vscode-extension/scripts/publisher-verification-preflight.mjs --offline
```

It writes `artifacts/marketplace/publisher-verification-evidence.json`.

## What the check is (and is not)

The verified badge is granted **per publisher, on a domain** — not per
extension. Microsoft's reviewer confirms you control the domain, then the
badge appears next to every extension that publisher ships.

The clickable domain shown under the publisher name on a listing (the thing the
Claude extension has, and the reason this work started) comes from the same
place: it renders when the gallery record carries `isDomainVerified: true` and
a `domain`. **No `package.json` field produces it.** Editing the manifest
cannot grant it and cannot fake it.

What the manifest *does* control is the Resources sidebar on the listing —
those links ship today:

| Manifest field | Listing link | Value |
| --- | --- | --- |
| `homepage` | Homepage | `https://soterai.in/vscode-ai-security` |
| `qna` | Q&A / Support | `https://soterai.in/support` |
| `bugs.url` | Issues | `https://github.com/yashchauhan66/Soter-AI/issues` |
| `repository.url` | Repository | `https://github.com/yashchauhan66/Soter-AI` |

All four are verified reachable (`200`, zero redirects) by
`scripts/verify-marketplace-links.mjs`, and kept in sync with the README and
the in-editor Control Panel by `src/__tests__/resource-links.test.ts`.

## Gate status

Measured 2026-08-11.

| Gate | Status | Evidence |
| --- | --- | --- |
| Publisher ID exists | ✅ | `soterai` |
| Apex domain serves HTTPS | ✅ | `HEAD https://soterai.in/` → `200`, 0 redirects |
| DNS is under our control | ✅ | Cloudflare-hosted; records editable |
| Domain is an apex, not a subdomain | ✅ | `soterai.in` |
| TXT verification record | ❌ | `_visual-studio-marketplace-soterai.soterai.in` → NXDOMAIN. **Addable today.** |
| Extension live ≥ 6 months | ❌ | First published 2026-07-06 → eligible **2027-01-06** |
| Domain registered ≥ 6 months | ❌ | RDAP registration 2026-07-03 → eligible **2027-01-03** |

**Earliest eligible submission: 2027-01-06**, set by the extension clock.

The two clocks are Microsoft's eligibility criteria for the request, not
something the reviewer waives on appeal. Submitting early spends a review cycle
to be told to come back in January.

## When the clocks clear

1. **Add the TXT record** (do this any time — it costs nothing to have it early).
   In Cloudflare DNS for `soterai.in`:

   | Field | Value |
   | --- | --- |
   | Type | `TXT` |
   | Name | `_visual-studio-marketplace-soterai` |
   | Content | `owner=soterai` |
   | TTL | Auto |

   Cloudflare appends the zone, so the full host resolves to
   `_visual-studio-marketplace-soterai.soterai.in`. Re-run the preflight until
   that gate flips to PASS — DNS propagation is minutes, not instant.

2. **Request verification.** <https://marketplace.visualstudio.com/manage/publishers/soterai>
   → Details → *Verified domain* → enter `soterai.in` → Verify.

3. **Wait for manual review** (~5 business days). The reviewer checks the TXT
   record, that the domain serves HTTPS, and both clocks.

4. **Confirm it landed.** The badge is in the gallery record, not the VSIX:

   ```bash
   curl -s -X POST 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery' \
     -H 'Content-Type: application/json' -H 'Accept: application/json;api-version=7.2-preview.1' \
     -d '{"filters":[{"criteria":[{"filterType":7,"value":"soterai.soterai-ide-guard"}]}],"flags":914}' \
     | python -m json.tool | grep -iE 'isDomainVerified|"domain"'
   ```

   `"isDomainVerified": true` is the badge. No re-publish is required — it
   attaches to the publisher, so the live listing updates on its own.

## Notes worth keeping

- **Apex only.** Verification covers `soterai.in`. A homepage on
  `docs.soterai.in` would not be covered, which is why the resource-links test
  asserts `homepage` and `qna` stay on the apex host.
- **The badge is not a security claim.** It means "this publisher controls this
  domain" — nothing about the extension's behaviour. It does not belong in any
  marketing sentence next to a protection claim, per
  `docs/marketing-claims-policy.md`.
- **Publishing is independently blocked** on the 5 live installs, tracked
  separately. Verification does not require a new publish, so the two are not
  coupled.
