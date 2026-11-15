# SoterAI Secret Guard launch kit

Status: **local preparation for preview testing; nothing posted or published**.
This kit supersedes earlier IDE-extension marketing drafts that implied universal
AI interception. The user selected the name with the strongest marketing fit;
the chosen display name is **SoterAI Secret Guard**.

## The name and position

**Name:** SoterAI Secret Guard  
**Tagline:** Check secrets before your next AI prompt.  
**Audience:** developers and vibe coders sharing code, configuration and error
logs with AI.  
**One problem to own:** "I need AI help debugging this, but my context contains
passwords and API keys."

The name retains the existing SoterAI brand/domain and adds a clear function.
The display name, description and focused keywords have been updated locally.
Publisher `soterai` and package ID `soterai.soterai-ide-guard` are preserved; the
name does not create a new install identity or reset the vault namespace.

| Candidate | Benefit | Tradeoff |
| --- | --- | --- |
| **SoterAI Secret Guard — selected** | Existing brand plus understandable purpose | Longer than an invented single word |
| SecretLane | Memorable, suggests a reviewed sharing path | New brand; needs a clear secret-protection descriptor |
| KeyFence | Short and easy to say | Sounds limited to API keys |
| VibeVault | Relatable to vibe coders | Narrows the audience and suggests storage more than sharing protection |

No name has been established as trademark/domain/registry-available by this
session. Public Open VSX lookup failed in the sandbox; automatic approval review
then timed out and rejected a retry with a technical `content-blocked` error.
No popularity, install growth or search-rank guarantee follows from a rename.
The keyword choices are search-intent hypotheses, not measured search volumes.

## Deliverables

- [Store listing copy](MARKETPLACE-LISTING.md): one consistent message for VS Code and Open VSX.
- [Launch posts and schedule](LAUNCH-COPY.md): English/Hinglish drafts, a two-week sequence and useful metrics.
- [Demo and screenshot plan](DEMO.md): synthetic fixtures and a real-editor recording checklist.
- [Product priorities and release decision](PRODUCT-PRIORITIES.md): next useful features, acceptance tests and honest ratings.
- `assets/social-1200x630.png` and `assets/social-1080x1080.png`: promotional illustrations generated from the existing logo; not editor screenshots.
- `assets/*.svg`: editable sources for the two cards.
- Website source at `app/vscode-ai-security/page.tsx`: updated messaging, FAQ,
  Windows-only schema, matching share card and preview-testing CTA. It has not
  been deployed. The broader `/extensions/ide` published-release hub retains its
  earlier registry/version data until the owner verifies the new registry release.

## Consistency rules

Use **SoterAI Secret Guard** in display names and headlines. Use **secret
protection for AI coding** as the category, not a claim of universal isolation.
Use **Windows preview** until the corresponding release gates pass. Local
scanning is account-free; configured provider traffic is a separate choice.

Lead with a visible workflow: find → preview → explicitly copy or review vault
protection. Show useful code/error context surviving redaction. Do not market a
source-level test or a synthetic graphic as a real editor/provider recording.

The selected keyword set is deliberately focused: secret-scanning,
secret-protection, api-keys, redaction, env, ai-coding, privacy, security, cline,
claude-code, local-first and developer-tools. Integration descriptions must
still specify version/configuration/coverage limits.

## Publication handoff

The desired stores are VS Code Marketplace and Open VSX. Public registry URLs
derived from the existing ID are:

- `https://marketplace.visualstudio.com/items?itemName=soterai.soterai-ide-guard`
- `https://open-vsx.org/extension/soterai/soterai-ide-guard`

These are intended listing links, not confirmation that this new version is
available. Verify namespace/publisher ownership, exact version, Windows target
and preview channel separately on each registry. Keep publisher credentials in
owner-controlled stores; do not include them in these materials.

Use the repository's [publishing runbook](../../docs/soterai-lite/PUBLISHING-RUNBOOK.md)
and current official registry documentation when performing the actual upload.
The local publish wrapper remains disabled and `releaseReady` remains false.
Finishing this marketing kit does not authorize upload, a website deployment,
social posts, emails or direct messages.

## Retained installed-product screenshots — 13 November candidate

The historical [native acceptance handoff](../../docs/soterai-lite/PRODUCTION-NATIVE-2026-11-13.md)
binds candidate SHA-256
`528c3cb0bfed0fa106d920c54694873a6023e7a1c123ba984ba89100b424741d`.
The following are real screenshots of the installed SoterAI product in an
isolated VS Code driver host using synthetic fixtures. They are local assets,
not an actual provider demo, independent user trial or published listing.

![Installed SoterAI debug preview with synthetic context and filtered values](assets/native-debug-preview-528c3cb0.png)

**Debug preview:** the real installed product shows reviewed error/context text
using synthetic input on the **13 November `528c3cb0` candidate**. Native automation verified the explicit copy and
cancellation/drift controls separately; the still image alone does not prove
those actions or provider protection.

![Installed SoterAI names-only environment contract with synthetic examples](assets/native-environment-contract-528c3cb0.png)

**Environment contract:** the real installed product shows environment names and
synthetic examples on the **13 November `528c3cb0` candidate** in the isolated driver host. No real developer credentials
or provider traffic are represented.

Use these assets with the existing tagline and **Windows preview** label.
Those historical native tests cover reviewed copy, restricted-workspace refusals and
same-session vault migration/restoration. A selected synthetic Node app also
ran successfully through reviewed vault configuration, exited 0 and produced
verified visible output. Native unchanged Cline 4.1.26 refused a conflicting
legacy override without owned writes/backups. Actual Cline public/provider
traffic, request/tool-result/attachment canaries, interrupted/upgrade recovery
and independent acceptance remain open; avoid stable-release or 10/10 claims.

## Current candidate and marketing scope — 14 November 2026

The fresh [release handoff](../../docs/soterai-lite/PRODUCTION-READINESS-2026-11-14.md)
binds [SoterAI Secret Guard 0.7.0 Windows preview](../../packages/soterai-lite/soterai-secret-guard-0.7.0-provider-input-fix-20261114-attempt01.vsix),
SHA-256 `df92f72ae4672ed8f4857b0cfba51fc422b7811ad57aff36b76b417e149ef55f`,
1,674,363 bytes. Provider configuration now keeps inputs pending on focus loss
and cancels before writes. 115 affected source checks, TypeScript, packaging,
six synthetic packaged-broker controls and CLI metadata upgrade passed.

Fresh installed-product acceptance has **not executed** because approved native
launches were rejected before execution by technical `content-blocked` approval
review errors. Current advisory lookup is incomplete. Use the two real
`528c3cb0` screenshots above only as labeled **historical installed-product
images**, not fresh-candidate proof or a provider demo. The social cards remain
promotional illustrations. No current screenshot or human verdict is invented.

Keep **Windows preview** and **“Check secrets before your next AI prompt.”**
Actual Cline/provider canaries, interruption/upgrade recovery, independent
acceptance and publication remain open. Provisional ratings stay **7.5/10
overall, 8/10 supported-workflow usefulness, 6/10 stable readiness**; these are
subjective assessments, not stable-release or 10/10 marketing claims.
