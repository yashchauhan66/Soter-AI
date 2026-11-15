# Secret Guard documentation: pre-publication checklist

The documentation update is local. No commit, push, website deployment or extension publication was performed.

## Candidate to review

- **Extension:** `soterai.soterai-ide-guard`
- **Display name:** SoterAI Secret Guard
- **Version / target:** 0.7.0 pre-release / `win32-x64`
- **VSIX:** `packages/soterai-lite/soterai-secret-guard-0.7.0-docs-preview-20261115-02.vsix`
- **SHA-256:** `10aad56d4252f1790bde8a60ae31e4dc6e672c830f751baa112ff8587bfbcda2`
- **Exact release pointer:** `output/readme-polish-20261115/release-pointer-02.json`
- **Local preview:** `output/readme-polish-20261115/README-preview.html`

Earlier packages remain preserved. Use the `-02` pointer above, not an older release pointer, for this documentation candidate.

## Completed local checks

- [x] Preserve the existing publisher/name, version, storage identity and approvals.
- [x] Put Marketplace and Open VSX install links near the top, with a pre-release CLI command and a maintainer-provided VSIX fallback.
- [x] Separate the short Marketplace/IDE overview from the bundled user guide.
- [x] Preserve privacy, recovery and release limitations. The live-tool Coverage labels remain explicitly Uncovered.
- [x] Package the guide and PNG in the exact allowlist and verify all 20 archive entries.
- [x] Verify the shipped documentation against current source bytes.
- [x] Verify all four runtime bundles are byte-identical to the preceding isolated-hardening candidate.
- [x] Install this exact VSIX into an isolated VS Code profile and verify installed metadata and document bytes. The normal editor profile was not modified.
- [x] Run the focused documentation/package contracts and TypeScript check.
- [x] Complete an independent review of the documentation and exact packaging changes; parent-verify all consumed source/baseline pins and the final VSIX hash. No blocking findings. This is not full-product or release approval.
- [x] Check the local Markdown preview in light/dark themes at desktop and narrow widths, including guide/privacy navigation. This uses the exact local PNG, not a live hosted asset.

Verification receipts and failed attempts are retained in `output/readme-polish-20261115/`. The final memory-bounded test run is `final-package-tests-memory-bounded.log`. Additional unconstrained repeats encountered native out-of-memory errors on a memory-constrained host; production code and assertions were not changed to hide those failures.

## Required before publishing this README

### 1. Push the public documentation and image

The packager preserves reviewed Markdown bytes (`rewriteRelativeLinks: false`). The README therefore uses explicit HTTPS URLs instead of relying on automatic rewriting. Push these exact files to the public repository's `main` branch, or deliberately update and revalidate the URLs if another hosting location is chosen:

```text
packages/soterai-lite/README.md
packages/soterai-lite/USER-GUIDE.md
packages/soterai-lite/PRIVACY.md
packages/soterai-lite/CHANGELOG.md
packages/soterai-lite/media/readme-hero.png
```

Also retain the banner's editable SVG and generator in source control. The PNG, not the SVG, is referenced by the Marketplace README. Stage only intended files; the working tree contains unrelated existing work.

**These new public resources currently return 404 and must be live first:**

- [README banner PNG](https://raw.githubusercontent.com/yashchauhan66/Soter-AI/main/packages/soterai-lite/media/readme-hero.png)
- [User guide](https://github.com/yashchauhan66/Soter-AI/blob/main/packages/soterai-lite/USER-GUIDE.md)
- [Privacy statement](https://github.com/yashchauhan66/Soter-AI/blob/main/packages/soterai-lite/PRIVACY.md)

The remote README and changelog already exist but still need the updated contents. Check source bytes, not just HTTP status.

- [ ] Push the reviewed documentation/media source.
- [ ] Confirm each public link returns the intended content with an anonymous GET.
- [ ] Confirm the PNG URL returns the exact reviewed image.

Do not treat a Marketplace HEAD 404 as proof that a listing is missing: the existing listing returned 200 to GET. The retained public-link report records both observations.

### 2. Review the current candidate in the IDE

- [ ] Review the README and walkthrough visually in the intended IDE theme and normal extension-detail view.
- [ ] Confirm the published-host image loads without the local preview's image substitution.
- [ ] Confirm guide, privacy, changelog, license and install links open correctly.
- [ ] Complete the required human/accessibility/security and exact-candidate release checks. This task does not replace them.

The local preview is a Markdown rendering of the real source, not proof that a registry or installed webview has fetched the new remote image. Auxiliary visual inspection was unavailable; automated layout/contrast checks and screenshots do not replace human review.

### 3. Publish only after the remaining release gates

- [ ] Review the candidate's retained release limitations. `releaseReady` remains `false`.
- [ ] Finalize publisher ownership, signatures/advisories and required real-tool/provider/lifecycle evidence through the existing release workflow.
- [ ] Publish the intended `win32-x64` pre-release under the existing extension ID.
- [ ] Read back the exact version, channel, target and rendered README on each registry afterward.

At verification time, the existing [Marketplace listing](https://marketplace.visualstudio.com/items?itemName=soterai.soterai-ide-guard) and [Open VSX listing](https://open-vsx.org/extension/soterai/soterai-ide-guard) were reachable. Open VSX reported **0.6.2**; its version-specific **0.7.0** endpoint returned **404**. The new preview has not been published by this work.
