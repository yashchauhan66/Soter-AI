# F31b B01–B18 current evidence map

This map references executed results; it runs no tests. F31b remains **INCOMPLETE**, with mandatory advisory review and named unverified subcases. No F32 transition, release-ready or rating claim.

Current VSIX: `6231159d484a70b284945a61cd8d341b13f809336427c5a57debd807759c688c` / 1735938 bytes. Current source graph1098: `221bd5c7b0ad1753365b6ae3526c77db2b02f0192a3be41bfe0bfed9240c5e99`.

Package46 PASS, full4783/4779PASS/4SKIP, and targeted manifest559 PASS are separate result sets. Repeated references below add zero tests.

| Case | Observed support | Remaining boundary |
| --- | --- | --- |
| B01 Deterministic noncircular embedded metadata | PKG021: Same admitted synthetic graph twice produces identical SBOM/notices; no timestamp/serialNumber/final-VSIX property. Actual embedded SBOM binds immutable build-receipt SHA and runtime/source inventory; final archive SHA is detached. | Scoped claims only; no exhaustive/general safety claim. |
| B02 Runtime/source graph changes bind different facts | PKG022: Runtime digest and source-input digest mutations change metadata. Production object recomputation checks current actual source/runtime hashes. | Scoped claims only; no exhaustive/general safety claim. |
| B03 Missing/tampered runtime/input/provenance refusal | PKG023, PKG003, PKG004, PKG009, PKG010, PKG014, PKG027: Missing/duplicate runtime, runtime byte mismatch, missing/changed input and invalid provenance hash are refused. Legacy controls exercise shared provenance logic; they are not new final-mode permutations. | Scoped claims only; no exhaustive/general safety claim. |
| B04 Actual bundled libraries, repeated inputs and versions | PKG024, PKG001: Production18 archive has exactly @babel/parser7.29.7 MIT, jsonc-parser3.3.1 MIT, yaml2.9.0 ISC as bundled library components. Actual source-input grouping records bundled runtimes and package-root identity; no unbundled workspace dependency is called embedded. | No focused fixture proves repeated nested package-version merging across different roots/runtimes. Two roots with identical package name/version conservatively refuse unique notice matching; successful acceptance for that future graph is not claimed. |
| B05 Complete exact notices and component identity | PKG025, PKG029, PKG024, PKG012, PKG013: Missing/unknown notices, mismatched notice-component identity and changed notice text are refused by final metadata controls; complete production notices are bound and recomputed. Source explicitly rejects metadata.name differing from its node_modules package-root tail. | No focused actual negative fixture mutates package.json name versus package path; code review alone is not dynamic coverage of that guard. |
| B06 Dependency/path/notice resource boundaries | PKG026, PKG011: Absolute source path and over256KiB notice text are refused; shared auditor rejects a .env input selector before reading. | Linked dependency/input and excessive component/notice-count guards are implemented but have no named focused executed controls in package46. |
| B07 Strict valid final archive and final inventory | PKG030: Synthetic valid final18 archive recomputes embedded metadata/notices and keeps releaseReadyfalse. Current production attempt03 has strict18 entries/four runtimes/final archive SHA and complete detached inventory. | Scoped claims only; no exhaustive/general safety claim. |
| B08 Missing/extra/alias/malformed/oversized archive refusal | PKG031, PKG005, PKG006, PKG015, PKG016: New final-mode controls reject missing privacy and an extra map. Legacy shared ZIP controls reject aliases, truncation and oversized entries; strict final18 allowlist and bounded parsing remain active. | No exhaustive final-mode duplicate/case-alias/malformed/truncated/oversized matrix was executed separately for each new SBOM/privacy/notices asset. |
| B09 Recomputed component/runtime/notice consistency | PKG032, PKG039, PKG025, PKG029, PKG004: Well-formed changed SBOM, post-receipt bundled source drift and changed notice bytes are detected; independent archive SHA does not substitute for provenance consistency. Runtime mismatch is dynamically covered through shared legacy auditor; current final object exact runtime bytes are recomputed. | Scoped claims only; no exhaustive/general safety claim. |
| B10 Actual platform/pre-release XML | PKG033, PKG034, PKG042, PKG043, PKG044, PKG007: Actual vsce output is win32-x64 with one real PreRelease=true property. Preview/missing property, duplicate attribute, comment-only property, unclosed tail, second root and undeclared entity controls refuse. | Scoped claims only; no exhaustive/general safety claim. |
| B11 Identity, immutable manifest and virtual-workspace declaration | PKG035, PKG008: Final virtual-workspace mutation refuses; actual canonical build copying preserves virtualWorkspaces.supportedfalse and limited-trust declaration. Current archive identity/version/main/four runtimes match immutable build/package receipts; shared legacy wrong-publisher control refuses. | Scoped claims only; no exhaustive/general safety claim. |
| B12 Trust and owner-required pre-commit release exclusion | PKG036: Final package cannot remove unsupportedFeatures[preCommit]. Three actual full-suite F31b command controls refuse new grants despite flags/caller arguments, retain reviewed recovery, and refuse unreadable metadata without leaking its error. Limited-trust/virtual declarations are current packaged facts. | Actual installed restricted-workspace transition, disable/uninstall and aggregate removal are F32 NOT_RUN; package declarations alone cannot prove them. |
| B13 Exclusive output and immutable attempt custody | PKG027, PKG041: Existing output sentinel is preserved after overwrite refusal; invalid provenance hash/duplicate source input refuse. Three unique retained production attempts preserve failures01/02 and accepted03; COPYFILE_EXCL and exclusive new stage/assets paths are implemented. | No named focused executed linked/outside output-parent or preexisting report collision negative control in package46. |
| B14 Owner-selected complete BUSL and third-party notices | PKG037, PKG024, PKG025, PKG029: Short BUSL summary refuses; current shipped full4493-byte terms equal owner-selected historical SHA50850df5...a253. Actual shipped complete third-party notice bytes are bound to admitted three-library graph. No legal approval is inferred. | Scoped claims only; no exhaustive/general safety claim. |
| B15 No invented results, safe metadata/log contents | PKG028, PKG017, PKG001: Metadata explicitly leaves native/advisory/legal authority outside itself and releaseReadyfalse; absolute fixture root is absent from shared auditor reports. Authorized advisory response is now REVIEW_REQUIRED, never a clean audit; native actual scope and missing human gates are retained separately. | No explicit synthetic environment/token sentinel injection-and-log/SBOM/inventory absence test was executed in package46. Real credentials were not inspected by this mapping. |
| B16 Installed pinned packager integration | PKG040, PKG045, PKG046: Three actual vsce component controls inspect real final18/pre-release output, production files allowlist and preservation of reviewed README relative-link bytes. Synthetic stages/runtimes only; this is installed packager use, not Code installed-VSIX lifecycle. | Scoped claims only; no exhaustive/general safety claim. |
| B17 Actual final production package and affected object checks | Actual package04/content03/artifact receipts: Current unique attempt03 VSIX6231159d...c688c/1735938 bytes has actual package04 natural0/bothEOF, strict content03 receipt,18 entries/four runtimes/88 settings and immutable graph1098. Current affected chain03 wrappers closed successfully; accepted-root aggregation and withdrawal are recorded separately below, not inferred from old objects. | Scoped claims only; no exhaustive/general safety claim. |
| B18 Claims, privacy, unsupported boundaries and content drift | PKG038, PKG040, PKG045, PKG046: README source drift refuses; production README bytes survive actual vsce packaging unchanged. README retains pre-commit unsupported/PS7 absent/unmanaged9leaks/same-user/other-extension/platform/human limits; privacy documents automatic scans, filenames/retention, separate provider traffic/telemetry and recovery. Fresh manifest-reference559 checks and source claims review are distinct from full4783 and package46; repeated references do not add test counts. | README-CLAIMS still labels some current packaging/route checks pending; do not read it as comprehensive current per-tool acceptance. Positive/negative universal-claims mutation corpus and all final-tool/class/catalog checks remain V01/V02; authenticated human trials and independent exact-object review remain V05/L7. |

