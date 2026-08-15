# Soter Extension — Monetization & Licensing Strategy (Free vs Paid)
**Date:** 2026-08-06 · **Scope:** Chrome Web Store + Microsoft Edge Add-ons (same MV3 codebase → same features on both)

---

## 1) Goal
Earn revenue **without breaking the #1 moat** (local-first, privacy, offline). Golden rule: **core protection stays free forever**; money comes from *scale, teams, and advanced intelligence* — never from holding a single user's safety hostage.

## 2) Free vs Paid — what to charge for

| Capability | FREE (individual) | PRO (per-seat) | ENTERPRISE (org) |
|---|:---:|:---:|:---:|
| Core DLP scan (secrets, PII, India PII) on all 13 AI sites | ✅ | ✅ | ✅ |
| Prompt-injection (regex + multilingual) | ✅ | ✅ | ✅ |
| Anti-evasion normalizer (zero-width/homoglyph/leet/base64/ROT13) | ✅ | ✅ | ✅ |
| **Semantic Shield (paraphrase-resistant, ONNX)** | ⚠️ heuristic only | ✅ full model | ✅ full model |
| **Network-layer hard block (DNR)** | ❌ warn-only | ✅ | ✅ |
| **Response semantic DLP** | ❌ | ✅ | ✅ |
| **Data Fingerprint Vault (near-duplicate, fuzzy)** | ❌ | ✅ (personal vault) | ✅ (org vault) |
| **Source-lineage provenance graph** | ❌ | ✅ last 30 days | ✅ full + export |
| Signed policy / fail-closed / rollback protection | ❌ | ❌ | ✅ |
| Emergency lockdown, managed config (Intune/GPO) | ❌ | ❌ | ✅ |
| Fleet dashboard, SIEM/SOC export, SSO/SCIM | ❌ | ❌ | ✅ |
| Audit ledger + compliance reports (DPDP/GDPR/PCI) | ❌ | 1-user | ✅ org-wide |
| Price | $0 | ~$6–9 /user/mo | ~$15–25 /user/mo (min seats) |

**Why this split works:**
- Free users get real protection → reviews, word-of-mouth, store ranking.
- The *moments that convert* are exactly the paid ones: hard block (actually stops the leak), fuzzy fingerprint (catches renamed/paraphrased docs), lineage (audit), fleet (managers).
- Enterprise buys compliance + control plane, which is already your strongest engineering.

## 3) How to enforce (technical, no backend rewrite needed for v1)
- **Entitlement object** in state: `{ tier: "free" | "pro" | "enterprise", seats?, expiresAt?, token? }` stored in `chrome.storage.local`.
- **Feature gate** helper: `isAllowed(feature, tier)` in `packages/shared` — single source of truth, used by both extension + dashboard.
- **License token** (Pro/Enterprise): signed JWT/Ed25519 from your billing webhook (Stripe/Razorpay). Verify locally with a bundled public key (offline-friendly). Reuse your existing `policy-verification` pattern.
- **Graceful degrade**: if token expired → drop to Free behavior (still protective), never lock the user out of safety.
- Edge + Chrome: identical code path; only the *store listing + payment link* differ.

## 4) Pricing recommendation (India + global)
- **Free:** $0 — full local core, growth engine.
- **Pro:** ₹499/mo or $7/mo per seat (India-friendly via Razorpay/UPI; global via Stripe).
- **Enterprise:** ₹1,499–2,499/mo per seat, annual, min 10 seats. Add **Enterprise-starter ₹9,999/mo flat (≤25 seats)** for Indian SMBs.
- One-time **Lifetime Pro** (₹4,999 / $59) as a launch offer on Product Hunt (drives early cash + reviews).
- 30% store-margin note: browser stores don't take payments for B2B — route through your own checkout (Stripe/Razorpay) with a license key. This keeps ~97% of revenue.

## 5) Roll-out plan (fastest path to first ₹)
1. Ship Free on Chrome + Edge (same build). Landing page with clear tier table.
2. Add license-key field in the popup ("Have a Pro key?") that verifies locally.
3. Pro = Semantic Shield full + hard-block + fingerprint + lineage.
4. Add Stripe/Razorpay webhook → mints signed license keys → user pastes key.
5. Launch Product Hunt + r/netsec + LinkedIn with the **"offline AI DLP, #1 in niche"** story.
6. Enterprise: Intune/GPO managed-config template + DPDP/GDPR report export → sales page.

## 6) What to build next (revenue-ranked)
1. License-key verification + `isAllowed` gate (small, unlocks everything above).
2. Hard-block + fingerprint gated to Pro (they're already built — just gate them).
3. Signed license minting endpoint on your existing Next.js billing stack.
4. Fleet dashboard upsell page (Enterprise).

> Bottom line: keep the safety core free, charge for *hardness, fuzzy matching, lineage, and org control*. That maps revenue directly to your unique engineering that no competitor ships in one extension.
