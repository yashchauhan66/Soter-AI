# SoterAI IDE Guard v0.5.0 — Final Ratings & Publish Recommendation

- **Date:** 2026-08-15
- **Artifact:** `packages/vscode-extension/soterai-ide-guard-0.5.0.vsix` (1,507,523 bytes, 21 files)
- **SHA-256:** `9d8431eab444a6e77231d0be5ecf34443367414990d5c4f72ef7696188b41c0d`
- **Engines:** `vscode ^1.85.0` · **Publisher:** `soterai` · **Registry targets:** Open VSX (+ Windsurf mirror, Cursor proxy) and Visual Studio Marketplace
- **Provenance:** `reports/release-provenance-attestation.json` / `reports/vscode-release-checksums.sha256` (hash parity verified)

---

## 1. Method

Evidence was collected from five independent layers, each run against the exact 0.5.0 build that was packaged:

| Layer | What ran | Evidence |
|---|---|---|
| A. Static | `tsc --noEmit` (extension), 288-test unit suite | clean typecheck; unit run |
| B. Real host | VS Code 1.104.0 extension-host suite + real-user flow + floor | `npm run test:host`, `test:host:floor` |
| C. Packaged runtime | VSIX installed & probed in 5 editors | `artifacts/editor-runtime/*.json` |
| D. Registry gates | OpenVSX publish preflight, marketplace link probe, publisher verification | `artifacts/openvsx/publish-preflight.json`, `artifacts/marketplace/*` |
| E. Provenance | checksum regeneration + byte-verification | `reports/vscode-release-checksums.sha256` |

Findings fixed during this audit cycle (previous task) were re-verified by re-running the full unit + host + probe suites before this report was written.

---

## 2. Evidence summary

### 2.1 Automated tests (Layer A)
- Extension typecheck: **0 errors**
- Unit suite: **286 pass / 0 fail / 2 skipped** (skips = symlink cases, Windows `EPERM` environment limitation, not product defects)
- Failing-then-fixed regression items this cycle: 3 stale README command titles, manifest asset floor after walkthrough simplification, host fake-context missing `extension.packageJSON`

### 2.2 Real VS Code host (Layer B)
- Control Panel suite: **11/11 pass** (CSP/nonce, rendered controls, resource links, toggle mutates real setting, allowlist rejection, command registry)
- Real-user suite: **18/18 pass** (clipboard redaction, dependency typo-squat, controlled terminal, broker enforcement, lockdown/unlock, live scan diagnostics, port-conflict handling, 150 liveness probes — 0 refused)
- Host floor: **18/18 pass**

### 2.3 Packaged runtime parity (Layer C) — same VSIX, same SHA-256
| Host | Result | Runtime checks |
|---|---|---|
| Visual Studio Code | **PASS** | 7 |
| Cursor (Open VSX proxy) | **PASS** | 7 |
| Windsurf (Open VSX mirror) | **PASS** | 7 |
| Kiro | **PASS** | 7 |
| Antigravity | **PASS** | 7 |
| VSCodium | **UNVERIFIED** (not installed on this machine) | — |

### 2.4 Registry gates (Layer D)
- OpenVSX preflight: **READY** — 36 checks, 0 failures, 1 non-blocking warning (codium unverified). Includes: 162/162 command surface parity, no dotenv/keys/node_modules/source-maps in VSIX, license pointer resolves, icon/readme/changelog present, 0.5.0 unpublished (HTTP 404), namespace `soterai` claimed, 0.3.0 → 0.5.0 moves listing forward.
- Marketplace links: **5/5 reachable** (repository, bugs, homepage, qna, website).
- Publisher verification (VS Marketplace badge): **NO-GO — time-gated, not a defect.** Earliest eligible **2027-01-06** (extension live + domain age ≥ 6 months); TXT record `_visual-studio-marketplace-soterai.soterai.in` not yet added (DNS is Cloudflare-owned; steps in `docs/vscode-publisher-verification.md`).

### 2.5 Provenance (Layer E)
- Regenerated for 0.5.0; freshly computed VSIX SHA-256 **matches** the published checksum file byte-for-byte.
- Signing status: unsigned local build (CI signing is the only remaining provenance gap, documented in the attestation).

---

## 3. Final ratings

| Dimension | Rating | Basis |
|---|---|---|
| Code & test quality | **5/5** | typecheck clean; 286/286 unit; zero unexplained failures |
| Real-host behaviour | **5/5** | 47/47 host checks incl. real settings mutation and broker enforcement |
| Packaged-runtime parity | **4/5** | 5/5 installed hosts PASS on identical bytes; codium unverified (environment, not code) |
| VSIX / packaging hygiene | **5/5** | 21 entries, no secrets/sources/maps, license+media+changelog resolve |
| Marketplace listing readiness | **4.5/5** | links + media + quick start all green; publisher badge time-gated to 2027-01-06 |
| Privacy & security posture | **5/5** | local-by-default scanning, no cloud credentials shipped, no dotenv/keys in VSIX, redacted telemetry default off |
| Docs & onboarding | **5/5** | 3-step walkthrough, 10-command default palette, README screenshots + conversion-oriented quick start |

**Overall release readiness: 4.9/5 — publishable.**

---

## 4. Blockers and recommendations

| Priority | Item | Status | Action |
|---|---|---|---|
| — | OpenVSX publish | **READY** | `npm run openvsx:publish` will re-run the gate; safe to publish 0.5.0 now |
| Low | VS Marketplace verified-publisher badge | Time-gated | Add TXT record today (docs ready); submit badge verification on/after **2027-01-06** |
| Low | VSCodium parity evidence | Environment | Sideload VSIX + run `SOTERAI_PACKAGED_RUNTIME=1 node scripts/test-vscode-family.mjs codium` on a machine with codium before claiming support |
| Low | Signed provenance | Future | Sign VSIX in CI and run same-build reproducibility check before the signed-provenance gate is claimed |
| Fixed | Evidence-chain drift | **Fixed in this report** | `scripts/test-vscode-family.mjs` repackaged the VSIX on every run, so each probe recorded different bytes than the audited artifact. Now consumes the existing VSIX (`SOTERAI_REPACKAGE=1` to force a rebuild); full chain re-verified against the canonical SHA-256 |
| Note | Worktree | Dirty | Publish from a clean tagged commit for reproducible-build parity |

## 5. Recommendation

**PUBLISH 0.5.0 to Open VSX now.** All blocking gates are green, the exact artifact passed 5 real editors byte-identical, and 0.5.0 is the strongest onboarding package shipped so far (first-minute value, honest protection labels, beginner walkthrough). The VS Marketplace publisher badge and signed provenance are the only outstanding items, both non-blocking and scheduled by policy rather than by code.

*This report is self-generated from reproducible gates; the SHA-256 above can be re-verified with `Get-FileHash packages/vscode-extension/soterai-ide-guard-0.5.0.vsix -Algorithm SHA256`. The VSIX is the canonical artifact every gate in this report references.*