## Exact control index

- `PKG001` / package-components-06 TAP1: exact synthetic artifact yields inventory and actual bundled-component SBOM; readiness stays incomplete — PASS.
- `PKG002` / package-components-06 TAP2: artifact SHA mismatch refuses before archive contents are accepted — PASS.
- `PKG003` / package-components-06 TAP3: missing runtime cannot yield inventory success — PASS.
- `PKG004` / package-components-06 TAP4: runtime bytes must agree with build provenance — PASS.
- `PKG005` / package-components-06 TAP5: source maps and evidence are not accepted as release entries — PASS.
- `PKG006` / package-components-06 TAP6: case alias entries are refused — PASS.
- `PKG007` / package-components-06 TAP7: platform must be explicitly win32-x64 — PASS.
- `PKG008` / package-components-06 TAP8: manifest identity must match build provenance — PASS.
- `PKG009` / package-components-06 TAP9: missing build input cannot become a complete SBOM — PASS.
- `PKG010` / package-components-06 TAP10: changed build input is refused — PASS.
- `PKG011` / package-components-06 TAP11: repository selector input paths outside code inventory are refused before reading — PASS.
- `PKG012` / package-components-06 TAP12: unknown license is visible INCOMPLETE without inventing approval — PASS.
- `PKG013` / package-components-06 TAP13: missing notice is visible INCOMPLETE — PASS.
- `PKG014` / package-components-06 TAP14: duplicate runtime provenance is rejected — PASS.
- `PKG015` / package-components-06 TAP15: truncated ZIP is a failure, never a partially successful inventory — PASS.
- `PKG016` / package-components-06 TAP16: archive entry with excessive expanded size is refused — PASS.
- `PKG017` / package-components-06 TAP17: deterministic SBOM and report do not include current timestamps or guessed results — PASS.
- `PKG018` / package-components-06 TAP18: actual vsce canonical lowercase readme and changelog names are accepted without allowing aliases — PASS.
- `PKG019` / package-components-06 TAP19: actual shared code input root is admitted: packages/core/src/pathContainment.ts — PASS.
- `PKG020` / package-components-06 TAP20: actual shared code input root is admitted: packages/detectors/dist/secrets.js — PASS.
- `PKG021` / package-components-06 TAP21: B01 deterministic embedded metadata and complete notices for the same admitted inventory — PASS.
- `PKG022` / package-components-06 TAP22: B02 source and runtime changes alter their embedded inventory digest — PASS.
- `PKG023` / package-components-06 TAP23: B03 missing or duplicate runtimes never produce a complete embedded SBOM — PASS.
- `PKG024` / package-components-06 TAP24: B04 unknown or missing library notice is refused rather than called a clean license audit — PASS.
- `PKG025` / package-components-06 TAP25: B05 mismatched notice component identity is refused — PASS.
- `PKG026` / package-components-06 TAP26: B06 absolute paths and oversized notice text cannot enter embedded release metadata — PASS.
- `PKG027` / package-components-06 TAP27: B13 invalid provenance hashes and duplicate source inventory refuse — PASS.
- `PKG028` / package-components-06 TAP28: B15 metadata has no invented native, advisory, legal or release-ready result — PASS.
- `PKG029` / package-components-06 TAP29: B05 changed notice text refuses even when the component and declared license stay unchanged — PASS.
- `PKG030` / package-components-06 TAP30: B07 valid final18 archive recomputes embedded metadata/notices and keeps readiness false — PASS.
- `PKG031` / package-components-06 TAP31: B08 missing privacy and unexpected map entries both refuse — PASS.
- `PKG032` / package-components-06 TAP32: B09 well-formed but changed SBOM refuses independently of archive SHA — PASS.
- `PKG033` / package-components-06 TAP33: B10 preview without actual pre-release XML property refuses — PASS.
- `PKG034` / package-components-06 TAP34: B10 duplicate XML values and comment-only pre-release properties cannot pass — PASS.
- `PKG035` / package-components-06 TAP35: B11 unsupported virtual-workspace declaration must survive packaging — PASS.
- `PKG036` / package-components-06 TAP36: B12 pre-commit exclusion cannot be removed from final package metadata — PASS.
- `PKG037` / package-components-06 TAP37: B14 complete selected BUSL terms are required byte-for-byte — PASS.
- `PKG038` / package-components-06 TAP38: B18 post-package asset source drift refuses — PASS.
- `PKG039` / package-components-06 TAP39: B09 changed bundled source cannot be hidden by internally coherent embedded metadata — PASS.
- `PKG040` / package-components-06 TAP40: B16 installed vsce actually emits final18 entries and the pre-release platform property — PASS.
- `PKG041` / package-components-06 TAP41: B13 existing final output is never overwritten — PASS.
- `PKG042` / package-components-06 TAP42: B10 malformed final XML refuses unclosed tail — PASS.
- `PKG043` / package-components-06 TAP43: B10 malformed final XML refuses second document root — PASS.
- `PKG044` / package-components-06 TAP44: B10 malformed final XML refuses undeclared entity — PASS.
- `PKG045` / package-components-06 TAP45: B16 actual production files allowlist ships all18 final entries — PASS.
- `PKG046` / package-components-06 TAP46: B16 preserves reviewed README relative-link bytes with GitHub repository metadata — PASS.

