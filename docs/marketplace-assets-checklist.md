# Marketplace assets checklist

Status date: 2026-07-06. Every listing asset SoterAI IDE Guard needs across all channels, with a status column. Legend: **Ready** = exists and reviewed; **Draft** = exists, needs review; **Todo** = not started; **Per-IDE** = one instance required per published channel.

## Claim discipline (enforced on every asset)

- No asset may state or imply "100% secure," "unhackable," "blocks all AI," or "guarantees no leak." Reviewers reject copy that does.
- Every capability claim links to a shipped feature or a passing test. If the canary test does not pass for an adapter, that adapter's listing does not claim canary detection.
- Local-first and "no raw source/secrets/prompts to cloud by default" appear on every listing and the privacy summary.
- Screenshots and GIFs must show redacted evidence only — never a real secret, token, or customer path.

## Visual assets

| Asset | Spec | Source | Status | Notes |
|---|---|---|---|---|
| In-product activity-bar icon (SVG) | monochrome, VS Code activity bar | bundled in VSIX | Ready | Not a marketplace icon |
| Marketplace product icon (PNG) | 128×128 + 256×256 raster | `scripts/export-marketplace-icons.mjs` | Draft | Required by VS/Open VSX; regenerate via `npm run validate:marketplaces` |
| JetBrains plugin logo | light + dark SVG in `META-INF` | design | Todo | Required for Marketplace approval |
| Eclipse / JupyterLab / Sublime icons | per-channel raster | design | Todo | Per-IDE |
| Screenshots — scan result panel | HTTPS, redacted | recording | Per-IDE | One set per published IDE |
| Screenshots — redaction / safe prompt | HTTPS, redacted | recording | Per-IDE | Show placeholder output |
| Screenshots — "What AI Saw" ledger | HTTPS, redacted | recording | Per-IDE | No raw secrets in view |
| Demo GIF — canary scan → redact → safe prompt → ledger | ≤ 8 MB loop | [cross-ide-demo-script.md](cross-ide-demo-script.md) | Per-IDE | Follow the demo script exactly |
| Demo video (60–90 s) | MP4, captions | video script below | Draft | One master; per-IDE variants optional |

## Written assets

| Asset | Location | Status | Notes |
|---|---|---|---|
| Short description | `docs/marketplace-assets/soterai-short-description.md` | Ready | Reuse per channel |
| Long description | `docs/marketplace-assets/soterai-long-description.md` | Ready | Trim to each channel's limits |
| Platform listing copy | `docs/marketplace-assets/platform-listing-copy.md` | Draft | Per-IDE tone adjustments |
| Landing copy | `docs/marketplace-assets/platform-listing-copy.md` | Draft | Mirror the listing's honest claims |
| Privacy summary | `docs/marketplace-assets/privacy-summary.md` | Ready | Links to full policy below |
| Privacy policy (IDE plugins) | [privacy-policy-ide-plugins.md](privacy-policy-ide-plugins.md) | Ready | Local-first, canary handling |
| Data-handling policy | [data-handling-policy.md](data-handling-policy.md) | Ready | Data classes + retention |
| Limitations page | [cross-ide-limitations.md](cross-ide-limitations.md) | Ready | Per-platform honesty |
| Security model | `docs/local-ai-broker-security-model.md` | Ready | Broker auth / loopback |
| Feature / pricing matrix | `docs/cross-ide-feature-parity-matrix.md` | Draft | Free vs paid; no over-claim |
| FAQ | this file (§FAQ) | Draft | Common privacy/scope questions |
| Changelog | `CHANGELOG.md` | Ready | Per-version |
| Release notes | `RELEASE_NOTES.md` | Ready | Per-version |
| Support email | `docs/marketplace-assets/support-info.md` | Ready | One published address |
| Legal / compliance readiness | `docs/marketplace-assets/legal-readiness.md` | Draft | Review before publish |

## Video script (master, 60–90 s)

1. **Cold open (0–8 s):** editor with a file containing a planted canary secret and a real-looking API key placeholder. Caption: "Local-first AI security for your IDE."
2. **Scan (8–25 s):** run *Scan Selection with SoterAI*. Panel shows detections with redacted evidence and a decision. Caption: "Detections are computed by the local broker — raw secrets never leave your machine."
3. **Redact (25–45 s):** run *Redact Selection for AI*. Selection is replaced with placeholders. Caption: "Share safe context, not secrets."
4. **Safe prompt (45–60 s):** run *Safe Prompt*; the copied prompt contains placeholders only.
5. **Ledger (60–80 s):** open the "What AI Saw" ledger; show decisions and hashes, no raw secrets. Caption: "Auditable. No raw source, secrets, or prompts to the cloud by default."
6. **Close (80–90 s):** one honest line: "SoterAI mediates context routed through SoterAI. It does not intercept every third-party AI plugin — see our limitations page."

## Per-IDE screenshot / GIF matrix

| IDE | Screenshots | Demo GIF | Status |
|---|---|---|---|
| VS Code | required | required | Todo (record after clean-profile install) |
| Cursor / VSCodium | required | recommended | Todo |
| JetBrains (per product) | required | required | Blocked on build |
| Visual Studio | required | required | Blocked on adapter |
| Sublime | required | recommended | Blocked on adapter |
| Neovim | terminal capture | recommended | Blocked on install matrix |
| Eclipse | required | recommended | Blocked on adapter |
| JupyterLab | required (redacted outputs) | recommended | Blocked on adapter |

## FAQ (draft — publish alongside listings)

- **Does SoterAI send my code to the cloud?** No, not by default. The adapter talks to an authenticated loopback broker; raw source, secrets, and prompts are not sent to SoterAI Cloud unless you explicitly enable a remote feature.
- **Can it stop another AI extension from reading my files?** No. Any extension in a trusted workspace can read open files. SoterAI reduces *accidental exposure* of context routed through it and can move real secrets into the Protected Vault; it is not an OS-level sandbox.
- **Is it 100% secure?** No product is. SoterAI is honest about this — see [cross-ide-limitations.md](cross-ide-limitations.md).
- **What are canaries?** Planted decoy secrets that let SoterAI detect leakage in AI output. Canary values are handled as sensitive and never displayed raw in listings or logs.
- **Do I need the broker running?** Yes. The adapters are thin clients; without the local broker, scan/redact/safe-prompt commands cannot run.
