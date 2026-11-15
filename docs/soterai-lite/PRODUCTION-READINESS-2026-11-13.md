# Production-readiness continuation — 13 November 2026

> **Superseded current handoff:** [Installed Windows workflow acceptance](PRODUCTION-NATIVE-2026-11-13.md).
> This historical record binds the earlier `e7f331a7` candidate. The later
> `528c3cb0` candidate has native workflow/restricted/vault passes and a completed
> current shipped-advisory lookup; its remaining gates are tracked in that new
> handoff. Earlier failures and evidence below remain preserved.

The user requested complete, high-quality production readiness and selected the
existing **Cline** setup for real integration testing. The user confirmed that
independent developer/security/accessibility reviews have not happened, and
explicitly approved the prepared isolated native test. The work below advances
the implementation and prepares remaining acceptance; it does not establish a
10/10 rating or a production-ready release.

## Completed in this continuation

1. Inspected the actual installed Cline **4.1.26** public manifest and runtime.
   The previous adapter recognized only 4.1.25. Added strict manifest/runtime
   hash pins for 4.1.26 while retaining the earlier 4.1.25 pin. Modified/future
   builds remain refused. Setup/restore previews carry the detected version,
   and a version change invalidates the configuration lease.
2. Reviewed and exercised short pure path/hook-result functions taken directly
   from the hash-verified 4.1.26 bundle. Confirmed default providers/global/MCP
   paths and hook cancellation/parameter contracts. This is public-source
   contract evidence, not a live Cline/provider trial.
3. Added refusal for inherited custom Cline data/settings-path overrides before
   default-profile reads/writes. This prevents changing one profile while the
   vendor reads another. No real provider configuration or credential was read
   into the model/tool output or modified.
4. Prepared a real installed-extension host driver with synthetic fixtures,
   exact four-runtime hashes, activation, native diagnostics/code-action and
   stale-action checks. It uses an isolated profile and preserves the normal
   installation. Clipboard contents are transient in-memory only; the driver
   restores them if its own synthetic sentinel remains unchanged.
5. Executed a separate 0.6.2 → 0.7.0 CLI installation upgrade using the retained
   local 0.6.2 VSIX. The synthetic global-storage marker survived and the four
   installed runtime hashes matched. This is installation/metadata evidence,
   not verified vault migration/decryption/recovery in the actual UI.
6. Prepared a checksum-verified independent review packet with the exact VSIX,
   371 first-party runtime source snapshots and unfilled pilot/security/
   accessibility templates. No human results or verdicts were invented.

## Actual results

| Check | Result |
| --- | --- |
| New Cline regressions before the change | 1 pass / 2 fail; the source-derived contract control passed |
| Cline compatibility, policy, lifecycle, atomic I/O, native frame/header and readiness tests | 27 pass / 0 fail |
| Combined affected suite, including existing live-action/context/manifest checks | **153 pass / 0 fail / 0 skip** |
| Migration-plan, encrypted recovery archive, backup scope and runtime-descriptor/job source tests | **93 pass / 0 fail / 0 skip** |
| Lite/IDE TypeScript check | Exit 0 |
| Fresh exact VSIX package/receipt/inventory | Passed |
| Isolated CLI install upgrade 0.6.2 → 0.7.0 | Passed; synthetic marker and exact runtime bytes preserved |
| Exact packaged broker | Six synthetic loopback scenarios passed; process closed cleanly |
| Independent review-packet bytes | 377 files verified; human acceptance false |
| Actual VS Code host launch | **Not executed: automatic approval review failed** |
| Current OSV lookup of three shipped npm components | **Incomplete: sandbox network failed; outside-sandbox review failed** |

The 27 tests overlap the combined 153; do not add them again. The 93 recovery
source checks are a separate file set. These runs verify source/synthetic
contracts, not independent human usability or OS isolation.

Evidence is under [the current run](evidence/20261113-production-readiness):
`affected-final.tap`, `recovery-source.tap`, `typecheck-01.log`,
`cline-public-review.json`, `upgrade-install-01/result.json`, `broker/result.json`
and the review kit. The 4.1.25 public binary was not available at its old retained
path; its earlier pin/evidence was preserved rather than falsely re-executed.

## Exact candidate

- [SoterAI Secret Guard 0.7.0 Windows x64 preview VSIX](../../packages/soterai-lite/soterai-secret-guard-0.7.0-cline-compat-20261113-attempt01.vsix).
- Size: **1,673,103 bytes**.
- SHA-256: `e7f331a75e4b89b6d4f7852093e8c624871a936ac72e779a0667ced1e2da72a8`.
- [Release pointer](evidence/20261113-production-readiness/candidate-pointer.json).
- Local 0.6.2 upgrade baseline SHA-256:
  `a74ef2597d7b07b019bc58e0f1d591aa37dd7986acba78b07dd6ff03fa042454`.

Earlier f49b/2987 candidates and results remain historical; do not transfer a
native/human result merely because all candidates share the 0.7.0 version string.

## Prepared next execution

The newest prepared native run is **native-03**. Earlier native-01/native-02
preparations remain preserved; native-01 binds the earlier branded object.
From the repository root, when the approval system works—or in the owner's
terminal using the already approved action—run:

```powershell
node scripts/soterai-installed-acceptance.cjs run docs/soterai-lite/evidence/20261113-production-readiness/native-03
```

The script installs only into its own profile, launches the actual VS Code host
with standard sandbox behavior, and saves `host-result.json`/`native-launch.json`.
It checks the installed candidate rather than substituting a source development
extension. Native foundation success is limited to activation, commands,
diagnostics/actions and stale-action refusal; it does not complete a full GUI
workflow, vault recovery or actual provider acceptance.

The current [review kit](evidence/20261113-production-readiness/review-kit/REVIEW.md)
includes pilot/security/accessibility templates. Verify it with:

```powershell
node docs/soterai-lite/evidence/20261113-production-readiness/review-kit/verify.cjs e7f331a75e4b89b6d4f7852093e8c624871a936ac72e779a0667ced1e2da72a8
```

## Remaining production gates

- Actual same-candidate activation/UI workflow, including reviewed copy,
  cancellation, source/preview drift, restricted workspaces and useful controls.
- A supported project that runs after reviewed vault migration, plus configured
  upgrade, interruption and encrypted recovery in the actual installed profile.
- Actual pinned Cline traffic with useful public responses and synthetic canary
  request/tool-result/attachment cases. Keep provider credentials in the user's
  trusted setup; do not send them in chat or evidence.
- Current shipped advisory lookup and any applicable remediation/review.
  The shipped versions still match the earlier 11 November lookup, but that is
  historical evidence and does not establish current advisory status.
- Real developer pilot, relevant independent security and screen-reader review.
- Accurate final release scope, owner authorization and verified served artifact
  identities on both registries. Publishing remains disabled locally.

Docker/AWS and a full hostile-agent OS boundary remain separate experimental
scope; they are not automatically mandatory Windows Lite gates unless advertised
as supported production features.

The host command was first blocked by a technical `content-blocked` review
failure. After the user explicitly approved it, approval review timed out; its
allowed retry failed again with `content-blocked`. Neither command executed.
The public OSV request failed in the sandbox; its required outside-sandbox retry
failed at that same review layer. These are tool approval-system failures, not
native test failures or a determination that the approved actions were unsafe.

`releaseReady` remains **false**. The user requested quality and completion;
missing external/human evidence is not converted into a passing result or an
inflated score. Existing files, evidence, normal IDE/provider settings and registry
state were preserved.