## Native and remaining gates

Current native root acceptance: docs/soterai-lite/evidence/20261102-f31b-final-package-7be1c304/affected-acceptance-01.json. Developer bootstrap is not F32 installed-only lifecycle. Retained baseline8blocked/9confirmed leaks is never relabeled clean.

Authorized OSV initial8 requests queried284 public package/version pairs and returned42 distinct advisory IDs. Gate **REVIEW_REQUIRED**;745 other lockfile-version records remain unaudited. No advisory detail/pagination/retry requests occurred. IDs do not establish42 exploitable final-VSIX vulnerabilities.

Original outer84707 close/EOF remains **UNCONFIRMED** despite Node21856 being absent twice; historical missing closures and original full01 are not repaired by current success.

- Review/resolve current advisory and required unaudited dependency scope before F31b DONE.
- Named unexecuted subcases above remain unverified; no perfect or complete permutation coverage claim.
- Scoped source/evidence commit and raw byte proof pending; all unrelated changes preserved.
- F32 installed-only lifecycle, V01/V02 final corpus, V03/V04 docs/reviewer packet, original V05/L6 HUMAN-ACTIONS and STOP.
- Required human/different-vendor evidence precedes L7/final rating; no publish/push/tag authority.

The JSON companion pins concrete evidence, actual test titles and case boundaries. This mapping is LOW same-lineage review, not human/different-vendor approval.
