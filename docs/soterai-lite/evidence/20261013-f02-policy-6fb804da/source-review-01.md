# F02 same-lineage source review

Reviewer: /root/requirements_code_review; read-only; independence LOW. Test-author delegates hit `Agent errored: Selected model is at capacity. Please try a different model.` before writing F02 files; root completed test authoring. This is not independent/human acceptance.

Findings fixed with retained failing baseline and passing regressions:

- Legacy NFD region mismatch: B09, unicode-regression-baseline-01.txt.
- Preset IDs without expanded patterns: B10, preset-regression-baseline-01.txt.
- Whole-envelope byte limits: B11/B12, envelope-budget-baseline-01.txt.
- NFD manual file/folder sensitivity mismatch: B13/B14, unicode-path-baseline-01.txt.
- Effective union beyond portable rule count: B15/B16, effective-rule-budget-baseline-01.txt.
- Normalized Unicode bytes exceeding raw budget: P12, canonical-budget-baseline-01.txt.
- Root-discovered existing preview invalidation gap: C10, preview-revocation-baseline-01.txt; real native H02 subsequently checks the already-open virtual document updates.

Final reviewer message: “No remaining F02 source blocker found in this narrow review.” It explicitly leaves completion to exact-artifact reruns/host evidence. All prior failures are retained. Additional corrections align team-file read128KiB, describe exported paths/digests/offsets as reviewed metadata rather than universally secret-free, scope downgrade assertions to tested older schema-aware readers, retain legacy project sensitivity and union manual restrictions into portable export.

No catalog item or overall privacy rating is promoted by this source review. Native/direct-original routes, aliases, history, inherited environment and independent uploads remain outside this feature's boundary.
